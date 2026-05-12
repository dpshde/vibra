mod graph;
mod modules;

use graph::Graph;
use modules::ModuleKind;

const MAX_BLOCK_SIZE: usize = 128;
const MAX_CHANNELS: usize = 2;

pub struct Engine {
    sample_rate: f32,
    block_size: usize,
    graph: Graph,
    output_buffer: Vec<f32>,
    scope_buffer: Vec<f32>,
    voice_freq: f32,
    voice_gate: f32,
    voice_velocity: f32,
    master_amp: f32,
    master_amp_target: f32,
}

impl Engine {
    pub fn new(sample_rate: f32, block_size: usize) -> Self {
        let bs = block_size.min(MAX_BLOCK_SIZE);
        Self {
            sample_rate,
            block_size: bs,
            graph: Graph::new(bs),
            output_buffer: vec![0.0; bs * MAX_CHANNELS],
            scope_buffer: vec![0.0; bs * MAX_CHANNELS],
            voice_freq: 440.0,
            voice_gate: 0.0,
            voice_velocity: 0.0,
            master_amp: 0.0,
            master_amp_target: 0.0,
        }
    }

    pub fn add_module(&mut self, id: u32, kind: ModuleKind) {
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
        self.graph.set_param(module_id, param_id, value);
    }

    pub fn note_on(&mut self, note: u8, velocity: f32) {
        self.voice_freq = midi_to_freq(note);
        self.voice_gate = 1.0;
        self.voice_velocity = velocity;
        self.master_amp_target = velocity * 0.3;
    }

    pub fn note_off(&mut self, _note: u8) {
        self.voice_gate = 0.0;
        self.master_amp_target = 0.0;
    }

    pub fn process(&mut self, frames: usize, channels: usize) {
        let frames = frames.min(self.block_size);
        let ch = channels.min(MAX_CHANNELS);

        self.graph
            .update_voices(self.voice_freq, self.voice_gate, self.voice_velocity);
        self.graph.process(frames);

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
}

fn midi_to_freq(note: u8) -> f32 {
    440.0 * 2.0f32.powf((note as f32 - 69.0) / 12.0)
}

// --- FFI ---

static mut ENGINE: Option<Engine> = None;

#[no_mangle]
pub extern "C" fn vibra_init(sample_rate: f32, block_size: usize) -> bool {
    unsafe {
        ENGINE = Some(Engine::new(sample_rate, block_size));
        true
    }
}

#[no_mangle]
pub extern "C" fn vibra_process(frames: usize, channels: usize) -> *const f32 {
    unsafe {
        if let Some(engine) = ENGINE.as_mut() {
            engine.process(frames, channels);
            engine.output_ptr()
        } else {
            std::ptr::null()
        }
    }
}

#[no_mangle]
pub extern "C" fn vibra_add_module(id: u32, kind: u32) -> bool {
    unsafe {
        if let Some(engine) = ENGINE.as_mut() {
            let kind = ModuleKind::from_u32(kind);
            engine.add_module(id, kind);
            true
        } else {
            false
        }
    }
}

#[no_mangle]
pub extern "C" fn vibra_remove_module(id: u32) -> bool {
    unsafe {
        if let Some(engine) = ENGINE.as_mut() {
            engine.remove_module(id);
            true
        } else {
            false
        }
    }
}

#[no_mangle]
pub extern "C" fn vibra_connect(
    source_id: u32,
    source_port: u32,
    target_id: u32,
    target_port: u32,
) -> bool {
    unsafe {
        if let Some(engine) = ENGINE.as_mut() {
            engine.connect(source_id, source_port, target_id, target_port);
            true
        } else {
            false
        }
    }
}

#[no_mangle]
pub extern "C" fn vibra_disconnect(
    source_id: u32,
    source_port: u32,
    target_id: u32,
    target_port: u32,
) -> bool {
    unsafe {
        if let Some(engine) = ENGINE.as_mut() {
            engine.disconnect(source_id, source_port, target_id, target_port);
            true
        } else {
            false
        }
    }
}

#[no_mangle]
pub extern "C" fn vibra_set_param(module_id: u32, param_id: u32, value: f32) {
    unsafe {
        if let Some(engine) = ENGINE.as_mut() {
            engine.set_param(module_id, param_id, value);
        }
    }
}

#[no_mangle]
pub extern "C" fn vibra_note_on(note: u8, velocity: f32) {
    unsafe {
        if let Some(engine) = ENGINE.as_mut() {
            engine.note_on(note, velocity);
        }
    }
}

#[no_mangle]
pub extern "C" fn vibra_note_off(note: u8) {
    unsafe {
        if let Some(engine) = ENGINE.as_mut() {
            engine.note_off(note);
        }
    }
}

#[no_mangle]
pub extern "C" fn vibra_debug_master_max() -> f32 {
    unsafe {
        if let Some(engine) = ENGINE.as_mut() {
            let master = engine.graph.master_output();
            master.iter().map(|&s| s.abs()).fold(0.0, f32::max)
        } else {
            0.0
        }
    }
}

#[no_mangle]
pub extern "C" fn vibra_scope_ptr() -> *const f32 {
    unsafe {
        if let Some(engine) = ENGINE.as_mut() {
            engine.scope_ptr()
        } else {
            std::ptr::null()
        }
    }
}
