use crate::midi::MidiEvent;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VoiceMode {
    Mono = 0,
    Poly = 1,
    Unison = 2,
    Legato = 3,
    Paraphonic = 4,
}

impl VoiceMode {
    pub fn from_u32(v: u32) -> Self {
        match v {
            0 => Self::Mono,
            1 => Self::Poly,
            2 => Self::Unison,
            3 => Self::Legato,
            _ => Self::Paraphonic,
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct VoiceState {
    pub freq: f32,
    pub gate: f32,
    pub velocity: f32,
    pub active: bool,
    pub note: u8,
    pub age: u64,
}

impl Default for VoiceState {
    fn default() -> Self {
        Self {
            freq: 440.0,
            gate: 0.0,
            velocity: 0.0,
            active: false,
            note: 0,
            age: 0,
        }
    }
}

/// Voice change event returned by the allocator per audio block.
#[derive(Debug, Clone, Copy)]
pub struct VoiceChange {
    pub voice_index: usize,
    pub note: u8,
    pub velocity: f32,
    pub gate: f32,
    pub freq: f32,
}

pub struct VoiceAllocator {
    max_voices: usize,
    voices: Vec<VoiceState>,
    next_age: u64,
    mode: VoiceMode,
    unison_count: usize,
    unison_detune_cents: f32,
    /// For legato: current active note, if any.
    legato_note: Option<u8>,
    /// For legato: whether a note is currently held.
    legato_gate: bool,
    /// For mono: last note played, for retrigger behavior.
    last_note: Option<u8>,
}

impl VoiceAllocator {
    pub fn new(max_voices: usize) -> Self {
        Self {
            max_voices,
            voices: vec![VoiceState::default(); max_voices],
            next_age: 1,
            mode: VoiceMode::Poly,
            unison_count: 1,
            unison_detune_cents: 0.0,
            legato_note: None,
            legato_gate: false,
            last_note: None,
        }
    }

    pub fn set_mode(&mut self, mode: VoiceMode, polyphony: usize, unison_count: usize, unison_detune: f32) {
        self.mode = mode;
        self.max_voices = match mode {
            VoiceMode::Mono | VoiceMode::Legato => 1,
            VoiceMode::Unison => polyphony.max(1),
            VoiceMode::Poly | VoiceMode::Paraphonic => polyphony.max(1).min(32),
        };
        // Resize voices vector if needed
        if self.voices.len() != self.max_voices {
            self.voices = vec![VoiceState::default(); self.max_voices];
        }
        self.unison_count = unison_count.max(1).min(self.max_voices as usize);
        self.unison_detune_cents = unison_detune;
    }

    pub fn process_midi(&mut self, events: &[MidiEvent]) -> Vec<VoiceChange> {
        let mut changes = Vec::with_capacity(events.len() * self.unison_count);

        for event in events {
            match event.data[0] & 0xF0 {
                0x90 => {
                    let note = event.data[1];
                    let vel = event.data[2] as f32 / 127.0;
                    let freq = midi_to_freq(note);
                    match self.mode {
                        VoiceMode::Mono => {
                            self.voices[0] = VoiceState {
                                freq,
                                gate: 1.0,
                                velocity: vel,
                                active: true,
                                note,
                                age: self.next_age,
                            };
                            self.next_age += 1;
                            self.last_note = Some(note);
                            changes.push(VoiceChange {
                                voice_index: 0,
                                note,
                                velocity: vel,
                                gate: 1.0,
                                freq,
                            });
                        }
                        VoiceMode::Legato => {
                            let retrigger = !self.legato_gate;
                            self.legato_note = Some(note);
                            self.legato_gate = true;
                            self.voices[0] = VoiceState {
                                freq,
                                gate: if retrigger { 1.0 } else { self.voices[0].gate },
                                velocity: vel,
                                active: true,
                                note,
                                age: self.next_age,
                            };
                            self.next_age += 1;
                            self.last_note = Some(note);
                            changes.push(VoiceChange {
                                voice_index: 0,
                                note,
                                velocity: vel,
                                gate: if retrigger { 1.0 } else { self.voices[0].gate },
                                freq,
                            });
                        }
                        VoiceMode::Poly | VoiceMode::Paraphonic => {
                            // Try to find an inactive voice
                            let mut allocated = false;
                            for (i, voice) in self.voices.iter_mut().enumerate() {
                                if !voice.active {
                                    *voice = VoiceState {
                                        freq,
                                        gate: 1.0,
                                        velocity: vel,
                                        active: true,
                                        note,
                                        age: self.next_age,
                                    };
                                    self.next_age += 1;
                                    changes.push(VoiceChange {
                                        voice_index: i,
                                        note,
                                        velocity: vel,
                                        gate: 1.0,
                                        freq,
                                    });
                                    allocated = true;
                                    break;
                                }
                            }
                            // Steal oldest if all voices active
                            if !allocated {
                                let oldest = self.voices.iter_mut().enumerate().min_by_key(|(_, v)| v.age).map(|(i, _)| i).unwrap_or(0);
                                self.voices[oldest] = VoiceState {
                                    freq,
                                    gate: 1.0,
                                    velocity: vel,
                                    active: true,
                                    note,
                                    age: self.next_age,
                                };
                                self.next_age += 1;
                                changes.push(VoiceChange {
                                    voice_index: oldest,
                                    note,
                                    velocity: vel,
                                    gate: 1.0,
                                    freq,
                                });
                            }
                        }
                        VoiceMode::Unison => {
                            let base_freq = freq;
                            let count = self.unison_count.min(self.max_voices);
                            for i in 0..count {
                                let detune = if count > 1 {
                                    self.unison_detune_cents * (i as f32 / (count as f32 - 1.0) - 0.5)
                                } else {
                                    0.0
                                };
                                let freq = base_freq * 2.0f32.powf(detune / 1200.0);
                                self.voices[i] = VoiceState {
                                    freq,
                                    gate: 1.0,
                                    velocity: vel,
                                    active: true,
                                    note,
                                    age: self.next_age,
                                };
                                self.next_age += 1;
                                changes.push(VoiceChange {
                                    voice_index: i,
                                    note,
                                    velocity: vel,
                                    gate: 1.0,
                                    freq,
                                });
                            }
                        }
                    }
                }
                0x80 => {
                    let note = event.data[1];
                    match self.mode {
                        VoiceMode::Mono => {
                            if self.last_note == Some(note) {
                                self.voices[0].gate = 0.0;
                                self.voices[0].active = false;
                                self.last_note = None;
                                changes.push(VoiceChange {
                                    voice_index: 0,
                                    note,
                                    velocity: 0.0,
                                    gate: 0.0,
                                    freq: self.voices[0].freq,
                                });
                            }
                        }
                        VoiceMode::Legato => {
                            if self.legato_note == Some(note) {
                                self.legato_gate = false;
                                self.legato_note = None;
                                self.voices[0].gate = 0.0;
                                self.voices[0].active = false;
                                changes.push(VoiceChange {
                                    voice_index: 0,
                                    note,
                                    velocity: 0.0,
                                    gate: 0.0,
                                    freq: self.voices[0].freq,
                                });
                            }
                        }
                        VoiceMode::Poly | VoiceMode::Paraphonic | VoiceMode::Unison => {
                            for (i, voice) in self.voices.iter_mut().enumerate() {
                                if voice.active && voice.note == note {
                                    voice.gate = 0.0;
                                    voice.active = false;
                                    changes.push(VoiceChange {
                                        voice_index: i,
                                        note,
                                        velocity: 0.0,
                                        gate: 0.0,
                                        freq: voice.freq,
                                    });
                                    break;
                                }
                            }
                        }
                    }
                }
                _ => {}
            }
        }

        changes
    }

    pub fn voices(&self) -> &[VoiceState] {
        &self.voices
    }

    pub fn mode(&self) -> VoiceMode {
        self.mode
    }

    pub fn max_voices(&self) -> usize {
        self.max_voices
    }
}

fn midi_to_freq(note: u8) -> f32 {
    440.0 * 2.0f32.powf((note as f32 - 69.0) / 12.0)
}
