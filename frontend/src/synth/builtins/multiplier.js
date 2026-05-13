export default {
  id: "builtin-mult",
  name: "Multiplier",
  plainName: "VCA / Amplitude Modulator",
  description:
    "Multiplies two signals together. Its superpower is combining audio with a control signal (like an envelope or LFO) to shape volume or create rhythmic effects.",
  whyUseIt:
    "This is how you make an envelope control loudness: patch your sound into A, and an Envelope into B. The envelope's shape will sculpt the sound's volume.",
  category: "utility",
  kind: 9,
  inputs: [
    {
      id: "a",
      name: "Sound (A)",
      description: "The main audio signal — usually an oscillator or noise.",
      signalType: "audio",
      accepts: ["audio"],
    },
    {
      id: "b",
      name: "Mod (B)",
      description: "The control signal — usually an Envelope or LFO. This gets multiplied with the sound to shape it.",
      signalType: "level",
      accepts: ["level", "modulation"],
    },
  ],
  outputs: [
    {
      id: "out",
      name: "Out",
      description: "The multiplied result. If B is an envelope, this output will be the shaped sound.",
      signalType: "audio",
      accepts: [],
    },
  ],
  parameters: [
    {
      id: "gain",
      name: "Boost",
      description: "Extra volume boost after multiplication. Use if the result is too quiet.",
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
