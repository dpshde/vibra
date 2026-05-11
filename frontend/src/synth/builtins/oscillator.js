export default {
  id: 'builtin-osc',
  name: 'Oscillator',
  category: 'source',
  inputs: [
    { id: 'freq', name: 'Freq', type: 'audio-param', param: 'frequency' },
    { id: 'detune', name: 'Detune', type: 'audio-param', param: 'detune' }
  ],
  outputs: [
    { id: 'out', name: 'Out', type: 'audio' }
  ],
  parameters: [
    { id: 'waveform', name: 'Waveform', type: 'enum', values: ['sine', 'square', 'sawtooth', 'triangle'], default: 'sine' },
    { id: 'frequency', name: 'Freq', type: 'float', min: 20, max: 20000, step: 1, default: 440 },
    { id: 'detune', name: 'Detune', type: 'float', min: -100, max: 100, step: 1, default: 0 }
  ],
  create(ctx) {
    const osc = ctx.createOscillator()
    osc.start()
    return osc
  },
  update(node, params) {
    if (node.type !== params.waveform) node.type = params.waveform
    node.frequency.setValueAtTime(params.frequency, node.context.currentTime)
    node.detune.setValueAtTime(params.detune, node.context.currentTime)
  },
  destroy(node) {
    node.stop()
    node.disconnect()
  }
}
