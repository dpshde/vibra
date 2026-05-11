# Vibra Plugin SDK

## Philosophy

A Vibra plugin is **one JavaScript file** that exports a manifest. If you can write a function that returns an `AudioNode`, you can write a Vibra plugin.

## Manifest Schema

```typescript
interface PluginManifest {
  id: string;           // Unique identifier, kebab-case
  name: string;         // Human-readable label
  category: string;     // 'source' | 'effect' | 'utility' | 'output' | custom

  inputs: PortDef[];    // Audio-rate inputs
  outputs: PortDef[];   // Audio-rate outputs
  parameters: ParamDef[]; // UI-controlled parameters

  create(ctx: AudioContext): AudioNode;
  update(node: AudioNode, params: Record<string, any>): void;
  destroy(node: AudioNode): void;
}

interface PortDef {
  id: string;           // Reference for patching
  name: string;         // UI label
  type: 'audio' | 'audio-param'; // 'audio-param' maps to an AudioParam on the node
  param?: string;       // Required if type === 'audio-param'. Property name on the node.
}

interface ParamDef {
  id: string;           // Reference for updates
  name: string;         // UI label
  type: 'float' | 'int' | 'enum' | 'bool';
  default: any;
  min?: number;         // For float/int
  max?: number;
  step?: number;
  values?: string[];    // For enum
}
```

## Lifecycle

### `create(ctx)`

Called once when the user adds the module to the patch. Must return an `AudioNode` (or node subclass like `OscillatorNode`).

```javascript
create(ctx) {
  const osc = ctx.createOscillator();
  osc.frequency.value = 440;
  osc.start();
  return osc;
}
```

### `update(node, params)`

Called whenever a parameter changes via the UI knob. Use `setValueAtTime` for smooth, scheduled changes rather than direct assignment when possible.

```javascript
update(node, params) {
  node.type = params.waveform; // enum assignment is fine
  node.frequency.setValueAtTime(params.frequency, node.context.currentTime);
}
```

### `destroy(node)`

Called when the module is deleted. Clean up all resources.

```javascript
destroy(node) {
  node.stop();
  node.disconnect();
}
```

## Port Types

### `audio`

A standard audio-rate input/output. PatchBay wires this with `sourceNode.connect(targetNode)`.

### `audio-param`

Maps to an `AudioParam` on the target node. PatchBay wires this with `sourceNode.connect(targetNode[param])`. This enables CV-style modulation (e.g., an LFO into a filter cutoff).

```javascript
// Filter manifest
inputs: [
  { id: 'in', name: 'In', type: 'audio' },
  { id: 'frequency', name: 'Freq', type: 'audio-param', param: 'frequency' },
  { id: 'q', name: 'Q', type: 'audio-param', param: 'Q' }
]
```

## Parameter Types

| Type | UI Render | Value passed to `update` |
|------|-----------|-------------------------|
| `float` | Range slider | `number` |
| `int` | Range slider (stepped) | `number` |
| `enum` | Dropdown | `string` (selected value) |
| `bool` | Checkbox | `boolean` |

## Example: Simple LFO

```javascript
export default {
  id: 'example-lfo',
  name: 'LFO',
  category: 'source',
  inputs: [
    { id: 'rate', name: 'Rate', type: 'audio-param', param: 'frequency' }
  ],
  outputs: [
    { id: 'out', name: 'Out', type: 'audio' }
  ],
  parameters: [
    { id: 'frequency', name: 'Rate', type: 'float', min: 0.1, max: 20, step: 0.1, default: 2 }
  ],
  create(ctx) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 2;
    osc.start();
    return osc;
  },
  update(node, params) {
    node.frequency.setValueAtTime(params.frequency, node.context.currentTime);
  },
  destroy(node) {
    node.stop();
    node.disconnect();
  }
};
```

## Example: Custom Gain with Mute

```javascript
export default {
  id: 'custom-vca',
  name: 'VCA',
  category: 'utility',
  inputs: [
    { id: 'in', name: 'In', type: 'audio' },
    { id: 'gain', name: 'Gain', type: 'audio-param', param: 'gain' }
  ],
  outputs: [
    { id: 'out', name: 'Out', type: 'audio' }
  ],
  parameters: [
    { id: 'gain', name: 'Gain', type: 'float', min: 0, max: 1, step: 0.01, default: 0.5 },
    { id: 'mute', name: 'Mute', type: 'bool', default: false }
  ],
  create(ctx) {
    return ctx.createGain();
  },
  update(node, params) {
    const effectiveGain = params.mute ? 0 : params.gain;
    node.gain.setValueAtTime(effectiveGain, node.context.currentTime);
  },
  destroy(node) {
    node.disconnect();
  }
};
```

## Best Practices

1. **Always use `setValueAtTime`** for audio-rate parameters to avoid zipper noise.
2. **Start oscillators in `create`**, stop them in `destroy`.
3. **Disconnect in `destroy`** to prevent dangling connections and memory leaks.
4. **Don't assume `node` type** — the engine passes whatever `create` returned.
5. **Keep `update` synchronous** — no async/await. The audio thread doesn't wait.
6. **Validate your manifest** — the SDK will throw if required fields are missing.

## Loading Plugins

Drop `.js` files into `frontend/src/plugins/`. They are auto-discovered via `import.meta.glob` at build time. No registration step needed.

For runtime loading (future), use the native bridge:
```javascript
if (window.zero) {
  const files = await window.zero.invoke('scanPlugins', '{}');
  // ...
}
```

## Upgrading to AudioWorklet

In Phase 2, the SDK will support an optional `processor` field:

```javascript
export default {
  // ... standard manifest ...
  processor: {
    url: './my-processor.js', // AudioWorkletProcessor URL
    parameters: ['freq', 'resonance']
  }
};
```

When `processor` is present, `create()` should return an `AudioWorkletNode` instead of a built-in node.
