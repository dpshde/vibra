use super::{Module, ModuleKind};

pub struct Delay {
    sample_rate: f32,
    buffer: Vec<f32>,
    write_pos: usize,
    delay_ms: f32,
    feedback: f32,
    mix: f32,
}

impl Delay {
    pub fn new(sample_rate: f32, max_delay_ms: f32) -> Self {
        let max_samples = ((max_delay_ms / 1000.0) * sample_rate).ceil() as usize + 1;
        Self {
            sample_rate,
            buffer: vec![0.0; max_samples],
            write_pos: 0,
            delay_ms: 250.0,
            feedback: 0.3,
            mix: 0.5,
        }
    }

    fn read_linear(&self, delay_samples: f32) -> f32 {
        let len = self.buffer.len();
        let read_pos = (self.write_pos as f32 - delay_samples).rem_euclid(len as f32);
        let idx0 = read_pos as usize % len;
        let idx1 = (idx0 + 1) % len;
        let frac = read_pos - read_pos.floor();
        self.buffer[idx0] + frac * (self.buffer[idx1] - self.buffer[idx0])
    }
}

impl Module for Delay {
    fn process(&mut self, inputs: &[&[f32]], outputs: &mut [&mut [f32]], frames: usize) {
        let inp = &inputs[0][..frames];
        let out = &mut outputs[0][..frames];
        let delay_samples = (self.delay_ms / 1000.0) * self.sample_rate;

        for i in 0..frames {
            let delayed = self.read_linear(delay_samples);
            let sample = inp[i] + delayed * self.feedback;
            self.buffer[self.write_pos] = sample;
            self.write_pos = (self.write_pos + 1) % self.buffer.len();
            out[i] = inp[i] * (1.0 - self.mix) + delayed * self.mix;
        }
    }

    fn set_param(&mut self, index: usize, value: f32) {
        match index {
            0 => self.delay_ms = value.max(1.0).min(5000.0),
            1 => self.feedback = value.max(0.0).min(0.99),
            2 => self.mix = value.max(0.0).min(1.0),
            _ => {}
        }
    }

    fn set_voice(&mut self, _freq: f32, _gate: f32, _velocity: f32) {}
    fn num_inputs(&self) -> usize { 1 }
    fn num_outputs(&self) -> usize { 1 }
    fn kind(&self) -> ModuleKind { ModuleKind::Delay }
}
