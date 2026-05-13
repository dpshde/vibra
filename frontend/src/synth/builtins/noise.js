export default {
  id: "builtin-noise",
  name: "Noise",
  plainName: "Noise / Hiss",
  description:
    "Generates random static — the sound of rushing air, ocean surf, or radio hiss. Essential for percussion, sound effects, and textural layers.",
  whyUseIt:
    "Use white noise through a short envelope for snare drums and hi-hats. Use filtered noise for wind, rain, or steam effects. Layer quietly under oscillators for grit and texture.",
  category: "source",
  kind: 7,
  inputs: [],
  outputs: [
    {
      id: "out",
      name: "Out",
      description:
        "The noise signal. Connect to a Filter to shape the color, then to a VCA to gate it into percussion.",
      signalType: "audio",
      accepts: [],
    },
  ],
  parameters: [
    {
      id: "color",
      name: "Color",
      description:
        "0 = pure white noise (all frequencies equal, bright and harsh). 1 = darker noise with less high-frequency energy. Somewhere in between for balanced hiss.",
      type: "float",
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.0,
      paramId: 0,
    },
  ],
  create() {
    return null;
  },
  update() {},
  destroy() {},
};
