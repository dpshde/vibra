use core::cell::UnsafeCell;
use core::sync::atomic::{AtomicU32, Ordering};

const PARAM_QUEUE_SIZE: usize = 256;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ParamUnit {
    Hz,
    Khz,
    Ms,
    S,
    Db,
    Percent,
    Semitones,
    Cents,
    Ratio,
    MidiNote,
    Enum,
    Boolean,
    None,
}

impl ParamUnit {
    pub fn as_str(&self) -> &'static str {
        match self {
            ParamUnit::Hz => "hz",
            ParamUnit::Khz => "khz",
            ParamUnit::Ms => "ms",
            ParamUnit::S => "s",
            ParamUnit::Db => "db",
            ParamUnit::Percent => "percent",
            ParamUnit::Semitones => "semitones",
            ParamUnit::Cents => "cents",
            ParamUnit::Ratio => "ratio",
            ParamUnit::MidiNote => "midiNote",
            ParamUnit::Enum => "enum",
            ParamUnit::Boolean => "boolean",
            ParamUnit::None => "none",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ParamDef {
    pub id: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub unit: ParamUnit,
    pub min: f32,
    pub max: f32,
    pub default: f32,
    pub enum_values: &'static [&'static str],
}

#[derive(Debug, Clone, Copy)]
pub struct ParamChange {
    pub module_id: u32,
    pub param_id: u32,
    pub value: f32,
}

/// Lock-free single-producer single-consumer ring buffer for parameter
/// changes.  The audio thread is the only consumer; any thread can push.
pub struct ParamQueue {
    buffer: UnsafeCell<[ParamChange; PARAM_QUEUE_SIZE]>,
    head: AtomicU32,
    tail: AtomicU32,
}

// Safety: ParamQueue is designed for single-producer / single-consumer
// access. The caller must ensure only one thread writes and one thread reads.
unsafe impl Sync for ParamQueue {}
unsafe impl Send for ParamQueue {}

impl Default for ParamQueue {
    fn default() -> Self {
        Self::new()
    }
}

impl ParamQueue {
    pub fn new() -> Self {
        Self {
            buffer: UnsafeCell::new([ParamChange {
                module_id: 0,
                param_id: 0,
                value: 0.0,
            }; PARAM_QUEUE_SIZE]),
            head: AtomicU32::new(0),
            tail: AtomicU32::new(0),
        }
    }

    pub fn push(&self, change: ParamChange) -> bool {
        let tail = self.tail.load(Ordering::Relaxed);
        let next = (tail + 1) % PARAM_QUEUE_SIZE as u32;
        if next == self.head.load(Ordering::Acquire) {
            return false; // full
        }
        // Safety: only the producer thread calls push.
        unsafe {
            (*self.buffer.get())[tail as usize] = change;
        }
        self.tail.store(next, Ordering::Release);
        true
    }

    pub fn drain(&self, mut f: impl FnMut(ParamChange)) {
        let head = self.head.load(Ordering::Relaxed);
        let tail = self.tail.load(Ordering::Acquire);
        let mut idx = head;
        while idx != tail {
            // Safety: only the consumer thread calls drain.
            let change = unsafe { (*self.buffer.get())[idx as usize] };
            f(change);
            idx = (idx + 1) % PARAM_QUEUE_SIZE as u32;
        }
        self.head.store(idx, Ordering::Release);
    }
}

/// Per-parameter linear smoothing.  Call `next()` every sample to get the
/// current (possibly interpolated) value.
pub struct SmoothedParam {
    pub target: f32,
    pub current: f32,
    /// Smoothing coefficient per sample: 1.0 = instant, 0.001 ≈ 1.5ms at 48kHz
    coeff: f32,
}

impl SmoothedParam {
    pub fn new(default: f32, coeff: f32) -> Self {
        Self {
            target: default,
            current: default,
            coeff,
        }
    }

    pub fn set_target(&mut self, value: f32) {
        self.target = value;
    }

    pub fn next(&mut self) -> f32 {
        self.current += self.coeff * (self.target - self.current);
        self.current
    }

    pub fn reset(&mut self) {
        self.current = self.target;
    }
}
