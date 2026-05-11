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
}
