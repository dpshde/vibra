use super::{Module, ModuleKind};

pub struct Scope {
    _block_size: usize,
}

impl Scope {
    pub fn new(block_size: usize) -> Self {
        Self { _block_size: block_size }
    }
}

impl Module for Scope {
    fn process(&mut self, inputs: &[&[f32]], outputs: &mut [&mut [f32]], frames: usize) {
        let inp = if !inputs.is_empty() { &inputs[0][..frames] } else { &[] as &[f32] };
        if !outputs.is_empty() {
            let out = &mut outputs[0][..frames];
            for i in 0..frames {
                out[i] = if i < inp.len() { inp[i] } else { 0.0 };
            }
        }
    }

    fn set_param(&mut self, _index: usize, _value: f32) {}
    fn set_voice(&mut self, _freq: f32, _gate: f32, _velocity: f32) {}
    fn num_inputs(&self) -> usize { 1 }
    fn num_outputs(&self) -> usize { 1 }
    fn kind(&self) -> ModuleKind { ModuleKind::Scope }
}
