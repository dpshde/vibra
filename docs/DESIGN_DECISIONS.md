# Design Decisions

## Why zero-native?

**Rejected options**: Electron (too heavy, bundles Chromium), Tauri (Rust learning curve for users who want to hack the shell), pure browser (no native file system for patches/plugins).

**Selected**: zero-native provides a Zig-native shell with a system WebView. Binaries stay tiny (~5-15MB), startup is instant, and the Zig bridge allows direct native integrations when we need them. The "web UI + native shell" split matches our architecture perfectly.

## Why adopt zenbu.js philosophy without using zenbu.js runtime?

zenbu.js is an excellent *idea* — software should be hackable by default, and plugins should be first-class. However, zenbu.js is currently alpha-stage and Electron-only. zero-native is a separate project with different goals (Zig shell, cross-platform, tiny binaries).

Our approach: **import the philosophy, not the runtime.** We implement:
- Source code as the product (users can edit `frontend/src/` directly)
- Plugin hot-loading via `import.meta.glob`
- No bundled preset IP (everything is code)

## Why vanilla JS instead of React/Svelte/Vue?

**Rejected**: React (VDOM overhead for canvas/SVG graph), Svelte (compile step adds complexity for live hacking), Vue (reactive system is overkill).

**Selected**: Vanilla JS with direct DOM manipulation.
- Audio UI is canvas/SVG-heavy. Framework abstractions get in the way.
- Plugin authors don't need to learn a framework.
- "Vibe coding" works better with less indirection.
- The brutalist aesthetic rejects polished component libraries.

## Why Web Audio API for v1 DSP?

**Rejected**: Wasm DSP (complex build pipeline, steep learning curve), emscripten/C++ port of Vital (license mountain, platform mismatch).

**Selected**: Web Audio API built-in nodes for v1. Custom DSP via AudioWorklet in Phase 2.
- Web Audio is universally supported and latency-competitive for basic synthesis.
- Built-in nodes (Oscillator, BiquadFilter, Gain) cover 80% of use cases.
- The plugin SDK can be upgraded to support AudioWorklet processors without breaking the manifest format.

## Why brutalist UI?

**Rejected**: Skeuomorphic synth panels (overused, resource-heavy, inaccessible), glassmorphism (distracting, poor contrast), standard "dark mode" (too generic).

**Selected**: Brutalist terminal aesthetic.
- **Monospace + Grid** evokes tracker/sequencer culture (Renoise, FastTracker).
- **High contrast** ensures readability under stage lighting or bright studios.
- **No rounded corners / no shadows** reduces rendering overhead and signals "tool, not toy."
- **Acid green on black** references oscilloscope displays and vintage terminals.

## Why no sandbox for plugins?

Plugins run in the same JS context as the engine. This is intentional:
- Simpler mental model: a plugin is just a module, not an IPC message.
- Performance: no serialization overhead for parameter updates.
- Hackability: users can monkey-patch the engine from a plugin if they want.

Trade-off: a buggy plugin can crash the audio thread. Mitigation:
- CPU metering (future)
- Graceful degradation (catch errors in update loops)
- AudioWorklet isolation for untrusted community plugins (Phase 3)

## Why JSON patches instead of a binary format?

- Human-readable for git diffing and PR review.
- No custom serializer to maintain.
- Enables "patch as code" — a patch is just a JSON file you can hand-edit.

## Why `import.meta.glob` for plugin discovery?

Vite's `import.meta.glob` scans directories at build time. This means:
- Plugins are bundled into the app (no runtime file reading needed in v1).
- Users add a file, rebuild, and it appears.
- Future: native bridge `scanPlugins` will enable true runtime discovery without rebuild.

## Why no preset server / cloud?

- Decentralized by default. Share patches via git, gist, or filesystem.
- No infrastructure cost or privacy concerns.
- Aligns with "your synth, your code" philosophy.
