export default {
  id: "builtin-filter",
  name: "Filter",
  plainName: "Brightness / Filter",
  description:
    "Sculpts the tone by removing certain frequencies. Like an EQ with personality — it can make a sound dark and muffled, thin and airy, or focused and nasal.",
  whyUseIt:
    "Sawtooth and square waves are very bright. A Lowpass filter tames the harshness for warm pads. A Highpass filter removes rumble for crisp percussion.",
  category: "effect",
  kind: 2,
  inputs: [
    {
      id: "in",
      name: "In",
      description: "The sound to shape.",
      signalType: "audio",
      accepts: ["audio"],
    },
  ],
  outputs: [
    {
      id: "out",
      name: "Out",
      description: "The shaped sound with frequencies removed.",
      signalType: "audio",
      accepts: [],
    },
  ],
  parameters: [
    {
      id: "frequency",
      name: "Cutoff",
      description:
        "The frequency where filtering begins. Low values = darker, muffled sound. High values = brighter, more open sound.",
      type: "float",
      min: 20,
      max: 20000,
      step: 1,
      default: 1000,
      paramId: 0,
    },
    {
      id: "resonance",
      name: "Peak (Res)",
      description:
        "Boosts the frequencies right at the cutoff point. Low = smooth, gentle filter. High = sharp, ringing peak that screams or whistles.",
      type: "float",
      min: 0.01,
      max: 10,
      step: 0.01,
      default: 0.7,
      paramId: 1,
    },
    {
      id: "type",
      name: "Type",
      description:
        "Lowpass = keeps low frequencies, removes highs (warm, dark). Highpass = keeps highs, removes lows (thin, crisp). Bandpass = keeps only a narrow band (nasal, focused).",
      type: "enum",
      values: ["lowpass", "highpass", "bandpass"],
      default: "lowpass",
      paramId: 2,
    },
  ],
  create() {
    return null;
  },
  update() {},
  destroy() {},
};
