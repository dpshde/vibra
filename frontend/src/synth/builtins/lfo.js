export default {
  id: "builtin-lfo",
  name: "LFO",
  plainName: "Slow Wobbler (LFO)",
  description:
    "A slow oscillator that creates movement and animation — like an invisible hand turning a knob up and down automatically. Makes static sounds breathe, pulse, or tremble.",
  whyUseIt:
    "Patch this into a VCA's modulation input for tremolo. Patch into a Filter for wah-wah effects. Use random waveform for unpredictable, organic movement.",
  category: "modulation",
  kind: 6,
  inputs: [
    {
      id: "fm",
      name: "FM",
      description:
        "Frequency Modulation input. An audio signal here warps the LFO's speed in real time.",
      type: "audio",
    },
    {
      id: "sync",
      name: "Sync",
      description:
        "Reset trigger. A spike here restarts the LFO waveform from the beginning, great for rhythmic locking.",
      type: "audio",
    },
  ],
  outputs: [
    {
      id: "out",
      name: "Out",
      description:
        "The slow waveform output. Connect to a VCA/Multiplier or any modulation input to create movement.",
      type: "audio",
    },
  ],
  parameters: [
    {
      id: "waveform",
      name: "Waveform",
      description:
        "The shape of the wobble. Sine = smooth breathing. Square = abrupt on/off. Sawtooth = ramp up / snap down. Random = unpredictable steps (sample-and-hold).",
      type: "enum",
      values: ["sine", "square", "sawtooth", "triangle", "random"],
      default: "sine",
      paramId: 0,
    },
    {
      id: "frequency",
      name: "Speed (Hz)",
      description:
        "How fast the wobble happens. 0.1 = one cycle every 10 seconds (very slow). 5 = rapid tremolo/vibrato. 20+ approaches audible range.",
      type: "float",
      min: 0.01,
      max: 100,
      step: 0.01,
      default: 1.0,
      paramId: 1,
    },
    {
      id: "amplitude",
      name: "Depth",
      description:
        "How intense the wobble is. 0 = no effect. 1 = full range. Above 1 = extreme, possibly distorted modulation.",
      type: "float",
      min: 0,
      max: 2,
      step: 0.01,
      default: 1.0,
      paramId: 2,
    },
    {
      id: "retrigger",
      name: "Retrigger",
      description:
        "If ON, the LFO restarts from zero every time a key is pressed. Great for consistent, rhythmic effects on each note.",
      type: "enum",
      values: ["off", "on"],
      default: "off",
      paramId: 3,
    },
  ],
  create() {
    return null;
  },
  update() {},
  destroy() {},
};
