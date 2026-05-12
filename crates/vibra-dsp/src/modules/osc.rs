use super::{Module, ModuleKind};

const TABLE_SIZE: usize = 2048;

pub struct Oscillator {
    sample_rate: f32,
    phase: f32,
    freq: f32,
    detune: f32,
    waveform: Waveform,
    tables: Vec<Vec<f32>>,
}

#[derive(Clone, Copy)]
enum Waveform {
    Sine = 0,
    Square = 1,
    Sawtooth = 2,
    Triangle = 3,
}

impl Oscillator {
    pub fn new(sample_rate: f32) -> Self {
        let mut tables = Vec::with_capacity(4);
        for w in 0..4 {
            let mut table = Vec::with_capacity(TABLE_SIZE);
            for i in 0..TABLE_SIZE {
                let phase = i as f32 / TABLE_SIZE as f32;
                let sample = match w {
                    0 => (phase * 2.0 * std::f32::consts::PI).sin(),
                    1 => if phase < 0.5 { 1.0 } else { -1.0 },
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
            freq: 440.0,
            detune: 0.0,
            waveform: Waveform::Sine,
            tables,
        }
    }
}

impl Module for Oscillator {
    fn process(&mut self, _inputs: &[&[f32]], outputs: &mut [&mut [f32]], frames: usize) {
        let out = &mut outputs[0][..frames];
        let table = &self.tables[self.waveform as usize];
        let freq = self.freq + self.detune;
        let phase_inc = freq / self.sample_rate;

        for i in 0..frames {
            let idx_f = self.phase * TABLE_SIZE as f32;
            let idx0 = (idx_f as usize) % TABLE_SIZE;
            let idx1 = (idx0 + 1) % TABLE_SIZE;
            let frac = idx_f - idx_f.floor();
            let sample = table[idx0] + frac * (table[idx1] - table[idx0]);
            out[i] = sample;
            self.phase += phase_inc;
            if self.phase >= 1.0 {
                self.phase -= 1.0;
            }
        }
    }

    fn set_param(&mut self, index: usize, value: f32) {
        match index {
            0 => self.waveform = match value as u32 {
                0 => Waveform::Sine,
                1 => Waveform::Square,
                2 => Waveform::Sawtooth,
                _ => Waveform::Triangle,
            },
            1 => self.freq = value.max(20.0).min(20000.0),
            2 => self.detune = value,
            _ => {}
        }
    }

    fn set_voice(&mut self, freq: f32, _gate: f32, _velocity: f32) {
        self.freq = freq;
    }

    fn num_inputs(&self) -> usize { 0 }
    fn num_outputs(&self) -> usize { 1 }
    fn kind(&self) -> ModuleKind { ModuleKind::Oscillator }
}
