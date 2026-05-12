export default {
  id: "builtin-scope",
  name: "Scope",
  plainName: "Signal Visualizer",
  description:
    "A transparent window that shows the sound wave passing through it. Doesn't change the sound — just lets you see what's happening.",
  whyUseIt:
    "Use this anywhere in your patch to visualize the waveform. Great for learning: see how an envelope shapes volume, or how a filter rounds off sharp edges.",
  category: "utility",
  kind: 4,
  inputs: [
    {
      id: "in",
      name: "In",
      description: "The signal to visualize. Passes through unchanged.",
      type: "audio",
    },
  ],
  outputs: [
    {
      id: "out",
      name: "Out",
      description:
        "The same signal, unchanged. You can patch this to the next module.",
      type: "audio",
    },
  ],
  parameters: [],
  create() {
    return null;
  },
  update() {},
  destroy() {},
};
