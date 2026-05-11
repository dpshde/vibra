import { ModuleInstance } from './module.js';

export class PatchBay {
  constructor(audioContext, registry) {
    this.ctx = audioContext;
    this.registry = registry;
    this.modules = new Map();
    this.nextId = 1;
  }

  addModule(manifest) {
    const id = `mod-${this.nextId++}`;
    const node = manifest.create(this.ctx);
    const instance = new ModuleInstance(id, manifest, node);
    this.modules.set(id, instance);
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
    instance.destroy();
    this.modules.delete(id);
  }

  connect(sourceId, outputId, targetId, inputId) {
    const source = this.modules.get(sourceId);
    const target = this.modules.get(targetId);
    if (!source || !target) throw new Error('MODULE NOT FOUND');

    const inputDef = target.manifest.inputs.find(i => i.id === inputId);
    const outputDef = source.manifest.outputs.find(o => o.id === outputId);
    if (!inputDef || !outputDef) throw new Error('PORT NOT FOUND');

    if (inputDef.type === 'audio-param') {
      const param = target.node[inputDef.param];
      if (!param) throw new Error(`PARAM ${inputDef.param} NOT FOUND`);
      source.node.connect(param);
    } else {
      source.node.connect(target.node);
    }

    source.addOutputConnection(outputId, targetId, inputId);
    target.addInputConnection(inputId, sourceId, outputId);
  }

  disconnect(sourceId, outputId, targetId, inputId) {
    const source = this.modules.get(sourceId);
    const target = this.modules.get(targetId);
    if (!source || !target) return;

    const inputDef = target.manifest.inputs.find(i => i.id === inputId);

    if (inputDef && inputDef.type === 'audio-param') {
      const param = target.node[inputDef.param];
      if (param) source.node.disconnect(param);
    } else {
      try { source.node.disconnect(target.node); } catch {}
    }

    source.removeOutputConnection(outputId, targetId, inputId);
    target.removeInputConnection(inputId, sourceId, outputId);
  }

  setParam(moduleId, paramId, value) {
    const instance = this.modules.get(moduleId);
    if (!instance) return;
    instance.params[paramId] = value;
    instance.manifest.update(instance.node, instance.params);
  }

  toJSON() {
    return {
      modules: Array.from(this.modules.values()).map(m => ({
        id: m.id,
        manifestId: m.manifest.id,
        params: m.params
      })),
      connections: Array.from(this.modules.values()).flatMap(m =>
        Object.entries(m.outputConnections).flatMap(([outputId, conns]) =>
          conns.map(c => ({ source: m.id, output: outputId, target: c.targetModuleId, input: c.inputId }))
        )
      )
    };
  }
}
