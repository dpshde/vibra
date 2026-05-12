/**
 * Open Synth Patch (OSP) v0.1.0 — Reference import/export for Vibra
 *
 * Maps Vibra's internal graph state to/from the portable OSP schema.
 */

const VIBRA_TO_OSP_KIND = {
  "builtin-osc": "oscillator",
  "builtin-gain": "amplifier",
  "builtin-filter": "filter",
  "builtin-env": "envelope",
  "builtin-destination": "output",
  "builtin-lfo": "lfo",
  "builtin-noise": "noise",
  "builtin-delay": "effect",
  "builtin-mult": "amplifier",
  "builtin-scope": "other",
};

const OSP_KIND_TO_VIBRA_DEFAULT = {
  oscillator: "builtin-osc",
  amplifier: "builtin-gain",
  filter: "builtin-filter",
  envelope: "builtin-env",
  output: "builtin-destination",
  lfo: "builtin-lfo",
  noise: "builtin-noise",
  effect: "builtin-delay",
  mixer: null,
  sequencer: null,
  macroSource: null,
  other: null,
};

function getSemanticUnit(paramDef) {
  return paramDef.unit || "none";
}

function computeNormalized(value, paramDef) {
  const { type, min, max, values } = paramDef;

  if (type === "enum") {
    if (!Array.isArray(values)) return undefined;
    const idx = values.indexOf(value);
    if (idx === -1) return undefined;
    if (values.length <= 1) return 0;
    return idx / (values.length - 1);
  }

  if (type === "float" || type === "number") {
    if (min === undefined || max === undefined) return undefined;
    if (max === min) return 0;
    return (value - min) / (max - min);
  }

  return undefined;
}

export function validateOSP(ospJson) {
  if (!ospJson || typeof ospJson !== "object") {
    throw new Error("OSP data must be an object");
  }
  if (ospJson.format !== "open-synth-patch") {
    throw new Error(`Unsupported format: ${ospJson.format}`);
  }
  if (!/^0\./.test(ospJson.version || "")) {
    throw new Error(`Unsupported version: ${ospJson.version}`);
  }
  if (!Array.isArray(ospJson.modules) || ospJson.modules.length === 0) {
    throw new Error("OSP patch must contain at least one module");
  }
  for (const mod of ospJson.modules) {
    if (!mod.id) throw new Error("Module missing required field: id");
    if (!mod.kind) throw new Error(`Module ${mod.id} missing required field: kind`);
  }
  return true;
}

export function exportOSP(patchBay, metadata = {}) {
  const modules = [];

  for (const instance of patchBay.modules.values()) {
    const manifest = instance.manifest;
    const kind = VIBRA_TO_OSP_KIND[manifest.id] || "other";

    const parameters = manifest.parameters.map((paramDef) => {
      const rawValue = instance.params[paramDef.id] ?? paramDef.default;
      const semanticUnit = getSemanticUnit(paramDef);
      const normalized = computeNormalized(rawValue, paramDef);

      return {
        id: paramDef.id,
        label: paramDef.name,
        semantic: rawValue,
        semanticUnit,
        normalized:
          normalized !== undefined
            ? Math.max(0, Math.min(1, normalized))
            : undefined,
        native: rawValue,
      };
    });

    modules.push({
      id: String(instance.id),
      kind,
      vendorKind: manifest.id,
      label: manifest.name,
      parameters,
    });
  }

  const connections = [];
  for (const instance of patchBay.modules.values()) {
    for (const [outputId, conns] of Object.entries(instance.outputConnections)) {
      for (const conn of conns) {
        connections.push({
          source: String(instance.id),
          sourceOutput: outputId,
          target: String(conn.targetModuleId),
          targetInput: conn.inputId,
        });
      }
    }
  }

  return {
    format: "open-synth-patch",
    version: "0.1.0",
    metadata: {
      name: metadata.name || "Untitled",
      targetSynth: "vibra",
      ...metadata,
    },
    voice: patchBay.voiceConfig || {
      mode: "poly",
      polyphony: 8,
    },
    modules,
    connections,
  };
}

export function importOSP(patchBay, registry, ospJson) {
  validateOSP(ospJson);

  const idMap = new Map(); // OSP string id -> Vibra integer id
  const created = [];

  // First pass: create modules
  for (const mod of ospJson.modules) {
    let manifestId = mod.vendorKind;
    let manifest = null;

    if (manifestId) {
      manifest = registry.get(manifestId);
    }

    if (!manifest && mod.kind) {
      const defaultId = OSP_KIND_TO_VIBRA_DEFAULT[mod.kind];
      if (defaultId) {
        manifest = registry.get(defaultId);
        if (manifest) manifestId = defaultId;
      }
    }

    if (!manifest) {
      console.warn(
        `[OSP] Unknown module "${mod.vendorKind || mod.kind}" (id: ${mod.id}), skipping`
      );
      continue;
    }

    const vibraId = patchBay.addModule(manifest);
    idMap.set(mod.id, vibraId);
    created.push({ ospId: mod.id, vibraId, manifest });

    // Set parameters
    for (const param of mod.parameters || []) {
      let value = param.semantic;

      if (value === undefined) {
        value = param.native;
      }

      if (value === undefined && param.normalized !== undefined) {
        const paramDef = manifest.parameters.find((p) => p.id === param.id);
        if (paramDef) {
          if (
            paramDef.type === "enum" &&
            Array.isArray(paramDef.values)
          ) {
            const idx = Math.round(
              param.normalized * (paramDef.values.length - 1)
            );
            const clampedIdx = Math.max(
              0,
              Math.min(paramDef.values.length - 1, idx)
            );
            value = paramDef.values[clampedIdx];
          } else if (
            (paramDef.type === "float" || paramDef.type === "number") &&
            paramDef.min !== undefined &&
            paramDef.max !== undefined
          ) {
            value =
              param.normalized * (paramDef.max - paramDef.min) + paramDef.min;
          }
        }
      }

      if (value !== undefined) {
        // Basic type sanity check for enums
        const paramDef = manifest.parameters.find((p) => p.id === param.id);
        if (paramDef?.type === "enum") {
          if (
            typeof value !== "string" ||
            !paramDef.values.includes(value)
          ) {
            console.warn(
              `[OSP] Invalid enum value for ${param.id}: "${value}". Using default.`
            );
            value = paramDef.default;
          }
        }
        patchBay.setParam(vibraId, param.id, value);
      }
    }
  }

  // Apply voice configuration
  if (ospJson.voice) {
    patchBay.setVoiceConfig({
      mode: ospJson.voice.mode || "poly",
      polyphony: ospJson.voice.polyphony || 8,
      unisonCount: ospJson.voice.unisonCount || 1,
      unisonDetune: ospJson.voice.unisonDetune || 0,
    });
  }

  // Second pass: create connections
  for (const conn of ospJson.connections || []) {
    const sourceId = idMap.get(conn.source);
    const targetId = idMap.get(conn.target);

    if (!sourceId || !targetId) {
      console.warn(`[OSP] Skipping connection: missing module mapping`, conn);
      continue;
    }

    try {
      patchBay.connect(
        sourceId,
        conn.sourceOutput,
        targetId,
        conn.targetInput
      );
    } catch (err) {
      console.warn(`[OSP] Connection failed: ${err.message}`, conn);
    }
  }

  return {
    metadata: ospJson.metadata,
    modules: created,
    importedCount: created.length,
    totalModules: ospJson.modules.length,
  };
}
