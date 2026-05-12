export default {
  id: "builtin-destination",
  name: "Destination",
  plainName: "Speakers / Output",
  description:
    "The final stop before sound reaches your ears. Every patch needs this. Whatever you connect here is what you hear.",
  whyUseIt:
    "Required for every patch. Connect your last module (usually a VCA, Gain, or Filter) to this. Without it, the patch is silent.",
  category: "output",
  kind: 5,
  inputs: [
    {
      id: "in",
      name: "In",
      description: "Connect your final mixed sound here.",
      type: "audio",
    },
  ],
  outputs: [],
  parameters: [],
  create() {
    return null;
  },
  update() {},
  destroy() {},
};
