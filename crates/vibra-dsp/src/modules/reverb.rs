use super::{Module, ModuleKind, ModuleManifest, ParamDef, PortDef, SignalType, ParamUnit};

const NUM_COMBS: usize = 8;
const NUM_ALLPASSES: usize = 4;

// Comb filter delay lengths in samples at 44100 Hz (scaled at runtime).
// Classic Freeverb lengths provide dense echo distribution.
const COMB_DELAYS: [usize; NUM_COMBS] = [1116, 1188, 1277, 1356, 1422, 1491, 1617, 1557];
// Allpass delay lengths in samples at 44100 Hz
const ALLPASS_DELAYS: [usize; NUM_ALLPASSES] = [225, 341, 441, 556];

struct CombFilter {
    buffer: Vec<f32>,
    write_pos: usize,
    delay: usize,
    feedback: f32,
    filter_state: f32,
    damp: f32,
    damp_inv: f32,
}

impl CombFilter {
    fn new(delay: usize, sample_rate: f32) -> Self {
        let scaled = ((delay as f32) * (sample_rate / 44100.0)).ceil() as usize;
        let delay = scaled.max(1);
        Self {
            buffer: vec![0.0; delay],
            write_pos: 0,
            delay,
            feedback: 0.5,
            filter_state: 0.0,
            damp: 0.5,
            damp_inv: 0.5,
        }
    }

    fn set_params(&mut self, feedback: f32, damp: f32) {
        self.feedback = feedback;
        self.damp = damp;
        self.damp_inv = 1.0 - damp;
    }

    fn process(&mut self, input: f32) -> f32 {
        let read_pos = (self.write_pos + self.buffer.len() - self.delay) % self.buffer.len();
        let output = self.buffer[read_pos];

        self.filter_state = output * self.damp_inv + self.filter_state * self.damp;
        self.buffer[self.write_pos] = input + self.filter_state * self.feedback;
        self.write_pos = (self.write_pos + 1) % self.buffer.len();

        output
    }
}

struct AllpassFilter {
    buffer: Vec<f32>,
    write_pos: usize,
    delay: usize,
    feedback: f32,
}

impl AllpassFilter {
    fn new(delay: usize, sample_rate: f32) -> Self {
        let scaled = ((delay as f32) * (sample_rate / 44100.0)).ceil() as usize;
        let delay = scaled.max(1);
        Self {
            buffer: vec![0.0; delay],
            write_pos: 0,
            delay,
            feedback: 0.5,
        }
    }

    fn process(&mut self, input: f32) -> f32 {
        let read_pos = (self.write_pos + self.buffer.len() - self.delay) % self.buffer.len();
        let buf_out = self.buffer[read_pos];
        let output = buf_out - input * self.feedback;
        self.buffer[self.write_pos] = input + buf_out * self.feedback;
        self.write_pos = (self.write_pos + 1) % self.buffer.len();
        output
    }
}

pub struct Reverb {
    combs: [CombFilter; NUM_COMBS],
    allpasses: [AllpassFilter; NUM_ALLPASSES],
    room_size: f32,
    damp: f32,
    wet: f32,
    dry: f32,
    input_gain: f32,
    dc_blocker_x1: f32,
    dc_blocker_y1: f32,
    wet_filter_state: f32,
}

impl Reverb {
    pub const MANIFEST: ModuleManifest = ModuleManifest {
        id: "builtin-reverb",
        name: "Reverb",
        category: "effect",
        kind: ModuleKind::Reverb,
        inputs: &[PortDef { id: "in", name: "In", signal_type: SignalType::Audio, accepts: &[SignalType::Audio] }],
        outputs: &[PortDef { id: "out", name: "Out", signal_type: SignalType::Audio, accepts: &[] }],
        parameters: &[
            ParamDef { id: "size", name: "Room Size", description: "How large the simulated room is. Larger = longer decay, more spacious.", unit: ParamUnit::Ratio, min: 0.0, max: 1.0, default: 0.5, enum_values: &[] },
            ParamDef { id: "damp", name: "Damp", description: "High-frequency damping. Higher = darker, more muffled reverb.", unit: ParamUnit::Ratio, min: 0.0, max: 1.0, default: 0.5, enum_values: &[] },
            ParamDef { id: "mix", name: "Mix", description: "Balance between dry and wet signal.", unit: ParamUnit::Ratio, min: 0.0, max: 1.0, default: 0.2, enum_values: &[] },
        ],
        voice_scope: super::VoiceScope::Global,
        create: |sr, _bs| Box::new(Reverb::new(sr)),
    };

    pub fn new(sample_rate: f32) -> Self {
        let combs = [
            CombFilter::new(COMB_DELAYS[0], sample_rate),
            CombFilter::new(COMB_DELAYS[1], sample_rate),
            CombFilter::new(COMB_DELAYS[2], sample_rate),
            CombFilter::new(COMB_DELAYS[3], sample_rate),
            CombFilter::new(COMB_DELAYS[4], sample_rate),
            CombFilter::new(COMB_DELAYS[5], sample_rate),
            CombFilter::new(COMB_DELAYS[6], sample_rate),
            CombFilter::new(COMB_DELAYS[7], sample_rate),
        ];
        let allpasses = [
            AllpassFilter::new(ALLPASS_DELAYS[0], sample_rate),
            AllpassFilter::new(ALLPASS_DELAYS[1], sample_rate),
            AllpassFilter::new(ALLPASS_DELAYS[2], sample_rate),
            AllpassFilter::new(ALLPASS_DELAYS[3], sample_rate),
        ];
        let mut r = Self {
            combs,
            allpasses,
            room_size: 0.5,
            damp: 0.5,
            wet: 0.2,
            dry: 0.8,
            input_gain: 0.015,
            dc_blocker_x1: 0.0,
            dc_blocker_y1: 0.0,
            wet_filter_state: 0.0,
        };
        r.update_params();
        r
    }

    fn update_params(&mut self) {
        // Much gentler feedback for a tighter, musical synth reverb tail.
        // size=0 -> feedback=0.45, size=1 -> feedback=0.65.
        let feedback = (self.room_size * 0.20 + 0.45).min(0.65);
        // Damping scaled to the range Freeverb expects.
        let damp = self.damp * 0.4 + 0.2;
        for c in &mut self.combs {
            c.set_params(feedback, damp);
        }
    }
}

impl Module for Reverb {
    fn process(&mut self, inputs: &[&[f32]], outputs: &mut [&mut [f32]], frames: usize) {
        let inp = &inputs[0][..frames];
        let out = &mut outputs[0][..frames];

        for i in 0..frames {
            // Scale input down to prevent comb overload.
            let input = inp[i] * self.input_gain;

            let mut comb_sum = 0.0;
            for c in &mut self.combs {
                comb_sum += c.process(input);
            }

            let mut allpass_out = comb_sum;
            for ap in &mut self.allpasses {
                allpass_out = ap.process(allpass_out);
            }

            // One-pole lowpass on wet path to darken and shorten the tail.
            self.wet_filter_state += 0.15 * (allpass_out - self.wet_filter_state);

            // DC blocker on wet path to stop any offset accumulation.
            let dc_blocked = self.wet_filter_state - self.dc_blocker_x1 + 0.995 * self.dc_blocker_y1;
            self.dc_blocker_x1 = self.wet_filter_state;
            self.dc_blocker_y1 = dc_blocked;

            out[i] = inp[i] * self.dry + dc_blocked * self.wet;
        }
    }

    fn set_param(&mut self, index: usize, value: f32) {
        match index {
            0 => { self.room_size = value.max(0.0).min(1.0); self.update_params(); }
            1 => { self.damp = value.max(0.0).min(1.0); self.update_params(); }
            2 => { self.wet = value.max(0.0).min(1.0); self.dry = 1.0 - self.wet; }
            _ => {}
        }
    }

    fn set_voice(&mut self, _freq: f32, _gate: f32, _velocity: f32) {}
    fn num_inputs(&self) -> usize { 1 }
    fn num_outputs(&self) -> usize { 1 }
    fn kind(&self) -> ModuleKind { ModuleKind::Reverb }

    fn params(&self) -> &'static [crate::param::ParamDef] {
        Self::MANIFEST.parameters
    }
}
