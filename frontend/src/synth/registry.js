export class BuiltinRegistry {
  constructor() {
    this.plugins = new Map();
  }

  register(manifest) {
    this.plugins.set(manifest.id, manifest);
  }

  get(id) {
    return this.plugins.get(id);
  }

  all() {
    return Array.from(this.plugins.values());
  }

  pluginsByCategory() {
    const map = new Map();
    for (const p of this.plugins.values()) {
      if (!map.has(p.category)) map.set(p.category, []);
      map.get(p.category).push(p);
    }
    return map;
  }

  /**
   * Sync manifests from WASM canonical metadata.
   * WASM provides: id, name, category, kind, inputs, outputs, parameters (with unit, min, max, default, enum_values).
   * We reconstruct paramId from array order, infer type from unit, and preserve UI-only fields from JS manifests.
   */
  syncFromWasm(wasmManifests) {
    if (!Array.isArray(wasmManifests)) return;
    for (const wm of wasmManifests) {
      const existing = this.plugins.get(wm.id);
      if (!existing) continue;

      // Rebuild parameters with canonical WASM metadata
      const parameters = (wm.parameters || []).map((wp, idx) => {
        const old = existing.parameters?.find((p) => p.id === wp.id);
        const type = wp.unit === "enum" || wp.unit === "boolean" ? "enum" : "float";
        return {
          id: wp.id,
          name: wp.name,
          description: old?.description || "",
          unit: wp.unit,
          type,
          min: wp.min,
          max: wp.max,
          step: old?.step ?? (type === "enum" ? 1 : 0.01),
          default: wp.default,
          paramId: idx,
          values: wp.enum_values?.length ? wp.enum_values : old?.values,
        };
      });

      // Rebuild ports with canonical WASM metadata
      const inputs = (wm.inputs || []).map((p) => ({
        id: p.id,
        name: p.name,
        description: existing.inputs?.find((i) => i.id === p.id)?.description || "",
        type: p.rate,
      }));

      const outputs = (wm.outputs || []).map((p) => ({
        id: p.id,
        name: p.name,
        description: existing.outputs?.find((o) => o.id === p.id)?.description || "",
        type: p.rate,
      }));

      const merged = {
        ...existing,
        kind: wm.kind,
        category: wm.category,
        inputs,
        outputs,
        parameters,
      };
      this.plugins.set(wm.id, merged);
    }
  }
}
