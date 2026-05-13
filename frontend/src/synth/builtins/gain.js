export default {
  id: "builtin-gain",
  name: "Gain",
  plainName: "Volume / Amplifier",
  description:
    "A simple volume control. Use it to turn a sound up or down, or to prevent clipping when many sounds are mixed together.",
  whyUseIt:
    "The final stage before the speakers. If your patch is too quiet, add this and turn it up. If it's distorting, turn it down. Also useful for mixing multiple sounds.",
  category: "utility",
  kind: 1,
  inputs: [
    {
      id: "in",
      name: "In",
      description: "The sound to amplify or attenuate.",
      signalType: "audio",
      accepts: ["audio"],
    },
  ],
  outputs: [
    {
      id: "out",
      name: "Out",
      description: "The sound at the new volume level.",
      signalType: "audio",
      accepts: [],
    },
  ],
  parameters: [
    {
      id: "gain",
      name: "Volume",
      description:
        "Volume multiplier. 0 = silence. 0.5 = half volume. 1 = normal. 2 = double (may distort).",
      type: "float",
      min: 0,
      max: 2,
      step: 0.01,
      default: 1.0,
      paramId: 0,
    },
  ],
  create() {
    return null;
  },
  update() {},
  destroy() {},
};
