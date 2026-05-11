export default {
  id: 'builtin-filter',
  name: 'Filter',
  category: 'effect',
  inputs: [
    { id: 'in', name: 'In', type: 'audio' },
    { id: 'frequency', name: 'Freq', type: 'audio-param', param: 'frequency' },
    { id: 'q', name: 'Q', type: 'audio-param', param: 'Q' }
  ],
  outputs: [
    { id: 'out', name: 'Out', type: 'audio' }
  ],
  parameters: [
    { id: 'type', name: 'Type', type: 'enum', values: ['lowpass', 'highpass', 'bandpass', 'notch', 'allpass'], default: 'lowpass' },
    { id: 'frequency', name: 'Freq', type: 'float', min: 10, max: 20000, step: 1, default: 1000 },
    { id: 'Q', name: 'Q', type: 'float', min: 0, max: 30, step: 0.1, default: 1 }
  ],
  create(ctx) {
    return ctx.createBiquadFilter()
  },
  update(node, params) {
    if (node.type !== params.type) node.type = params.type
    node.frequency.setValueAtTime(params.frequency, node.context.currentTime)
    node.Q.setValueAtTime(params.Q, node.context.currentTime)
  },
  destroy(node) {
    node.disconnect()
  }
}
