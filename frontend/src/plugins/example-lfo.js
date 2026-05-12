/**
 * Example Vibra Plugin: Simple LFO (control-rate)
 *
 * In the Rust engine architecture, JS plugins without a `kind` field are
 * control-rate only — they run on the main thread and can send parameter
 * changes via the patch bay. Audio-rate DSP lives in Rust/Wasm.
 */

export default {
  id: "example-lfo",
  name: "LFO",
  category: "source",
  inputs: [],
  outputs: [],
  parameters: [
    {
      id: "frequency",
      name: "Rate",
      type: "float",
      min: 0.1,
      max: 20,
      step: 0.1,
      default: 2,
    },
  ],
  create() {
    // Control-rate plugin: no audio node needed
    return null;
  },
  update(node, params) {
    // Here you could schedule parameter modulations on other modules
    // via the global patchBay reference, or emit events.
    // For now, just log the rate change.
    // console.log('LFO rate:', params.frequency);
  },
  destroy() {},
};
