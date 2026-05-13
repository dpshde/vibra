export default {
  id: "builtin-delay",
  name: "Delay",
  plainName: "Echo / Delay",
  description:
    "Repeats the incoming sound after a set amount of time, creating echo and space. Great for adding depth, rhythm, and atmosphere to any sound.",
  whyUseIt:
    "Turns a dry sound into something spacious. Use low feedback for a single echo, high feedback for infinite looping textures.",
  category: "effect",
  kind: 8,
  inputs: [
    {
      id: "in",
      name: "In",
      description: "The sound to echo.",
      signalType: "audio",
      accepts: ["audio"],
    },
  ],
  outputs: [
    {
      id: "out",
      name: "Out",
      description: "The original sound mixed with its echoes.",
      signalType: "audio",
      accepts: [],
    },
  ],
  parameters: [
    {
      id: "delay_ms",
      name: "Time",
      description: "How long to wait before the echo plays. Short times (50-200ms) create slapback. Long times (300-800ms) create rhythmic echoes.",
      type: "float",
      min: 1,
      max: 5000,
      step: 1,
      default: 250,
      paramId: 0,
    },
    {
      id: "feedback",
      name: "Feedback",
      description: "How much of each echo gets fed back into the delay. Low = one echo. High = many repeating echoes. Be careful above 0.9 — it can get loud!",
      type: "float",
      min: 0,
      max: 0.99,
      step: 0.01,
      default: 0.3,
      paramId: 1,
    },
    {
      id: "mix",
      name: "Mix",
      description: "How loud the echoes are compared to the original sound. 0 = no echo. 0.5 = equal blend. 1 = only echoes.",
      type: "float",
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.5,
      paramId: 2,
    },
  ],
  create() {
    return null;
  },
  update() {},
  destroy() {},
};
