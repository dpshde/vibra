# Open Synth Patch — v0.1 Design Document

**Status:** Draft  
**Goal:** Define a portable, layered JSON interchange format for synthesizer patches that preserves semantic meaning across modular, matrix, and hardware synths without forcing a lowest-common-denominator parameter list.

## Philosophy

1. **Interchange, not replacement.** This format does not try to replace every native preset blob or SysEx dump. It sits above them as a translation hub.
2. **Semantic first.** A `cutoff` should say `1200` with `semanticUnit: "hz"`, not just `0.42`. The normalized value is secondary.
3. **Round-trip friendly.** Vendor-specific parameters and raw native values live in extension fields so converters can reconstruct the original format losslessly.
4. **Graph + Matrix.** Modular synths use physical connections; matrix synths use abstract routes. Both are first-class.
5. **Stable IDs.** Every module and macro gets a stable string ID so modulation sources/destinations can reference them unambiguously.

## Layered Model

| Layer | Purpose | Example |
|-------|---------|---------|
| **Core** | Shared concepts every synth understands | Oscillator pitch, filter cutoff, envelope ADSR, LFO rate |
| **Vendor Parameters** | Synth-specific parameters that have no universal equivalent | DX7 EG rates/levels, wavetable position, grain size |
| **Vendor Extensions** | Opaque blobs for round-tripping entire native patches | Full SysEx byte array, CLAP preset chunk |
| **Native Adapters** | External tools that read/write native formats using the schema as the pivot format | `dx7-to-osp`, `osp-to-sysex` |

## Schema Structure

See [`vibra/schema/open-synth-patch-0.1.0.json`](../schema/open-synth-patch-0.1.0.json) for the formal JSON Schema.

Top-level object:

```
open-synth-patch
├── format           (const: "open-synth-patch")
├── version          (e.g. "0.1.0")
├── metadata         (name, author, tags, category, targetSynth...)
├── voice            (mode, polyphony, unison, pitchBendRange...)
├── modules[]        (id, kind, parameters[], vendorParameters...)
├── connections[]    (source, sourceOutput, target, targetInput, amount)
├── modMatrix[]      (source, destination, destinationParam, amount, curve)
├── macros[]         (id, label, assignments[])
└── vendorExtensions (reverse-DNS keyed opaque objects)
```

### Module `kind` Taxonomy

The `kind` field uses a stable semantic vocabulary:

- `oscillator` — periodic tone source (saw, sine, FM operator, wavetable, etc.)
- `filter` — spectral shaping (LP, HP, BP, comb, etc.)
- `amplifier` — gain / VCA / dynamics
- `envelope` — ADSR, AD, AR, multi-stage
- `lfo` — low-frequency modulation source
- `noise` — stochastic source
- `mixer` — summing, crossfade, panning
- `effect` — delay, reverb, chorus, distortion, etc.
- `sequencer` — step sequencer, arpeggiator, gate pattern
- `output` — final audio destination / master
- `macroSource` — external control source mapped to internal params
- `other` — anything not covered above

`vendorKind` carries the vendor-specific identifier (e.g. `"builtin-osc"`, `"DX7-Operator"`, `"Massive-OSC1"`) for lossless round-tripping.

### Module Discoverability (`definitionUrl`)

Any module whose behavior cannot be inferred from the core `kind` taxonomy **must** carry a `definitionUrl` pointing to a JSON manifest that describes the module's ports, parameters, and signal behavior. This makes the format self-describing: a patch with a custom module is never an opaque blob.

**Enforcement rule:**

- `definitionUrl` is **required** when `kind` is `"other"`.
- `definitionUrl` is **required** when `vendorKind` is not recognized by the consumer's built-in registry.
- `definitionUrl` is **optional but recommended** for registered vendor modules (it can point to canonical documentation or the manifest itself).

The manifest at `definitionUrl` should describe at minimum:

```json
{
  "$schema": "https://vibra.dev/schema/open-synth-module-manifest-0.1.0.json",
  "id": "com.example.krusher",
  "name": "Krusher",
  "kind": "effect",
  "inputs": [
    { "id": "in", "name": "In", "type": "audio" }
  ],
  "outputs": [
    { "id": "out", "name": "Out", "type": "audio" }
  ],
  "parameters": [
    { "id": "drive", "name": "Drive", "type": "float", "min": 0, "max": 1, "default": 0.5 }
  ]
}
```

Consumers that cannot fetch the URL should still be able to render the patch graph using the `kind` and `label`, but they must refuse to instantiate or process audio for the module unless the manifest is available.

### Parameter Representation

Every parameter can store up to three values:

| Field | Role |
|-------|------|
| `semantic` | Human-meaningful value (`440`, `"sawtooth"`, `0.3`) |
| `semanticUnit` | Unit tag (`"hz"`, `"s"`, `"enum"`, `"db"`...) |
| `normalized` | 0..1 normalized value for cross-synth interpolation |
| `native` | Raw value as the target synth stores it (SysEx byte, vendor int) |
| `nativeRange` | `{ min, max, step }` if the native value is quantized |

A minimal consumer only needs `semantic`. A converter only needs `native`. A smart cross-synth mapper can use `normalized` + `semanticUnit`.

## Example 1: Vibra "Echo Pluck" (Modular Subtractive)

This maps directly to [`vibra/frontend/src/examples/echo-pluck.js`](../frontend/src/examples/echo-pluck.js).

```json
{
  "format": "open-synth-patch",
  "version": "0.1.0",
  "metadata": {
    "name": "Echo Pluck",
    "category": "lead",
    "targetSynth": "vibra"
  },
  "modules": [
    {
      "id": "osc-1",
      "kind": "oscillator",
      "vendorKind": "builtin-osc",
      "label": "Oscillator",
      "parameters": [
        { "id": "waveform", "semantic": "sawtooth", "semanticUnit": "enum", "normalized": 0.67, "native": 2 },
        { "id": "frequency", "semantic": 440, "semanticUnit": "hz", "normalized": 0.54, "native": 440 },
        { "id": "detune", "semantic": 0, "semanticUnit": "cents", "normalized": 0.5, "native": 0 }
      ]
    },
    {
      "id": "filter-1",
      "kind": "filter",
      "vendorKind": "builtin-filter",
      "label": "Filter",
      "parameters": [
        { "id": "type", "semantic": "lowpass", "semanticUnit": "enum", "normalized": 0.0, "native": 0 },
        { "id": "frequency", "semantic": 1500, "semanticUnit": "hz", "normalized": 0.19, "native": 1500 },
        { "id": "resonance", "semantic": 0.8, "semanticUnit": "ratio", "normalized": 0.4, "native": 0.8 }
      ]
    },
    {
      "id": "amp-1",
      "kind": "amplifier",
      "vendorKind": "builtin-mult",
      "label": "VCA",
      "parameters": [
        { "id": "gain", "semantic": 1.0, "semanticUnit": "ratio", "normalized": 1.0, "native": 1.0 }
      ]
    },
    {
      "id": "env-1",
      "kind": "envelope",
      "vendorKind": "builtin-env",
      "label": "Amp Env",
      "parameters": [
        { "id": "attack", "semantic": 0.001, "semanticUnit": "s", "normalized": 0.0, "native": 0.001 },
        { "id": "decay", "semantic": 0.3, "semanticUnit": "s", "normalized": 0.05, "native": 0.3 },
        { "id": "sustain", "semantic": 0.05, "semanticUnit": "ratio", "normalized": 0.05, "native": 0.05 },
        { "id": "release", "semantic": 0.4, "semanticUnit": "s", "normalized": 0.07, "native": 0.4 }
      ]
    },
    {
      "id": "delay-1",
      "kind": "effect",
      "vendorKind": "builtin-delay",
      "label": "Delay",
      "parameters": [
        { "id": "delay_ms", "semantic": 300, "semanticUnit": "ms", "normalized": 0.3, "native": 300 },
        { "id": "feedback", "semantic": 0.4, "semanticUnit": "ratio", "normalized": 0.4, "native": 0.4 },
        { "id": "mix", "semantic": 0.4, "semanticUnit": "ratio", "normalized": 0.4, "native": 0.4 }
      ]
    },
    {
      "id": "out-1",
      "kind": "output",
      "vendorKind": "builtin-destination",
      "label": "Destination"
    }
  ],
  "connections": [
    { "source": "osc-1", "sourceOutput": "out", "target": "filter-1", "targetInput": "in" },
    { "source": "filter-1", "sourceOutput": "out", "target": "amp-1", "targetInput": "a" },
    { "source": "env-1", "sourceOutput": "out", "target": "amp-1", "targetInput": "b" },
    { "source": "amp-1", "sourceOutput": "out", "target": "delay-1", "targetInput": "in" },
    { "source": "delay-1", "sourceOutput": "out", "target": "out-1", "targetInput": "in" }
  ]
}
```

Observations:
- Every Vibra module maps to a `kind` in the taxonomy. `builtin-mult` becomes `amplifier` because it is used here as a VCA.
- Parameter `id`s match the manifest so Vibra can load this directly.
- `vendorKind` preserves the exact manifest ID for lossless round-tripping.

## Example 2: DX7-Style FM (Vendor Extensions)

FM synths do not fit neatly into a subtractive cable model. The core schema captures the operators as oscillators with pitch, while the FM-specific architecture (algorithms, EG rates/levels, keyboard scaling) lives in `vendorParameters` and `vendorExtensions`.

```json
{
  "format": "open-synth-patch",
  "version": "0.1.0",
  "metadata": {
    "name": "E Piano 1",
    "category": "keys",
    "targetSynth": "yamaha-dx7"
  },
  "voice": {
    "mode": "poly",
    "polyphony": 16
  },
  "modules": [
    {
      "id": "op1",
      "kind": "oscillator",
      "vendorKind": "dx7-operator",
      "label": "Operator 1",
      "parameters": [
        { "id": "frequency", "semantic": 1.0, "semanticUnit": "ratio", "normalized": 0.1, "native": 1.0 },
        { "id": "detune", "semantic": 0, "semanticUnit": "cents", "normalized": 0.5, "native": 0 }
      ],
      "vendorParameters": {
        "level": 99,
        "egRate": [99, 80, 70, 60],
        "egLevel": [99, 80, 40, 0],
        "keyboardRateScaling": 2,
        "velocitySensitivity": 3
      }
    },
    {
      "id": "op2",
      "kind": "oscillator",
      "vendorKind": "dx7-operator",
      "label": "Operator 2",
      "parameters": [
        { "id": "frequency", "semantic": 1.0, "semanticUnit": "ratio", "normalized": 0.1, "native": 1.0 }
      ],
      "vendorParameters": {
        "level": 85,
        "egRate": [95, 60, 50, 40],
        "egLevel": [85, 60, 30, 0]
      }
    }
  ],
  "modMatrix": [
    {
      "source": "op2",
      "destination": "op1",
      "destinationParam": "phaseModulation",
      "amountNormalized": 0.85,
      "curve": "linear"
    }
  ],
  "vendorExtensions": {
    "com.yamaha.dx7": {
      "algorithm": 5,
      "feedback": 3,
      "lfo": {
        "waveform": "triangle",
        "rate": 35,
        "pmd": 10,
        "amd": 0
      },
      "pitchEg": {
        "rate": [99, 90, 80, 70],
        "level": [50, 50, 50, 50]
      }
    }
  }
}
```

Observations:
- `modMatrix` represents FM modulation as an abstract route, because there is no "cable" in the DX7 UI.
- `vendorParameters` on each module holds parameters that are specific to the DX7 operator architecture.
- `vendorExtensions["com.yamaha.dx7"]` holds global DX7 state (algorithm, feedback, LFO, pitch EG) that does not map to any core module.
- A DX7-to-OSP converter can read the SysEx, populate both core and vendor layers, and a second converter can reconstruct the SysEx byte-for-byte from the vendor layer.

## Example 3: Minimal Cross-Synth Subtractive Patch

This is what you might save when you want portability more than round-trip fidelity. It uses only core `kind`s and `semantic` values. A converter targeting Serum, Vital, or a hardware analog synth can map these by normalized value + unit.

```json
{
  "format": "open-synth-patch",
  "version": "0.1.0",
  "metadata": {
    "name": "Warm Pad",
    "category": "pad",
    "tags": ["analog", "subtractive"]
  },
  "voice": {
    "mode": "poly",
    "polyphony": 8,
    "unisonCount": 2,
    "unisonDetune": 12
  },
  "modules": [
    {
      "id": "osc-a",
      "kind": "oscillator",
      "parameters": [
        { "id": "waveform", "semantic": "sawtooth", "semanticUnit": "enum", "normalized": 0.75 },
        { "id": "frequency", "semantic": 130.81, "semanticUnit": "hz", "normalized": 0.28 },
        { "id": "detune", "semantic": -7, "semanticUnit": "cents", "normalized": 0.48 }
      ]
    },
    {
      "id": "osc-b",
      "kind": "oscillator",
      "parameters": [
        { "id": "waveform", "semantic": "triangle", "semanticUnit": "enum", "normalized": 0.5 },
        { "id": "frequency", "semantic": 130.81, "semanticUnit": "hz", "normalized": 0.28 },
        { "id": "detune", "semantic": 7, "semanticUnit": "cents", "normalized": 0.52 }
      ]
    },
    {
      "id": "filter-1",
      "kind": "filter",
      "parameters": [
        { "id": "type", "semantic": "lowpass", "semanticUnit": "enum", "normalized": 0.0 },
        { "id": "frequency", "semantic": 800, "semanticUnit": "hz", "normalized": 0.12 },
        { "id": "resonance", "semantic": 0.3, "semanticUnit": "ratio", "normalized": 0.15 }
      ]
    },
    {
      "id": "amp-env",
      "kind": "envelope",
      "parameters": [
        { "id": "attack", "semantic": 0.4, "semanticUnit": "s", "normalized": 0.06 },
        { "id": "decay", "semantic": 0.2, "semanticUnit": "s", "normalized": 0.03 },
        { "id": "sustain", "semantic": 0.7, "semanticUnit": "ratio", "normalized": 0.7 },
        { "id": "release", "semantic": 1.2, "semanticUnit": "s", "normalized": 0.18 }
      ]
    },
    {
      "id": "filter-env",
      "kind": "envelope",
      "parameters": [
        { "id": "attack", "semantic": 0.1, "semanticUnit": "s", "normalized": 0.015 },
        { "id": "decay", "semantic": 0.6, "semanticUnit": "s", "normalized": 0.09 },
        { "id": "sustain", "semantic": 0.2, "semanticUnit": "ratio", "normalized": 0.2 },
        { "id": "release", "semantic": 0.8, "semanticUnit": "s", "normalized": 0.12 }
      ]
    },
    {
      "id": "lfo-1",
      "kind": "lfo",
      "parameters": [
        { "id": "waveform", "semantic": "sine", "semanticUnit": "enum", "normalized": 0.0 },
        { "id": "frequency", "semantic": 0.5, "semanticUnit": "hz", "normalized": 0.02 },
        { "id": "amount", "semantic": 0.15, "semanticUnit": "ratio", "normalized": 0.15 }
      ]
    }
  ],
  "modMatrix": [
    { "source": "lfo-1", "destination": "filter-1", "destinationParam": "frequency", "amountNormalized": 0.2, "curve": "linear" },
    { "source": "filter-env", "destination": "filter-1", "destinationParam": "frequency", "amountNormalized": 0.6, "curve": "exponential" }
  ]
}
```

## Example 4: Patch with a Custom Module (`definitionUrl`)

This demonstrates the discoverability rule. A community-authored granular looper does not fit any core `kind`, so it declares `kind: "other"` and provides a `definitionUrl` to its manifest. Any consumer that does not already know this module can fetch the manifest and learn its ports, parameters, and behavior before instantiating it.

```json
{
  "format": "open-synth-patch",
  "version": "0.1.0",
  "metadata": {
    "name": "Granular Drone",
    "category": "pad",
    "targetSynth": "vibra"
  },
  "modules": [
    {
      "id": "osc-1",
      "kind": "oscillator",
      "vendorKind": "builtin-osc",
      "label": "Oscillator",
      "parameters": [
        { "id": "waveform", "semantic": "triangle", "semanticUnit": "enum", "normalized": 0.5, "native": 3 },
        { "id": "frequency", "semantic": 110, "semanticUnit": "hz", "normalized": 0.15, "native": 110 }
      ]
    },
    {
      "id": "grain-1",
      "kind": "other",
      "vendorKind": "com.vibra-community.granular-looper",
      "label": "Granular Looper",
      "definitionUrl": "https://vibra-community.github.io/modules/granular-looper-v1.json",
      "parameters": [
        { "id": "grainSize", "semantic": 50, "semanticUnit": "ms", "normalized": 0.25, "native": 50 },
        { "id": "density", "semantic": 0.8, "semanticUnit": "ratio", "normalized": 0.8, "native": 0.8 },
        { "id": "pitchSpread", "semantic": 12, "semanticUnit": "cents", "normalized": 0.52, "native": 12 }
      ],
      "vendorParameters": {
        "bufferSizeSeconds": 4,
        "freeze": false
      }
    },
    {
      "id": "out-1",
      "kind": "output",
      "vendorKind": "builtin-destination",
      "label": "Destination"
    }
  ],
  "connections": [
    { "source": "osc-1", "sourceOutput": "out", "target": "grain-1", "targetInput": "in" },
    { "source": "grain-1", "sourceOutput": "out", "target": "out-1", "targetInput": "in" }
  ]
}
```

Observations:
- Because `kind` is `"other"`, `definitionUrl` is **required** by the protocol.
- A consumer that has never seen `com.vibra-community.granular-looper` can still render the patch graph (it knows the module exists and has inputs/outputs from the manifest), but it will refuse to process audio until it fetches and validates the manifest.
- If the URL is offline, the patch degrades gracefully: the user sees the graph but hears silence through that module, and the UI can show a "definition unavailable" warning rather than crashing.

## Mapping to Vibra

Vibra’s current [`PatchBay.toJSON()`](../frontend/src/synth/patch-bay.js) is already close to the core graph layer:

```js
{
  modules: [{ id, manifestId, params }],
  connections: [{ source, output, target, input }]
}
```

### Proposed migration path

1. **Upgrade `toJSON()`** to emit the full `open-synth-patch` envelope, mapping:
   - `manifest.id` → `module.vendorKind`
   - Derive `module.kind` from the manifest `category` / `kind` via a small lookup table.
   - Wrap each param in the `Parameter` shape with `semantic` and `semanticUnit` inferred from the manifest definition.
   - Add `metadata.name` from the UI patch name field (new).
   - Add `voice` with defaults for now (`mode: "poly"`, `polyphony: 8`).

2. **Add `fromJSON()`** that reads the format:
   - If `vendorKind` matches a registered manifest, instantiate that module.
   - If only `kind` is present, pick a default built-in that matches (e.g. `kind: "oscillator"` → `builtin-osc`).
   - Apply parameters: prefer `native` if the vendor matches, else fall back to `semantic` or `normalized`.
   - Recreate connections from the `connections` array.

3. **Add a `vendorExtensions["com.vibra"]` namespace** for Vibra-specific data that does not fit core modules (e.g. custom JS plugin state, canvas positions, color themes).

### Parameter unit inference for Vibra builtins

| Manifest Parameter | semanticUnit | Notes |
|--------------------|--------------|-------|
| `frequency` (osc) | `hz` | Or `midiNote` if driven by keyboard |
| `frequency` (filter) | `hz` | Cutoff frequency |
| `detune` | `cents` | 100 cents = 1 semitone |
| `attack` / `decay` / `release` | `s` | Seconds |
| `resonance` | `ratio` | 0..N resonance amount |
| `gain` / `mix` / `sustain` | `ratio` | 0..1 or beyond |
| `delay_ms` | `ms` | Milliseconds |
| `waveform` | `enum` | Enum string value |
| `type` (filter) | `enum` | `"lowpass"`, `"highpass"`, etc. |

## Adoption & Tooling

### Validation

Any JSON Schema validator can validate a patch against the schema. In Node:

```js
import Ajv from "ajv";
import schema from "./open-synth-patch-0.1.0.json" assert { type: "json" };

const ajv = new Ajv();
const validate = ajv.compile(schema);
const valid = validate(patch);
if (!valid) console.log(validate.errors);
```

### Converters

The highest-value first tools are:

| Converter | Input | Output | Value |
|-----------|-------|--------|-------|
| `vibra-export` | Vibra graph | OSP JSON | Readability, sharing, version control |
| `vibra-import` | OSP JSON | Vibra graph | Load patches from other tools |
| `dx7-to-osp` | DX7 SysEx | OSP JSON | Make 30 years of hardware patches readable and editable |
| `osp-to-dx7` | OSP JSON | DX7 SysEx | Round-trip edits back to hardware |

### Versioning

The schema uses `0.x` during incubation. Once there are at least three working converters (one hardware, one software modular, one software matrix), bump to `1.0.0` and freeze the core taxonomy. Vendor extensions are allowed to evolve independently.

## Open Questions for v0.2

1. **Wavetable / sample modules:** How should wavetable index, sample file reference, or spectral data be represented? Probably a new `sample` or `wavetable` `kind` with a `resource` reference.
2. **Per-voice vs global modules:** Should the schema distinguish modules that are duplicated per voice (oscillators, envelopes) from global modules (effects, LFOs)? Vibra currently has no voice allocator, but most synths do.
3. **Arbitrary modulation depths:** The current `amountNormalized` is -1..1 for `modMatrix`. Is that sufficient for bipolar vs unipolar sources?
4. **Expression / MPE:** How to represent per-note expression (poly aftertouch, MPE slide) mappings?

## License

The schema itself is offered under the same MIT license as the Vibra project. Anyone may implement converters, validators, or extensions without restriction.
