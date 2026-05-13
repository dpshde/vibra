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
    Reverb = 11,
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
            11 => Self::Reverb,
            _ => Self::Destination,
        }
    }
}

pub use crate::param::{ParamDef, ParamUnit};

/// Semantic signal type describing what a port produces or expects.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SignalType {
    Audio,
    Trigger,
    Pitch,
    Level,
    Modulation,
    Blend,
}

impl SignalType {
    pub fn as_str(&self) -> &'static str {
        match self {
            SignalType::Audio => "audio",
            SignalType::Trigger => "trigger",
            SignalType::Pitch => "pitch",
            SignalType::Level => "level",
            SignalType::Modulation => "modulation",
            SignalType::Blend => "blend",
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct PortDef {
    pub id: &'static str,
    pub name: &'static str,
    pub signal_type: SignalType,
    /// For input ports: which source types are explicitly welcomed.
    /// Empty slice means any source is accepted without guidance.
    pub accepts: &'static [SignalType],
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VoiceScope {
    PerVoice,
    Global,
}

pub struct ModuleManifest {
    pub id: &'static str,
    pub name: &'static str,
    pub category: &'static str,
    pub kind: ModuleKind,
    pub inputs: &'static [PortDef],
    pub outputs: &'static [PortDef],
    pub parameters: &'static [ParamDef],
    pub voice_scope: VoiceScope,
    pub create: fn(f32, usize) -> Box<dyn Module>,
}

pub trait Module {
    fn process(&mut self, inputs: &[&[f32]], outputs: &mut [&mut [f32]], frames: usize);
    fn set_param(&mut self, index: usize, value: f32);
    fn set_voice(&mut self, freq: f32, gate: f32, velocity: f32);
    fn num_inputs(&self) -> usize;
    fn num_outputs(&self) -> usize;
    fn kind(&self) -> ModuleKind;
    /// Return metadata for each parameter this module exposes.
    fn params(&self) -> &'static [ParamDef] {
        &[]
    }
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
mod reverb;
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
pub use reverb::Reverb;
pub use scope::Scope;

pub fn create_module(kind: ModuleKind, sample_rate: f32, block_size: usize) -> Box<dyn Module> {
    (manifest_for(kind).create)(sample_rate, block_size)
}

/// Static registry of all builtin module manifests.
pub fn registry() -> &'static [ModuleManifest] {
    &[Oscillator::MANIFEST, Gain::MANIFEST, BiquadFilter::MANIFEST,
      Adsr::MANIFEST, Scope::MANIFEST, DESTINATION_MANIFEST,
      Lfo::MANIFEST, Noise::MANIFEST, Delay::MANIFEST,
      Multiplier::MANIFEST, Pan::MANIFEST, Reverb::MANIFEST]
}

pub fn manifest_for(kind: ModuleKind) -> &'static ModuleManifest {
    for m in registry() {
        if m.kind == kind {
            return m;
        }
    }
    &DESTINATION_MANIFEST
}

struct Destination;

impl Destination {
    fn new(_sr: f32, _bs: usize) -> Self {
        Self
    }
}

const DESTINATION_MANIFEST: ModuleManifest = ModuleManifest {
    id: "builtin-destination",
    name: "Destination",
    category: "output",
    kind: ModuleKind::Destination,
    inputs: &[PortDef { id: "in", name: "In", signal_type: SignalType::Audio, accepts: &[SignalType::Audio] }],
    outputs: &[],
    parameters: &[],
    voice_scope: VoiceScope::Global,
    create: |sr, bs| Box::new(Destination::new(sr, bs)),
};

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
    fn params(&self) -> &'static [ParamDef] {
        &[]
    }
}

/// Get the default voice scope for a module kind.
pub fn default_voice_scope(kind: ModuleKind) -> VoiceScope {
    match kind {
        ModuleKind::Oscillator
        | ModuleKind::Filter
        | ModuleKind::Gain
        | ModuleKind::Adsr
        | ModuleKind::Noise
        | ModuleKind::Multiplier
        | ModuleKind::Pan => VoiceScope::PerVoice,
        ModuleKind::Lfo
        | ModuleKind::Delay
        | ModuleKind::Scope
        | ModuleKind::Destination
        | ModuleKind::Reverb => VoiceScope::Global,
    }
}
