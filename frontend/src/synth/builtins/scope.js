export default {
  id: 'builtin-scope',
  name: 'Scope',
  category: 'utility',
  inputs: [
    { id: 'in', name: 'In', type: 'audio' }
  ],
  outputs: [],
  parameters: [],
  create(ctx) {
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    return analyser
  },
  update(node, params) {
    // No parameters
  },
  destroy(node) {
    node.disconnect()
  }
}
