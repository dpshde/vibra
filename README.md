# Vibra

A hackable digital modular synthesizer built with [zero-native](https://zero-native.dev) (Zig native shell + web UI). Inspired by the plugin philosophy of [zenbu.js](https://zenbu.dev).

## Architecture

- **Native shell**: Zig + zero-native provides a tiny desktop runtime (system WebView or Chromium/CEF).
- **Web UI**: Vite + vanilla JS. The entire synth UI, patch graph, and module engine lives in the frontend.
- **Audio engine**: Web Audio API with a modular patch bay. Each module wraps one or more Web Audio nodes.
- **Plugin SDK**: Dead-simple JS manifest for new modules. Drop a `.js` file into `frontend/src/plugins/` (or load dynamically) and it registers automatically.

## Quick Start

```sh
zig build dev     # dev mode with hot reload
zig build run     # production build + run
zig build package # package for distribution
```

## Plugin SDK

A Vibra plugin is a single JS module exporting a manifest:

```javascript
export default {
  id: 'my-osc',
  name: 'My Oscillator',
  category: 'source',
  inputs: ['freq', 'fm'],
  outputs: ['out'],
  parameters: [
    { id: 'waveform', type: 'enum', values: ['sine', 'square', 'sawtooth', 'triangle'], default: 'sine' },
    { id: 'detune', type: 'float', min: -100, max: 100, default: 0 }
  ],
  create(audioContext) {
    const node = audioContext.createOscillator();
    node.start();
    return node;
  },
  update(node, params) {
    node.type = params.waveform;
    node.detune.value = params.detune;
  },
  destroy(node) {
    node.stop();
  }
};
```

The patch bay handles connections automatically using Web Audio's `connect()` / `disconnect()`.

## Built-in Modules

| Module | Category | Description |
|--------|----------|-------------|
| Oscillator | Source | Sine, square, sawtooth, triangle with detune |
| Gain | Utility | VCA / attenuator with gain param |
| Filter | Effect | Biquad filter (lowpass, highpass, etc.) |
| Scope | Utility | Real-time oscilloscope visualization |
| Destination | Output | Master output to speakers |

## Patch Graph

Modules are arranged on a canvas. Drag from an output port to an input port to connect. Drag the module header to move. Right-click a module to remove it. The current patch can be serialized to JSON and reloaded.

## Native Bridge

A minimal JS-to-Zig bridge is wired up in `src/main.zig`. Extend the `bridge_handlers` array to add native file-system commands for saving/loading patches or scanning user plugin directories.

From the frontend, invoke the bridge with:

```javascript
if (window.zero) {
  const result = await window.zero.invoke('echo', JSON.stringify({ message: 'hello' }));
  console.log(result);
}
```

## License

MIT
