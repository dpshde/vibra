use super::{Module, ModuleKind, ModuleManifest, ParamDef, PortDef, PortRate, ParamUnit};

const TABLE_SIZE: usize = 2048;

pub struct Lfo {
    sample_rate: f32,
    phase: f32,
    freq: f32,
    amplitude: f32,
    waveform: LfoWaveform,
    tables: Vec<Vec<f32>>,
    gate: f32,
    retrigger: bool,
    held_random: f32,
    cycle_count: u32,
}

#[derive(Clone, Copy)]
enum LfoWaveform {
    Sine = 0,
    Square = 1,
    Sawtooth = 2,
    Triangle = 3,
    Random = 4,
}

impl Lfo {
    pub const MANIFEST: ModuleManifest = ModuleManifest {
        id: "builtin-lfo",
        name: "LFO",
        category: "modulation",
        kind: ModuleKind::Lfo,
        inputs: &[
            PortDef { id: "fm", name: "FM", rate: PortRate::Audio },
            PortDef { id: "sync", name: "Sync", rate: PortRate::Audio },
        ],
        outputs: &[PortDef { id: "out", name: "Out", rate: PortRate::Audio }],
        parameters: &[
            ParamDef { id: "waveform", name: "Waveform", description: "The shape of the wobble.", unit: ParamUnit::Enum, min: 0.0, max: 4.0, default: 0.0, enum_values: &["sine", "square", "sawtooth", "triangle", "random"] },
            ParamDef { id: "frequency", name: "Speed (Hz)", description: "How fast the wobble happens.", unit: ParamUnit::Hz, min: 0.01, max: 100.0, default: 1.0, enum_values: &[] },
            ParamDef { id: "amplitude", name: "Depth", description: "How intense the wobble is.", unit: ParamUnit::Ratio, min: 0.0, max: 2.0, default: 1.0, enum_values: &[] },
            ParamDef { id: "retrigger", name: "Retrigger", description: "Restarts the LFO on each note.", unit: ParamUnit::Boolean, min: 0.0, max: 1.0, default: 1.0, enum_values: &["off", "on"] },
        ],
        voice_scope: super::VoiceScope::Global,
        create: |sr, _bs| Box::new(Lfo::new(sr)),
    };

    pub fn new(sample_rate: f32) -> Self {
        let mut tables = Vec::with_capacity(4);
        for w in 0..4 {
            let mut table = Vec::with_capacity(TABLE_SIZE);
            for i in 0..TABLE_SIZE {
                let phase = i as f32 / TABLE_SIZE as f32;
                let sample = match w {
                    0 => (phase * 2.0 * std::f32::consts::PI).sin(),
                    1 => {
                        if phase < 0.5 {
                            1.0
                        } else {
                            -1.0
                        }
                    }
                    2 => 2.0 * phase - 1.0,
                    3 => 1.0 - 4.0 * (phase - 0.5).abs(),
                    _ => 0.0,
                };
                table.push(sample);
            }
            tables.push(table);
        }
        Self {
            sample_rate,
            phase: 0.0,
            freq: 1.0,
            amplitude: 1.0,
            waveform: LfoWaveform::Sine,
            tables,
            gate: 0.0,
            retrigger: true,
            held_random: 0.0,
            cycle_count: 0,
        }
    }

    fn hash_noise(x: u32) -> f32 {
        let mut h = x.wrapping_mul(0x45d9f3b);
        h = (h ^ (h >> 16)).wrapping_mul(0x45d9f3b);
        h = (h ^ (h >> 16)).wrapping_mul(0x45d9f3b);
        (h & 0x7fffffff) as f32 / 0x7fffffff as f32 * 2.0 - 1.0
    }
}

impl Module for Lfo {
    fn process(&mut self, inputs: &[&[f32]], outputs: &mut [&mut [f32]], frames: usize) {
        let out = &mut outputs[0][..frames];
        let fm = if !inputs.is_empty() {
            &inputs[0][..frames]
        } else {
            &[] as &[f32]
        };
        let sync = if inputs.len() > 1 {
            &inputs[1][..frames]
        } else {
            &[] as &[f32]
        };

        for i in 0..frames {
            // Hard sync on rising gate edge
            let s = if i < sync.len() { sync[i] } else { 0.0 };
            if s > 0.5 && self.gate <= 0.5 {
                self.phase = 0.0;
            }
            self.gate = s;

            // Frequency modulation adds to the base freq
            let freq = self.freq + if i < fm.len() { fm[i] * 10.0 } else { 0.0 };
            let phase_inc = freq.max(0.001) / self.sample_rate;

            let sample = match self.waveform {
                LfoWaveform::Random => {
                    if self.phase + phase_inc >= 1.0 {
                        self.held_random = Self::hash_noise(self.cycle_count);
                        self.cycle_count += 1;
                    }
                    self.held_random
                }
                _ => {
                    let table = &self.tables[self.waveform as usize];
                    let idx_f = self.phase * TABLE_SIZE as f32;
                    let idx0 = (idx_f as usize) % TABLE_SIZE;
                    let idx1 = (idx0 + 1) % TABLE_SIZE;
                    let frac = idx_f - idx_f.floor();
                    table[idx0] + frac * (table[idx1] - table[idx0])
                }
            };

            out[i] = sample * self.amplitude;
            self.phase += phase_inc;
            if self.phase >= 1.0 {
                self.phase -= 1.0;
            }
        }
    }

    fn set_param(&mut self, index: usize, value: f32) {
        match index {
            0 => {
                self.waveform = match value as u32 {
                    0 => LfoWaveform::Sine,
                    1 => LfoWaveform::Square,
                    2 => LfoWaveform::Sawtooth,
                    3 => LfoWaveform::Triangle,
                    _ => LfoWaveform::Random,
                }
            }
            1 => self.freq = value.max(0.01).min(100.0),
            2 => self.amplitude = value.max(0.0).min(2.0),
            3 => self.retrigger = value > 0.5,
            _ => {}
        }
    }

    fn set_voice(&mut self, _freq: f32, gate: f32, _velocity: f32) {
        if self.retrigger && gate > 0.5 && self.gate <= 0.5 {
            self.phase = 0.0;
        }
        self.gate = gate;
    }

    fn num_inputs(&self) -> usize {
        2
    }
    fn num_outputs(&self) -> usize {
        1
    }
    fn kind(&self) -> ModuleKind {
        ModuleKind::Lfo
    }

    fn params(&self) -> &'static [crate::param::ParamDef] {
        Self::MANIFEST.parameters
    }
}
