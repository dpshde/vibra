export default {
  id: 'builtin-destination',
  name: 'Out',
  category: 'output',
  inputs: [
    { id: 'in', name: 'In', type: 'audio' }
  ],
  outputs: [],
  parameters: [],
  create(ctx) {
    return ctx.destination
  },
  update(node, params) {
    // No-op
  },
  destroy(node) {
    // Never disconnect destination
  }
}
