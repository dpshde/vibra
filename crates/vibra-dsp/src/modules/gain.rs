use super::{Module, ModuleKind};

pub struct Gain {
    gain: f32,
    smooth_gain: f32,
}

impl Gain {
    pub fn new() -> Self {
        Self { gain: 1.0, smooth_gain: 1.0 }
    }
}

impl Module for Gain {
    fn process(&mut self, inputs: &[&[f32]], outputs: &mut [&mut [f32]], frames: usize) {
        let inp = &inputs[0][..frames];
        let out = &mut outputs[0][..frames];
        for i in 0..frames {
            self.smooth_gain += 0.01 * (self.gain - self.smooth_gain);
            out[i] = inp[i] * self.smooth_gain;
        }
    }

    fn set_param(&mut self, index: usize, value: f32) {
        if index == 0 { self.gain = value; }
    }

    fn set_voice(&mut self, _freq: f32, _gate: f32, _velocity: f32) {}
    fn num_inputs(&self) -> usize { 1 }
    fn num_outputs(&self) -> usize { 1 }
    fn kind(&self) -> ModuleKind { ModuleKind::Gain }
}
