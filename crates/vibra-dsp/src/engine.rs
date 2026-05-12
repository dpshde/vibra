use crate::graph::Graph;
use crate::midi::{MidiBuffer, MidiEvent};
use crate::param::ParamQueue;
use crate::voice::{VoiceAllocator, VoiceChange, VoiceMode};

const MAX_BLOCK_SIZE: usize = 128;
const MAX_CHANNELS: usize = 2;
const DEFAULT_POLYPHONY: usize = 8;

pub struct Engine {
    sample_rate: f32,
    block_size: usize,
    max_voices: usize,
    graph: Graph,
    voice_allocator: VoiceAllocator,
    param_queue: ParamQueue,
    midi_buffer: MidiBuffer,
    output_buffer: Vec<f32>,
    scope_buffer: Vec<f32>,
    master_amp: f32,
    master_amp_target: f32,
}

impl Engine {
    pub fn new(sample_rate: f32, block_size: usize) -> Self {
        let bs = block_size.min(MAX_BLOCK_SIZE);
        let polyphony = DEFAULT_POLYPHONY;
        Self {
            sample_rate,
            block_size: bs,
            max_voices: polyphony,
            graph: Graph::new(bs, polyphony),
            voice_allocator: VoiceAllocator::new(polyphony),
            param_queue: ParamQueue::new(),
            midi_buffer: MidiBuffer::new(),
            output_buffer: vec![0.0; bs * MAX_CHANNELS],
            scope_buffer: vec![0.0; bs * MAX_CHANNELS],
            master_amp: 0.0,
            master_amp_target: 0.0,
        }
    }

    pub fn add_module(&mut self, id: u32, kind: crate::modules::ModuleKind) {
        self.graph
            .add_module(id, kind, self.sample_rate, self.block_size);
    }

    pub fn remove_module(&mut self, id: u32) {
        self.graph.remove_module(id);
    }

    pub fn connect(&mut self, source: u32, source_port: u32, target: u32, target_port: u32) {
        self.graph.connect(source, source_port, target, target_port);
    }

    pub fn disconnect(&mut self, source: u32, source_port: u32, target: u32, target_port: u32) {
        self.graph
            .disconnect(source, source_port, target, target_port);
    }

    pub fn set_param(&mut self, module_id: u32, param_id: u32, value: f32) {
        self.param_queue.push(crate::param::ParamChange {
            module_id,
            param_id,
            value,
        });
    }

    pub fn set_voice_mode(&mut self, mode: VoiceMode, polyphony: usize, unison_count: usize, unison_detune: f32) {
        self.voice_allocator.set_mode(mode, polyphony, unison_count, unison_detune);
        let new_max = self.voice_allocator.max_voices();
        if new_max != self.max_voices {
            self.max_voices = new_max;
            // Note: Graph doesn't dynamically resize, modules created before
            // this will have the old voice count. For simplicity, require
            // set_voice_mode before add_module.
        }
    }

    pub fn push_midi(&mut self, event: MidiEvent) {
        self.midi_buffer.push(event);
    }

    pub fn note_on(&mut self, note: u8, velocity: f32) {
        self.midi_buffer.push(MidiEvent::note_on(0, note, (velocity * 127.0).min(127.0) as u8));
    }

    pub fn note_off(&mut self, note: u8) {
        self.midi_buffer.push(MidiEvent::note_off(0, note));
    }

    pub fn process(&mut self, frames: usize, channels: usize) {
        let frames = frames.min(self.block_size);
        let ch = channels.min(MAX_CHANNELS);

        // 1. Drain parameter queue into graph
        self.param_queue.drain(|change| {
            self.graph.set_param(change.module_id, change.param_id, change.value);
        });

        // 2. Process MIDI through voice allocator
        self.midi_buffer.sort();
        let _changes = self.voice_allocator.process_midi(self.midi_buffer.events());
        self.midi_buffer.clear();

        // 3. Apply master amplitude envelope
        let max_vel = self.voice_allocator.voices().iter().map(|v| v.velocity).fold(0.0, f32::max);
        self.master_amp_target = max_vel * 0.3;

        // 4. Process audio with active voices
        let voices = self.voice_allocator.voices();
        self.graph.process(frames, voices);

        let master = self.graph.master_output();

        for i in 0..frames {
            self.master_amp += 0.0005 * (self.master_amp_target - self.master_amp);
            let sample = if i < master.len() {
                master[i] * self.master_amp
            } else {
                0.0
            };
            for c in 0..ch {
                self.output_buffer[i * ch + c] = sample;
            }
        }

        self.scope_buffer[..frames * ch].copy_from_slice(&self.output_buffer[..frames * ch]);
    }

    pub fn output_ptr(&self) -> *const f32 {
        self.output_buffer.as_ptr()
    }

    pub fn scope_ptr(&self) -> *const f32 {
        self.scope_buffer.as_ptr()
    }

    pub fn active_voices(&self) -> usize {
        self.voice_allocator.voices().iter().filter(|v| v.active).count()
    }

    pub fn voice_mode(&self) -> VoiceMode {
        self.voice_allocator.mode()
    }
}

fn midi_to_freq(note: u8) -> f32 {
    440.0 * 2.0f32.powf((note as f32 - 69.0) / 12.0)
}
