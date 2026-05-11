/**
 * Example Vibra Plugin: Simple LFO
 * Drop this file into frontend/src/plugins/ and it auto-loads on next build.
 */

export default {
  id: 'example-lfo',
  name: 'LFO',
  category: 'source',
  inputs: [
    { id: 'rate', name: 'Rate', type: 'audio-param', param: 'frequency' }
  ],
  outputs: [
    { id: 'out', name: 'Out', type: 'audio' }
  ],
  parameters: [
    { id: 'frequency', name: 'Rate', type: 'float', min: 0.1, max: 20, step: 0.1, default: 2 }
  ],
  create(ctx) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 2
    osc.start()
    return osc
  },
  update(node, params) {
    node.frequency.setValueAtTime(params.frequency, node.context.currentTime)
  },
  destroy(node) {
    node.stop()
    node.disconnect()
  }
}
