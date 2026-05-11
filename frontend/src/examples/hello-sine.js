export function loadHelloSine(patchBay, graph) {
  const oscId = patchBay.addModule(patchBay.registry.get('builtin-osc'))
  patchBay.setParam(oscId, 'waveform', 'sine')
  patchBay.setParam(oscId, 'frequency', 440)

  const gainId = patchBay.addModule(patchBay.registry.get('builtin-gain'))
  patchBay.setParam(gainId, 'gain', 0.3)

  const scopeId = patchBay.addModule(patchBay.registry.get('builtin-scope'))

  const destId = patchBay.addModule(patchBay.registry.get('builtin-destination'))

  patchBay.connect(oscId, 'out', gainId, 'in')
  patchBay.connect(gainId, 'out', scopeId, 'in')
  patchBay.connect(gainId, 'out', destId, 'in')

  graph.addModule(oscId, patchBay.modules.get(oscId).manifest, 120, 120)
  graph.addModule(gainId, patchBay.modules.get(gainId).manifest, 360, 120)
  graph.addModule(scopeId, patchBay.modules.get(scopeId).manifest, 360, 360)
  graph.addModule(destId, patchBay.modules.get(destId).manifest, 600, 120)

  graph.redrawCables()
}
