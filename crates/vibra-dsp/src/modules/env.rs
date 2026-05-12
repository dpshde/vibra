use super::{Module, ModuleKind, ModuleManifest, ParamDef, PortDef, PortRate, ParamUnit};

pub struct Adsr {
    sample_rate: f32,
    attack: f32,
    decay: f32,
    sustain: f32,
    release: f32,
    state: AdsrState,
    level: f32,
    gate: f32,
    voice_gate: f32,
}

#[derive(Clone, Copy)]
enum AdsrState {
    Idle,
    Attack,
    Decay,
    Sustain,
    Release,
}

impl Adsr {
    pub const MANIFEST: ModuleManifest = ModuleManifest {
        id: "builtin-env",
        name: "Envelope",
        category: "modulation",
        kind: ModuleKind::Adsr,
        inputs: &[PortDef { id: "gate", name: "Gate", rate: PortRate::Audio }],
        outputs: &[PortDef { id: "out", name: "Out", rate: PortRate::Audio }],
        parameters: &[
            ParamDef { id: "attack", name: "Attack", description: "How quickly the sound rises from silence.", unit: ParamUnit::S, min: 0.001, max: 5.0, default: 0.01, enum_values: &[] },
            ParamDef { id: "decay", name: "Decay", description: "How quickly the sound falls from peak to sustain.", unit: ParamUnit::S, min: 0.001, max: 5.0, default: 0.3, enum_values: &[] },
            ParamDef { id: "sustain", name: "Sustain", description: "The volume level held while a key is pressed.", unit: ParamUnit::Ratio, min: 0.0, max: 1.0, default: 0.5, enum_values: &[] },
            ParamDef { id: "release", name: "Release", description: "How long the sound takes to fade after release.", unit: ParamUnit::S, min: 0.001, max: 10.0, default: 0.5, enum_values: &[] },
        ],
        voice_scope: super::VoiceScope::PerVoice,
        create: |sr, _bs| Box::new(Adsr::new(sr)),
    };

    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate,
            attack: 0.01,
            decay: 0.3,
            sustain: 0.5,
            release: 0.5,
            state: AdsrState::Idle,
            level: 0.0,
            gate: 0.0,
            voice_gate: 0.0,
        }
    }

    fn rate(&self, time: f32) -> f32 {
        if time <= 0.0 { 1.0 } else { 1.0 / (time * self.sample_rate) }
    }
}

impl Module for Adsr {
    fn process(&mut self, inputs: &[&[f32]], outputs: &mut [&mut [f32]], frames: usize) {
        let gate_in = if !inputs.is_empty() { &inputs[0][..frames] } else { &[] as &[f32] };
        let out = &mut outputs[0][..frames];
        for i in 0..frames {
            let g = if i < gate_in.len() { gate_in[i] } else { self.voice_gate };
            if g > 0.5 && self.gate <= 0.5 {
                self.state = AdsrState::Attack;
            } else if g <= 0.5 && self.gate > 0.5 {
                self.state = AdsrState::Release;
            }
            self.gate = g;

            match self.state {
                AdsrState::Idle => { self.level = 0.0; }
                AdsrState::Attack => {
                    self.level += self.rate(self.attack);
                    if self.level >= 1.0 {
                        self.level = 1.0;
                        self.state = AdsrState::Decay;
                    }
                }
                AdsrState::Decay => {
                    self.level -= self.rate(self.decay);
                    if self.level <= self.sustain {
                        self.level = self.sustain;
                        self.state = AdsrState::Sustain;
                    }
                }
                AdsrState::Sustain => { self.level = self.sustain; }
                AdsrState::Release => {
                    self.level -= self.rate(self.release);
                    if self.level <= 0.0 {
                        self.level = 0.0;
                        self.state = AdsrState::Idle;
                    }
                }
            }
            out[i] = self.level;
        }
    }

    fn set_param(&mut self, index: usize, value: f32) {
        match index {
            0 => self.attack = value.max(0.001),
            1 => self.decay = value.max(0.001),
            2 => self.sustain = value.max(0.0).min(1.0),
            3 => self.release = value.max(0.001),
            _ => {}
        }
    }

    fn set_voice(&mut self, _freq: f32, gate: f32, _velocity: f32) {
        if gate > 0.5 && self.voice_gate <= 0.5 {
            self.state = AdsrState::Attack;
        } else if gate <= 0.5 && self.voice_gate > 0.5 {
            self.state = AdsrState::Release;
        }
        self.voice_gate = gate;
    }

    fn num_inputs(&self) -> usize { 1 }
    fn num_outputs(&self) -> usize { 1 }
    fn kind(&self) -> ModuleKind { ModuleKind::Adsr }

    fn params(&self) -> &'static [crate::param::ParamDef] {
        Self::MANIFEST.parameters
    }
}
