# Vibra Roadmap

## Phase 0 — Foundation (Current)

- [x] Core audio engine (PatchBay, ModuleInstance, Registry)
- [x] Built-in modules (Osc, Gain, Filter, Scope, Destination)
- [x] Node graph UI with SVG cables
- [x] Plugin SDK with manifest validator
- [x] Native shell via zero-native
- [x] Brutalist UI theme
- [x] Virtual keyboard for testing
- [ ] MIDI input via Web MIDI API
- [ ] Parameter automation recording

## Phase 1 — Playability

- [ ] MIDI input with note priority modes
- [ ] Polyphonic voice management
- [ ] Parameter modulation (LFO-to-param, envelope generators)
- [ ] Patch save/load JSON serialization
- [ ] Audio export (WAV rendering via OfflineAudioContext)
- [ ] Scope + Spectrum analyzer dual view
- [ ] Undo/redo for patch changes

## Phase 2 — Custom DSP

- [ ] AudioWorklet processor support in plugin SDK
- [ ] Wasm DSP core (Rust/C++ compiled to Wasm for AudioWorklet)
- [ ] Granular synthesis engine
- [ ] Wavetable oscillator (custom FFT-based)
- [ ] Convolution reverb (impulse response loader)
- [ ] CPU profiling per module

## Phase 3 — Ecosystem

- [ ] Plugin discovery UI (search, tags, ratings)
- [ ] Sandboxed plugin execution (iframe or worker)
- [ ] Patch sharing via gist / git / ipfs
- [ ] Collaborative patching (WebRTC data channels)
- [ ] Native bridge file commands (scanPlugins, loadPatch, savePatch)
- [ ] Auto-update mechanism for plugins

## Phase 4 — Platform Expansion

- [ ] iOS shell via zero-native mobile embedding
- [ ] Android shell
- [ ] MPE (MIDI Polyphonic Expression) support
- [ ] CV/Gate output via audio interface (expert sleeper style)
- [ ] VST3 plugin wrapper (host Vibra inside a DAW)
