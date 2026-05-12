export default {
  id: "builtin-env",
  name: "Envelope",
  plainName: "Volume Shape (ADSR)",
  description:
    "Shapes how loud a sound is over time — from the moment a key is pressed to when it's released. Turns boring drones into musical notes like plucks, pads, or drums.",
  whyUseIt:
    "Without this, sounds play forever at full volume. With it, you get punchy plucks, swelling pads, and rhythmic gates.",
  category: "modulation",
  kind: 3,
  inputs: [
    {
      id: "gate",
      name: "Gate",
      description:
        "Optional override for the keyboard gate. If left unconnected, the keyboard automatically triggers this envelope when you press a key.",
      type: "audio",
    },
  ],
  outputs: [
    {
      id: "out",
      name: "Out",
      description:
        "Outputs a control signal from 0 to 1 that follows the envelope shape. Connect this to a Multiplier (VCA) to shape volume, or to Filter to shape brightness.",
      type: "audio",
    },
  ],
  parameters: [
    {
      id: "attack",
      name: "Attack",
      description: "How quickly the sound rises from silence to full volume after a key is pressed. Short = instant pluck. Long = slow fade-in.",
      type: "float",
      min: 0.001,
      max: 5.0,
      step: 0.001,
      default: 0.01,
      paramId: 0,
    },
    {
      id: "decay",
      name: "Decay",
      description: "How quickly the sound falls from peak volume down to the Sustain level. Short = sharp percussive hit. Long = gentle drift.",
      type: "float",
      min: 0.001,
      max: 5.0,
      step: 0.001,
      default: 0.3,
      paramId: 1,
    },
    {
      id: "sustain",
      name: "Sustain",
      description: "The volume level held while a key is kept pressed. 0 = sound dies during hold (good for drums). 1 = stays at full volume (good for organs).",
      type: "float",
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.5,
      paramId: 2,
    },
    {
      id: "release",
      name: "Release",
      description: "How long the sound takes to fade to silence after a key is released. Short = abrupt stop. Long = dreamy tail.",
      type: "float",
      min: 0.001,
      max: 10.0,
      step: 0.001,
      default: 0.5,
      paramId: 3,
    },
  ],
  create() {
    return null;
  },
  update() {},
  destroy() {},
};
