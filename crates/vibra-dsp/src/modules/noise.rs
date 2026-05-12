use super::{Module, ModuleKind};

pub struct Noise {
    seed: u32,
    filter_z: f32,
    color: f32,
}

impl Noise {
    pub fn new() -> Self {
        Self {
            seed: 12345,
            filter_z: 0.0,
            color: 0.0,
        }
    }

    fn next_white(&mut self) -> f32 {
        self.seed = self.seed.wrapping_mul(1103515245).wrapping_add(12345);
        let val = (self.seed & 0x7fffffff) as f32 / 0x7fffffff as f32;
        val * 2.0 - 1.0
    }
}

impl Module for Noise {
    fn process(&mut self, _inputs: &[&[f32]], outputs: &mut [&mut [f32]], frames: usize) {
        let out = &mut outputs[0][..frames];
        for i in 0..frames {
            let white = self.next_white();
            // Simple one-pole lowpass to muffle the noise toward "pinkish"
            self.filter_z += 0.1 * (white - self.filter_z);
            let sample = white * (1.0 - self.color) + self.filter_z * self.color;
            out[i] = sample;
        }
    }

    fn set_param(&mut self, index: usize, value: f32) {
        if index == 0 {
            self.color = value.max(0.0).min(1.0);
        }
    }

    fn set_voice(&mut self, _freq: f32, _gate: f32, _velocity: f32) {}
    fn num_inputs(&self) -> usize { 0 }
    fn num_outputs(&self) -> usize { 1 }
    fn kind(&self) -> ModuleKind { ModuleKind::Noise }
}
