use super::{Module, ModuleKind, ModuleManifest, ParamDef, PortDef, SignalType, ParamUnit};
use crate::param::SmoothedParam;

pub struct Gain {
    gain: SmoothedParam,
}

impl Gain {
    pub const MANIFEST: ModuleManifest = ModuleManifest {
        id: "builtin-gain",
        name: "Gain",
        category: "utility",
        kind: ModuleKind::Gain,
        inputs: &[PortDef { id: "in", name: "In", signal_type: SignalType::Audio, accepts: &[SignalType::Audio] }],
        outputs: &[PortDef { id: "out", name: "Out", signal_type: SignalType::Audio, accepts: &[] }],
        parameters: &[
            ParamDef { id: "gain", name: "Volume", description: "Volume multiplier.", unit: ParamUnit::Ratio, min: 0.0, max: 2.0, default: 1.0, enum_values: &[] },
        ],
        voice_scope: super::VoiceScope::PerVoice,
        create: |_sr, _bs| Box::new(Gain::new()),
    };

    pub fn new() -> Self {
        Self {
            gain: SmoothedParam::new(1.0, 0.01),
        }
    }
}

impl Module for Gain {
    fn process(&mut self, inputs: &[&[f32]], outputs: &mut [&mut [f32]], frames: usize) {
        let inp = &inputs[0][..frames];
        let out = &mut outputs[0][..frames];
        for i in 0..frames {
            out[i] = inp[i] * self.gain.next();
        }
    }

    fn set_param(&mut self, index: usize, value: f32) {
        if index == 0 { self.gain.set_target(value); }
    }

    fn set_voice(&mut self, _freq: f32, _gate: f32, _velocity: f32) {}
    fn num_inputs(&self) -> usize { 1 }
    fn num_outputs(&self) -> usize { 1 }
    fn kind(&self) -> ModuleKind { ModuleKind::Gain }

    fn params(&self) -> &'static [ParamDef] {
        Self::MANIFEST.parameters
    }
}
