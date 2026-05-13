use super::{Module, ModuleKind, ModuleManifest, ParamDef, PortDef, SignalType, ParamUnit};

pub struct BiquadFilter {
    sample_rate: f32,
    freq: f32,
    res: f32,
    ftype: FilterType,
    coeffs: BiquadCoeffs,
    z1: f32,
    z2: f32,
}

#[derive(Clone, Copy)]
enum FilterType {
    LowPass = 0,
    HighPass = 1,
    BandPass = 2,
}

struct BiquadCoeffs {
    a1: f32,
    a2: f32,
    b0: f32,
    b1: f32,
    b2: f32,
}

impl BiquadFilter {
    pub const MANIFEST: ModuleManifest = ModuleManifest {
        id: "builtin-filter",
        name: "Filter",
        category: "effect",
        kind: ModuleKind::Filter,
        inputs: &[PortDef { id: "in", name: "In", signal_type: SignalType::Audio, accepts: &[SignalType::Audio] }],
        outputs: &[PortDef { id: "out", name: "Out", signal_type: SignalType::Audio, accepts: &[] }],
        parameters: &[
            ParamDef { id: "frequency", name: "Cutoff", description: "The frequency where filtering begins.", unit: ParamUnit::Hz, min: 20.0, max: 20000.0, default: 1000.0, enum_values: &[] },
            ParamDef { id: "resonance", name: "Peak (Res)", description: "Boosts the frequencies right at the cutoff point.", unit: ParamUnit::Ratio, min: 0.01, max: 10.0, default: 0.7, enum_values: &[] },
            ParamDef { id: "type", name: "Type", description: "Filter response type.", unit: ParamUnit::Enum, min: 0.0, max: 2.0, default: 0.0, enum_values: &["lowpass", "highpass", "bandpass"] },
        ],
        voice_scope: super::VoiceScope::PerVoice,
        create: |sr, _bs| Box::new(BiquadFilter::new(sr)),
    };

    pub fn new(sample_rate: f32) -> Self {
        let freq = 1000.0;
        let res = 0.7;
        let ftype = FilterType::LowPass;
        let coeffs = Self::calc(freq, res, ftype, sample_rate);
        Self {
            sample_rate,
            freq,
            res,
            ftype,
            coeffs,
            z1: 0.0,
            z2: 0.0,
        }
    }

    fn calc(freq: f32, res: f32, ftype: FilterType, sr: f32) -> BiquadCoeffs {
        let w0 = 2.0 * std::f32::consts::PI * freq / sr;
        let cos_w0 = w0.cos();
        let sin_w0 = w0.sin();
        let alpha = sin_w0 / (2.0 * res);
        let a0 = 1.0 + alpha;
        let a1 = -2.0 * cos_w0;
        let a2 = 1.0 - alpha;
        let (b0, b1, b2) = match ftype {
            FilterType::LowPass => (
                (1.0 - cos_w0) / 2.0,
                1.0 - cos_w0,
                (1.0 - cos_w0) / 2.0,
            ),
            FilterType::HighPass => (
                (1.0 + cos_w0) / 2.0,
                -(1.0 + cos_w0),
                (1.0 + cos_w0) / 2.0,
            ),
            FilterType::BandPass => (
                alpha,
                0.0,
                -alpha,
            ),
        };
        BiquadCoeffs {
            a1: a1 / a0,
            a2: a2 / a0,
            b0: b0 / a0,
            b1: b1 / a0,
            b2: b2 / a0,
        }
    }

    fn update_coeffs(&mut self) {
        self.coeffs = Self::calc(self.freq, self.res, self.ftype, self.sample_rate);
    }
}

impl Module for BiquadFilter {
    fn process(&mut self, inputs: &[&[f32]], outputs: &mut [&mut [f32]], frames: usize) {
        let inp = &inputs[0][..frames];
        let out = &mut outputs[0][..frames];
        let c = &self.coeffs;
        for i in 0..frames {
            let x = inp[i];
            let y = c.b0 * x + c.b1 * self.z1 + c.b2 * self.z2 - c.a1 * self.z1 - c.a2 * self.z2;
            self.z2 = self.z1;
            self.z1 = y;
            out[i] = y;
        }
    }

    fn set_param(&mut self, index: usize, value: f32) {
        match index {
            0 => { self.freq = value.max(20.0).min(self.sample_rate * 0.49); self.update_coeffs(); }
            1 => { self.res = value.max(0.01).min(10.0); self.update_coeffs(); }
            2 => { self.ftype = match value as u32 { 0 => FilterType::LowPass, 1 => FilterType::HighPass, _ => FilterType::BandPass }; self.update_coeffs(); }
            _ => {}
        }
    }

    fn set_voice(&mut self, _freq: f32, _gate: f32, _velocity: f32) {}
    fn num_inputs(&self) -> usize { 1 }
    fn num_outputs(&self) -> usize { 1 }
    fn kind(&self) -> ModuleKind { ModuleKind::Filter }

    fn params(&self) -> &'static [crate::param::ParamDef] {
        Self::MANIFEST.parameters
    }
}
