/// A single MIDI event with sample-accurate offset within the current audio block.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct MidiEvent {
    pub sample_offset: u32,
    pub data: [u8; 3],
}

impl MidiEvent {
    pub fn note_on(offset: u32, note: u8, velocity: u8) -> Self {
        Self {
            sample_offset: offset,
            data: [0x90, note, velocity],
        }
    }

    pub fn note_off(offset: u32, note: u8) -> Self {
        Self {
            sample_offset: offset,
            data: [0x80, note, 0],
        }
    }
}

/// Simple growable buffer for MIDI events, owned by the engine.
/// Cleared each process block after consumption.
pub struct MidiBuffer {
    events: Vec<MidiEvent>,
}

impl Default for MidiBuffer {
    fn default() -> Self {
        Self::new()
    }
}

impl MidiBuffer {
    pub fn new() -> Self {
        Self {
            events: Vec::with_capacity(64),
        }
    }

    pub fn push(&mut self, event: MidiEvent) {
        self.events.push(event);
    }

    /// Sort by sample offset so the audio thread processes them in order.
    pub fn sort(&mut self) {
        self.events.sort_by_key(|e| e.sample_offset);
    }

    pub fn events(&self) -> &[MidiEvent] {
        &self.events
    }

    pub fn clear(&mut self) {
        self.events.clear();
    }

    pub fn len(&self) -> usize {
        self.events.len()
    }

    pub fn is_empty(&self) -> bool {
        self.events.is_empty()
    }
}
