use super::{Module, ModuleKind, ModuleManifest, ParamDef, PortDef, SignalType, ParamUnit};

pub struct Multiplier {
    gain: f32,
}

impl Multiplier {
    pub const MANIFEST: ModuleManifest = ModuleManifest {
        id: "builtin-mult",
        name: "Multiplier",
        category: "utility",
        kind: ModuleKind::Multiplier,
        inputs: &[
            PortDef { id: "a", name: "Sound", signal_type: SignalType::Audio, accepts: &[SignalType::Audio] },
            PortDef { id: "b", name: "Mod", signal_type: SignalType::Level, accepts: &[SignalType::Level, SignalType::Modulation] },
        ],
        outputs: &[PortDef { id: "out", name: "Out", signal_type: SignalType::Audio, accepts: &[] }],
        parameters: &[
            ParamDef { id: "gain", name: "Gain", description: "Output scaling.", unit: ParamUnit::Ratio, min: 0.0, max: 2.0, default: 1.0, enum_values: &[] },
        ],
        voice_scope: super::VoiceScope::PerVoice,
        create: |_sr, _bs| Box::new(Multiplier::new()),
    };

    pub fn new() -> Self {
        Self { gain: 1.0 }
    }
}

impl Module for Multiplier {
    fn process(&mut self, inputs: &[&[f32]], outputs: &mut [&mut [f32]], frames: usize) {
        let a = &inputs[0][..frames];
        let b = if inputs.len() > 1 {
            &inputs[1][..frames]
        } else {
            &[] as &[f32]
        };
        let out = &mut outputs[0][..frames];

        for i in 0..frames {
            let mod_sig = if i < b.len() { b[i] } else { 1.0 };
            out[i] = a[i] * mod_sig * self.gain;
        }
    }

    fn set_param(&mut self, index: usize, value: f32) {
        if index == 0 {
            self.gain = value.max(0.0).min(2.0);
        }
    }

    fn set_voice(&mut self, _freq: f32, _gate: f32, _velocity: f32) {}
    fn num_inputs(&self) -> usize {
        2
    }
    fn num_outputs(&self) -> usize {
        1
    }
    fn kind(&self) -> ModuleKind {
        ModuleKind::Multiplier
    }

    fn params(&self) -> &'static [crate::param::ParamDef] {
        Self::MANIFEST.parameters
    }
}
