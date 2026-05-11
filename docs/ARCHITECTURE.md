# Vibra Architecture

## Stack Overview

```
┌─────────────────────────────────────────┐
│  Native Shell (Zig + zero-native)       │
│  ├─ Window management                     │
│  ├─ JS-to-Zig bridge                      │
│  └─ File system access (future)          │
├─────────────────────────────────────────┤
│  WebView (System / CEF)                 │
│  ├─ Vite dev server (dev)                │
│  └─ static frontend/dist (production)    │
├─────────────────────────────────────────┤
│  Frontend (Vanilla JS + Web Audio API)  │
│  ├─ UI Layer (Node Graph, Palette)       │
│  ├─ Synth Engine (PatchBay, Modules)      │
│  ├─ Plugin SDK (Loader, Validator)        │
│  └─ Examples (Default patches)           │
└─────────────────────────────────────────┘
```

## Audio Data Flow

1. **User Gesture** → `AudioContext.resume()`
2. **PatchBay.addModule()** → `manifest.create(ctx)` → `AudioNode`
3. **PatchBay.connect()** → `sourceNode.connect(targetNode)` or `sourceNode.connect(audioParam)`
4. **Parameter Change** → `manifest.update(node, params)` → `audioParam.setValueAtTime()`
5. **Audio Rendering** → Browser's audio thread (Web Audio) → OS audio subsystem

## Module System

A module is defined by a **manifest** — a plain JS object with these sections:

- **Metadata**: `id`, `name`, `category`
- **Ports**: `inputs[]`, `outputs[]` with types `audio` | `audio-param`
- **Parameters**: `parameters[]` with types `float` | `int` | `enum` | `bool`
- **Lifecycle**: `create(ctx)`, `update(node, params)`, `destroy(node)`

The `PatchBay` owns the lifecycle:
- `addModule()` instantiates via `create()` and stores in `ModuleInstance`
- `connect()` wires AudioNodes and records topology in `ModuleInstance` connection maps
- `setParam()` delegates to `manifest.update()`
- `removeModule()` disconnects all cables, calls `destroy()`, and deletes

## State Management

Vibra uses minimal implicit state management:

- **PatchBay** is the single source of truth for the audio graph.
- **NodeGraph** (UI) mirrors PatchBay topology and updates via imperative methods (`addModule`, `removeModule`, `redrawCables`).
- **ModuleInstance** stores params and connection maps locally.
- No global state library. No reactive framework. Direct DOM manipulation for performance and simplicity.

## File Organization

```
frontend/src/
  synth/
    audio-context.js    # AudioContext singleton
    module.js           # ModuleInstance wrapper
    patch-bay.js        # Graph topology + audio wiring
    registry.js         # Built-in + plugin registry
    builtins/           # First-party modules
  plugin/
    sdk.js              # Validator, loader, registry
  ui/
    graph.js            # Canvas/SVG node graph
    palette.js          # Module browser sidebar
    keyboard.js         # Virtual keyboard
  examples/
    hello-sine.js       # Default patch
  plugins/              # User-authored plugins (auto-loaded)
```

## Native Bridge

`src/main.zig` registers a `BridgeDispatcher` with zero-native. Commands:

| Command | Purpose | Payload | Response |
|---------|---------|---------|----------|
| `echo` | Health check / scaffolding | any JSON | `{echo: <payload>}` |

Future commands:
- `scanPlugins` → return file list from `~/.vibra/plugins/`
- `loadPatch` → read JSON from filesystem
- `savePatch` → write JSON to filesystem

## Security Model

- **WebView** is treated as untrusted by zero-native default. Bridge commands are permissioned via `BridgePolicy`.
- **Plugins** run in the same JS context as the engine. No sandbox. The trust model is "user-authored code" — if you write it, you own it.
- **External navigation** is denied in `app.zon`.

## Performance Considerations

- Web Audio nodes run on the browser's audio thread. JS callbacks (param updates) happen on the main thread.
- AudioWorklet will be introduced in Phase 2 for sample-accurate custom DSP.
- The UI graph redraws cables on drag/connect only. No continuous re-render.
- Scope visualization uses `requestAnimationFrame` with `AnalyserNode.getByteTimeDomainData()`.
