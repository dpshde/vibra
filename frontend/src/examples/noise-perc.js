export function loadNoisePercussion(patchBay, graph) {
  const noiseId = patchBay.addModule(patchBay.registry.get("builtin-noise"));
  patchBay.setParam(noiseId, "color", 0);

  const filterId = patchBay.addModule(patchBay.registry.get("builtin-filter"));
  patchBay.setParam(filterId, "type", "highpass");
  patchBay.setParam(filterId, "frequency", 8000);
  patchBay.setParam(filterId, "resonance", 2.0);

  const multId = patchBay.addModule(patchBay.registry.get("builtin-mult"));
  patchBay.setParam(multId, "gain", 1.0);

  const envId = patchBay.addModule(patchBay.registry.get("builtin-env"));
  patchBay.setParam(envId, "attack", 0.001);
  patchBay.setParam(envId, "decay", 0.08);
  patchBay.setParam(envId, "sustain", 0);
  patchBay.setParam(envId, "release", 0.05);

  const destId = patchBay.addModule(
    patchBay.registry.get("builtin-destination"),
  );

  patchBay.connect(noiseId, "out", filterId, "in");
  patchBay.connect(filterId, "out", multId, "a");
  patchBay.connect(envId, "out", multId, "b");
  patchBay.connect(multId, "out", destId, "in");

  graph.addModule(noiseId, patchBay.modules.get(noiseId).manifest);
  graph.addModule(filterId, patchBay.modules.get(filterId).manifest);
  graph.addModule(multId, patchBay.modules.get(multId).manifest);
  graph.addModule(envId, patchBay.modules.get(envId).manifest);
  graph.addModule(destId, patchBay.modules.get(destId).manifest);

  graph.redrawCables();
}
