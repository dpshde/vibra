import { ModuleInstance } from "./module.js";

export class PatchBay {
  constructor(bridge, registry) {
    this.bridge = bridge;
    this.registry = registry;
    this.modules = new Map();
    this.nextId = 1;
  }

  addModule(manifest) {
    const id = this.nextId++;
    let node = null;
    if (manifest.kind === undefined && typeof manifest.create === "function") {
      node = manifest.create();
    }
    const instance = new ModuleInstance(id, manifest, node);
    this.modules.set(id, instance);

    if (manifest.kind !== undefined) {
      this.bridge.addModule(id, manifest.kind);
      for (const p of manifest.parameters) {
        if (p.paramId !== undefined && p.default !== undefined) {
          let val = p.default;
          if (p.type === "enum") val = p.values.indexOf(p.default);
          this.bridge.setParam(id, p.paramId, val);
        }
      }
    }
    return id;
  }

  removeModule(id) {
    const instance = this.modules.get(id);
    if (!instance) return;
    for (const [inputId, conns] of Object.entries(instance.inputConnections)) {
      for (const conn of [...conns]) {
        this.disconnect(conn.sourceModuleId, conn.outputId, id, inputId);
      }
    }
    for (const [outputId, conns] of Object.entries(
      instance.outputConnections,
    )) {
      for (const conn of [...conns]) {
        this.disconnect(id, outputId, conn.targetModuleId, conn.inputId);
      }
    }
    if (instance.manifest.kind !== undefined) {
      this.bridge.removeModule(id);
    }
    instance.destroy();
    this.modules.delete(id);
  }

  connect(sourceId, outputId, targetId, inputId) {
    const source = this.modules.get(sourceId);
    const target = this.modules.get(targetId);
    if (!source || !target) throw new Error("MODULE NOT FOUND");

    const outputIdx = source.manifest.outputs.findIndex(
      (o) => o.id === outputId,
    );
    const inputIdx = target.manifest.inputs.findIndex((i) => i.id === inputId);
    if (outputIdx === -1 || inputIdx === -1) throw new Error("PORT NOT FOUND");

    if (
      source.manifest.kind !== undefined &&
      target.manifest.kind !== undefined
    ) {
      this.bridge.connect(sourceId, outputIdx, targetId, inputIdx);
    }

    source.addOutputConnection(outputId, targetId, inputId);
    target.addInputConnection(inputId, sourceId, outputId);
  }

  disconnect(sourceId, outputId, targetId, inputId) {
    const source = this.modules.get(sourceId);
    const target = this.modules.get(targetId);
    if (!source || !target) return;

    const outputIdx = source.manifest.outputs.findIndex(
      (o) => o.id === outputId,
    );
    const inputIdx = target.manifest.inputs.findIndex((i) => i.id === inputId);

    if (
      source.manifest.kind !== undefined &&
      target.manifest.kind !== undefined
    ) {
      this.bridge.disconnect(sourceId, outputIdx, targetId, inputIdx);
    }

    source.removeOutputConnection(outputId, targetId, inputId);
    target.removeInputConnection(inputId, sourceId, outputId);
  }

  setParam(moduleId, paramId, value) {
    const instance = this.modules.get(moduleId);
    if (!instance) return;
    instance.params[paramId] = value;

    const manifest = instance.manifest;
    const paramDef = manifest.parameters.find((p) => p.id === paramId);
    if (
      paramDef &&
      paramDef.paramId !== undefined &&
      manifest.kind !== undefined
    ) {
      let val = value;
      if (paramDef.type === "enum") val = paramDef.values.indexOf(value);
      this.bridge.setParam(moduleId, paramDef.paramId, val);
    }

    if (typeof manifest.update === "function") {
      manifest.update(instance.node, instance.params);
    }
  }

  noteOn(note, velocity) {
    this.bridge.noteOn(note, velocity);
  }

  noteOff(note) {
    this.bridge.noteOff(note);
  }

  validatePatch() {
    let destId = null;
    for (const [id, inst] of this.modules) {
      if (inst.manifest.category === "output") {
        destId = id;
        break;
      }
    }
    if (!destId) {
      return "Add a Destination module to hear sound.";
    }
    const dest = this.modules.get(destId);
    const destInputs = Object.keys(dest.inputConnections);
    if (destInputs.length === 0) {
      return "Destination has no input. Connect a source module to it.";
    }
    for (const [srcId, inst] of this.modules) {
      if (inst.manifest.category !== "source") continue;
      if (this._reachesAudioSource(srcId, destId)) return null;
    }
    return "No audio source (Oscillator / Noise) is connected to the Destination.";
  }

  _reachesAudioSource(startId, targetId) {
    const visited = new Set();
    const queue = [startId];
    while (queue.length) {
      const curr = queue.shift();
      if (curr === targetId) return true;
      if (visited.has(curr)) continue;
      visited.add(curr);
      const inst = this.modules.get(curr);
      if (!inst) continue;
      // The LFO generates its own waveform; it does not pass audio from its
      // inputs (FM / Sync) through to its output. Tracing through it would give
      // a false positive for patches like Osc→LFO→Gain→Destination.
      if (inst.manifest.id === "builtin-lfo") continue;
      for (const conns of Object.values(inst.outputConnections)) {
        for (const c of conns) {
          queue.push(c.targetModuleId);
        }
      }
    }
    return false;
  }

  toJSON() {
    return {
      modules: Array.from(this.modules.values()).map((m) => ({
        id: m.id,
        manifestId: m.manifest.id,
        params: m.params,
      })),
      connections: Array.from(this.modules.values()).flatMap((m) =>
        Object.entries(m.outputConnections).flatMap(([outputId, conns]) =>
          conns.map((c) => ({
            source: m.id,
            output: outputId,
            target: c.targetModuleId,
            input: c.inputId,
          })),
        ),
      ),
    };
  }
}
