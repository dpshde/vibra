export default {
  id: "builtin-reverb",
  name: "Reverb",
  plainName: "Reverb / Space",
  description:
    "Creates the illusion of space around a sound, as if it were played in a room, hall, or cave. Adds depth, atmosphere, and realism to dry patches.",
  whyUseIt:
    "Turns a sterile synth sound into something that breathes. Essential for pads, leads, and any patch that feels too 'in your face'.",
  category: "effect",
  kind: 11,
  inputs: [
    {
      id: "in",
      name: "In",
      description: "The sound to add space to.",
      type: "audio",
    },
  ],
  outputs: [
    {
      id: "out",
      name: "Out",
      description: "The original sound mixed with its reverberated reflections.",
      type: "audio",
    },
  ],
  parameters: [
    {
      id: "size",
      name: "Room Size",
      description: "How large the simulated room is. Small = tight, short reflections like a closet. Large = huge, long decay like a cathedral.",
      type: "float",
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.5,
      paramId: 0,
    },
    {
      id: "damp",
      name: "Damp",
      description: "High-frequency damping. Low = bright, shimmering reverb. High = dark, muffled reverb as if the room has lots of soft furnishings.",
      type: "float",
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.5,
      paramId: 1,
    },
    {
      id: "mix",
      name: "Mix",
      description: "How loud the reverb is compared to the original sound. 0 = no reverb. 0.5 = equal blend. 1 = only reverb tail.",
      type: "float",
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.2,
      paramId: 2,
    },
  ],
  create() {
    return null;
  },
  update() {},
  destroy() {},
};
