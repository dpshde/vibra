export default {
  id: 'builtin-gain',
  name: 'Gain',
  category: 'utility',
  inputs: [
    { id: 'in', name: 'In', type: 'audio' },
    { id: 'gain', name: 'Gain', type: 'audio-param', param: 'gain' }
  ],
  outputs: [
    { id: 'out', name: 'Out', type: 'audio' }
  ],
  parameters: [
    { id: 'gain', name: 'Gain', type: 'float', min: 0, max: 2, step: 0.01, default: 0.5 }
  ],
  create(ctx) {
    return ctx.createGain()
  },
  update(node, params) {
    node.gain.setValueAtTime(params.gain, node.context.currentTime)
  },
  destroy(node) {
    node.disconnect()
  }
}
