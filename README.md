# Vibra

A hackable digital modular synthesizer. DSP core in **Rust → WebAssembly**, UI in **Vite + vanilla JS**, audio boundary via **AudioWorklet**.

## Philosophy

Vibra is designed to be tiny, composable, and easy to extend. The hard real-time audio engine lives in Rust compiled to Wasm and runs inside an `AudioWorkletProcessor`, keeping it isolated from the UI thread. The patching interface, module palette, and plugin SDK remain in familiar web tech.

## Architecture

| Layer | Tech | Responsibility |
|-------|------|--------------|
| DSP Engine | Rust (`vibra_dsp`) | Oscillators, filters, envelopes, gain, modular graph |
| Wasm Runtime | `wasm32-unknown-unknown` | Sample-accurate block processing inside AudioWorklet |
| Audio Boundary | `AudioWorkletProcessor` | Loads Wasm, forwards messages, writes to output buffers |
| UI / Patch Graph | Vite + vanilla JS | Canvas patching, knobs, param changes, keyboard input |
| Plugin SDK | JS manifests + optional Rust | Control-rate plugins in JS; audio-rate modules in Rust |

## Project Structure

```
vibra/
  Cargo.toml                      # Rust workspace
  crates/
    vibra-dsp/
      src/
        lib.rs                    # Engine + FFI exports
        graph.rs                  # Modular topology, connection mixing
        modules/
          mod.rs                  # Module trait + factory
          osc.rs                  # Wavetable oscillator
          filter.rs               # Biquad (LP/HP/BP)
          gain.rs                 # VCA with smoothing
          env.rs                  # ADSR envelope
          scope.rs                # Passthrough for patching
  frontend/
    public/
      vibra_dsp.wasm              # Compiled Wasm artifact (copied here)
    src/
      main.js                     # App bootstrap, AudioWorklet setup
      worklet/
        vibra-processor.js        # AudioWorkletProcessor, Wasm loader
      synth/
        engine-bridge.js          # Message bridge to worklet
        patch-bay.js              # Logical graph, serializes to engine
        builtins/                 # JS manifests for Rust modules
      ui/
        graph.js                  # DOM patch editor + SVG cables
        palette.js                # Module selector
        keyboard.js               # Virtual MIDI keyboard
      plugin/
        sdk.js                    # Plugin manifest validator
      examples/
        hello-sine.js             # Default patch (osc → gain → dest)
```

## Quick Start

### Prerequisites

- [Rust](https://rustup.rs/) + `wasm32-unknown-unknown` target
- Node.js + pnpm/npm
- [portless](https://github.com/vercel-labs/portless) (optional, for named URLs + Tailscale)

### Build & Run

```sh
# 1. Add Wasm target (once)
rustup target add wasm32-unknown-unknown

# 2. Build Rust DSP and copy artifact to frontend
cd frontend
pnpm wasm-dev

# 3. Start the dev server (https://vibra.localhost)
pnpm dev
```

Then open the printed URL and click **\[ START_AUDIO \]**.

### Share over Tailscale

If you have [Tailscale](https://tailscale.com) installed and connected:

```sh
# Share with your tailnet (https://<machine>.<tailnet>.ts.net)
pnpm dev:tailscale

# Or expose publicly via Tailscale Funnel
pnpm dev:funnel
```

### Production Build

```sh
cd frontend
pnpm wasm            # release-mode Wasm
pnpm build           # Vite production bundle
```

## Module SDK

A built-in module is a JS manifest that maps to a Rust DSP kernel:

```javascript
export default {
  id: 'builtin-osc',
  name: 'Oscillator',
  category: 'source',
  kind: 0,                // Rust ModuleKind::Oscillator
  inputs: [],
  outputs: [{ id: 'out', name: 'Out', type: 'audio' }],
  parameters: [
    { id: 'waveform', name: 'Waveform', type: 'enum', values: ['sine','square','sawtooth','triangle'], default: 'sine', paramId: 0 },
    { id: 'frequency', name: 'Freq', type: 'float', min: 20, max: 20000, default: 440, paramId: 1 }
  ],
  create() { return null; },
  update() {},
  destroy() {}
};
```

JS-only plugins (no `kind`) can still be loaded for control-rate logic, sequencing, and UI extensions. They run on the main thread and send parameter changes through the bridge.

## Roadmap

- [x] Rust wavetable oscillator, biquad filter, gain, ADSR, destination
- [x] AudioWorklet + Wasm block processing
- [x] Message-port bridge for add/connect/param/note events
- [ ] Polyphonic voice allocator
- [ ] Wavetable import / spectral editor
- [ ] Plugin SDK for Rust-based custom DSP modules
- [x] Optional Tauri shell for native distribution

## License

MIT
