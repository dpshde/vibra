export function loadTremoloPad(patchBay, graph) {
  const oscId = patchBay.addModule(patchBay.registry.get("builtin-osc"));
  patchBay.setParam(oscId, "waveform", "triangle");
  patchBay.setParam(oscId, "frequency", 440);

  const multId = patchBay.addModule(patchBay.registry.get("builtin-mult"));
  patchBay.setParam(multId, "gain", 1.0);

  const lfoId = patchBay.addModule(patchBay.registry.get("builtin-lfo"));
  patchBay.setParam(lfoId, "waveform", "sine");
  patchBay.setParam(lfoId, "frequency", 5);
  patchBay.setParam(lfoId, "amplitude", 1.0);
  patchBay.setParam(lfoId, "retrigger", "off");

  const destId = patchBay.addModule(
    patchBay.registry.get("builtin-destination"),
  );

  patchBay.connect(oscId, "out", multId, "a");
  patchBay.connect(lfoId, "out", multId, "b");
  patchBay.connect(multId, "out", destId, "in");

  graph.addModule(oscId, patchBay.modules.get(oscId).manifest);
  graph.addModule(multId, patchBay.modules.get(multId).manifest);
  graph.addModule(lfoId, patchBay.modules.get(lfoId).manifest);
  graph.addModule(destId, patchBay.modules.get(destId).manifest);

  graph.redrawCables();
}
