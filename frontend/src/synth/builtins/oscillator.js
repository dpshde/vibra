export default {
  id: "builtin-osc",
  name: "Oscillator",
  plainName: "Tone Generator",
  description:
    "Creates the raw sound wave that everything else shapes. Think of it as the 'instrument body' — it decides whether the sound starts as smooth, buzzy, hollow, or bright.",
  whyUseIt:
    "Every sound starts here. Sine is pure and flute-like. Sawtooth is bright and string-like. Square is hollow and clarinet-like. Triangle is soft and glassy.",
  category: "source",
  kind: 0,
  inputs: [],
  outputs: [
    {
      id: "out",
      name: "Out",
      description:
        "The generated waveform. Connect this to a Filter, Gain, or VCA to shape it.",
      type: "audio",
    },
  ],
  parameters: [
    {
      id: "waveform",
      name: "Waveform",
      description:
        "The basic shape of the sound wave. Sine = smooth and pure. Square = hollow and buzzy. Sawtooth = bright and full. Triangle = soft and mellow.",
      type: "enum",
      values: ["sine", "square", "sawtooth", "triangle"],
      default: "sine",
      paramId: 0,
    },
    {
      id: "frequency",
      name: "Pitch (Hz)",
      description:
        "The pitch of the note in Hertz. 440 = A4 (concert pitch). Doubling the number goes up one octave. The keyboard overrides this when you press a key.",
      type: "float",
      min: 20,
      max: 20000,
      step: 1,
      default: 440,
      paramId: 1,
    },
    {
      id: "detune",
      name: "Detune (cents)",
      description:
        "Slight pitch offset in cents (100 cents = 1 semitone). Use small values (+/- 5) for subtle thickening. Use larger values for dissonant effects.",
      type: "float",
      min: -100,
      max: 100,
      step: 1,
      default: 0,
      paramId: 2,
    },
  ],
  create() {
    return null;
  },
  update(node, params) {
    if (!node) return;
    if (node.type !== params.waveform) node.type = params.waveform;
    node.frequency.setValueAtTime(params.frequency, node.context.currentTime);
    node.detune.setValueAtTime(params.detune, node.context.currentTime);
  },
  destroy(node) {
    if (!node) return;
    node.stop();
    node.disconnect();
  },
};
