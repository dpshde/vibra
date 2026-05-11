# Vibra Product Specification

## Vision

Vibra is a hackable digital modular synthesizer for desktop. The core thesis: **creating a new synthesizer module should be as easy as writing a single JavaScript file.** No C++ compilation. No DSP math degree. No build pipeline. Just a manifest and a factory function.

## Target Audience

1. **Musician-Developers** — People who make music and write code, frustrated by closed plugin ecosystems.
2. **AI-Assisted Creators** — Users who "vibe code" with LLMs, needing a platform where generated modules plug in immediately.
3. **Synth Tinkerers** — Modular synth enthusiasts who want a lightweight, always-available patching environment.

## Key Features

| Feature | Description | Status |
|---------|-------------|--------|
| Node Graph Patching | Drag-and-drop modular patching with SVG cables | MVP |
| Web Audio Engine | Real-time synthesis via Web Audio API + AudioWorklet | MVP |
| Plugin SDK | Single-file JS manifest for new modules | MVP |
| Native Desktop Shell | Zig + zero-native for tiny cross-platform binaries | MVP |
| Brutalist UI | High-contrast, monospace, grid-based interface | MVP |
| MIDI Input | Web MIDI API integration | Phase 1 |
| Parameter Automation | LFO/Envelope-to-parameter modulation | Phase 1 |
| AudioWorklet DSP | Custom sample-accurate DSP in Wasm/Rust | Phase 2 |
| Patch Sharing | JSON-based preset exchange | Phase 1 |

## Non-Goals

- **DAW Replacement** — Vibra is an instrument, not a multitrack recorder.
- **VST/AU Plugin** — We are a standalone app. Plugin hosting is future work.
- **Pro-grade DSP parity** — We don't compete with Vital or Serum on raw audio quality in v1.
- **Cloud Dependency** — No accounts, no servers, no telemetry.

## Success Metrics

1. Time to first custom module < 5 minutes for a JS developer.
2. Patch serialization round-trips without audio dropouts.
3. Binary size < 20MB (system WebView) or < 80MB (CEF).
4. Audio latency < 30ms on modern hardware.

## User Stories

- As a developer, I can write a new filter module in 20 lines of JS and hear it immediately.
- As a musician, I can patch an oscillator through a filter to the output without reading a manual.
- As a hacker, I can fork the repo, modify the native bridge, and ship my own flavor of Vibra.
