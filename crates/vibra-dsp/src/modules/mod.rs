#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ModuleKind {
    Oscillator = 0,
    Gain = 1,
    Filter = 2,
    Adsr = 3,
    Scope = 4,
    Destination = 5,
    Lfo = 6,
    Noise = 7,
    Delay = 8,
    Multiplier = 9,
    Pan = 10,
}

impl ModuleKind {
    pub fn from_u32(v: u32) -> Self {
        match v {
            0 => Self::Oscillator,
            1 => Self::Gain,
            2 => Self::Filter,
            3 => Self::Adsr,
            4 => Self::Scope,
            5 => Self::Destination,
            6 => Self::Lfo,
            7 => Self::Noise,
            8 => Self::Delay,
            9 => Self::Multiplier,
            10 => Self::Pan,
            _ => Self::Destination,
        }
    }
}

pub trait Module {
    fn process(&mut self, inputs: &[&[f32]], outputs: &mut [&mut [f32]], frames: usize);
    fn set_param(&mut self, index: usize, value: f32);
    fn set_voice(&mut self, freq: f32, gate: f32, velocity: f32);
    fn num_inputs(&self) -> usize;
    fn num_outputs(&self) -> usize;
    fn kind(&self) -> ModuleKind;
}

mod delay;
mod env;
mod filter;
mod gain;
mod lfo;
mod multiplier;
mod noise;
mod osc;
mod pan;
mod scope;

pub use delay::Delay;
pub use env::Adsr;
pub use filter::BiquadFilter;
pub use gain::Gain;
pub use lfo::Lfo;
pub use multiplier::Multiplier;
pub use noise::Noise;
pub use osc::Oscillator;
pub use pan::Pan;
pub use scope::Scope;

pub fn create_module(kind: ModuleKind, sample_rate: f32, block_size: usize) -> Box<dyn Module> {
    match kind {
        ModuleKind::Oscillator => Box::new(Oscillator::new(sample_rate)),
        ModuleKind::Gain => Box::new(Gain::new()),
        ModuleKind::Filter => Box::new(BiquadFilter::new(sample_rate)),
        ModuleKind::Adsr => Box::new(Adsr::new(sample_rate)),
        ModuleKind::Scope => Box::new(Scope::new(block_size)),
        ModuleKind::Destination => Box::new(Destination::new()),
        ModuleKind::Lfo => Box::new(Lfo::new(sample_rate)),
        ModuleKind::Noise => Box::new(Noise::new()),
        ModuleKind::Delay => Box::new(Delay::new(sample_rate, 5000.0)),
        ModuleKind::Multiplier => Box::new(Multiplier::new()),
        ModuleKind::Pan => Box::new(Pan::new()),
    }
}

struct Destination;

impl Destination {
    fn new() -> Self {
        Self
    }
}

impl Module for Destination {
    fn process(&mut self, _inputs: &[&[f32]], _outputs: &mut [&mut [f32]], _frames: usize) {}
    fn set_param(&mut self, _index: usize, _value: f32) {}
    fn set_voice(&mut self, _freq: f32, _gate: f32, _velocity: f32) {}
    fn num_inputs(&self) -> usize {
        1
    }
    fn num_outputs(&self) -> usize {
        0
    }
    fn kind(&self) -> ModuleKind {
        ModuleKind::Destination
    }
}
