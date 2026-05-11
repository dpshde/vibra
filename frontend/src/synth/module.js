export class ModuleInstance {
  constructor(id, manifest, node) {
    this.id = id;
    this.manifest = manifest;
    this.node = node;
    this.params = {};
    for (const p of manifest.parameters) {
      this.params[p.id] = p.default;
    }
    this.inputConnections = {};
    this.outputConnections = {};
    this.manifest.update(this.node, this.params);
  }

  addInputConnection(inputId, sourceModuleId, outputId) {
    if (!this.inputConnections[inputId]) this.inputConnections[inputId] = [];
    this.inputConnections[inputId].push({ sourceModuleId, outputId });
  }

  removeInputConnection(inputId, sourceModuleId, outputId) {
    if (!this.inputConnections[inputId]) return;
    this.inputConnections[inputId] = this.inputConnections[inputId].filter(
      c => !(c.sourceModuleId === sourceModuleId && c.outputId === outputId)
    );
  }

  addOutputConnection(outputId, targetModuleId, inputId) {
    if (!this.outputConnections[outputId]) this.outputConnections[outputId] = [];
    this.outputConnections[outputId].push({ targetModuleId, inputId });
  }

  removeOutputConnection(outputId, targetModuleId, inputId) {
    if (!this.outputConnections[outputId]) return;
    this.outputConnections[outputId] = this.outputConnections[outputId].filter(
      c => !(c.targetModuleId === targetModuleId && c.inputId === inputId)
    );
  }

  destroy() {
    this.manifest.destroy(this.node);
  }
}
