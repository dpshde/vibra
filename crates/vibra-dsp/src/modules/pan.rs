use super::{Module, ModuleKind};

pub struct Pan {
    pan: f32, // -1.0 = full left, 0.0 = center, 1.0 = full right
}

impl Pan {
    pub fn new() -> Self {
        Self { pan: 0.0 }
    }
}

impl Module for Pan {
    fn process(&mut self, inputs: &[&[f32]], outputs: &mut [&mut [f32]], frames: usize) {
        let inp = &inputs[0][..frames];
        if outputs.len() < 2 {
            return;
        }
        let (first, rest) = outputs.split_at_mut(1);
        let left = &mut first[0][..frames];
        let right = &mut rest[0][..frames];

        // Constant-power panning: angle goes from 0 (left) to PI/2 (right)
        let angle = (self.pan + 1.0) * 0.5 * std::f32::consts::FRAC_PI_2;
        let gain_l = angle.cos();
        let gain_r = angle.sin();

        for i in 0..frames {
            left[i] = inp[i] * gain_l;
            right[i] = inp[i] * gain_r;
        }
    }

    fn set_param(&mut self, index: usize, value: f32) {
        if index == 0 {
            self.pan = value.max(-1.0).min(1.0);
        }
    }

    fn set_voice(&mut self, _freq: f32, _gate: f32, _velocity: f32) {}
    fn num_inputs(&self) -> usize {
        1
    }
    fn num_outputs(&self) -> usize {
        2
    }
    fn kind(&self) -> ModuleKind {
        ModuleKind::Pan
    }
}
