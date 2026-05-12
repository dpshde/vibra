export function loadPluckSynth(patchBay, graph) {
  const oscId = patchBay.addModule(patchBay.registry.get("builtin-osc"));
  patchBay.setParam(oscId, "waveform", "sawtooth");
  patchBay.setParam(oscId, "frequency", 440);
  patchBay.setParam(oscId, "detune", 0);

  const filterId = patchBay.addModule(patchBay.registry.get("builtin-filter"));
  patchBay.setParam(filterId, "type", "lowpass");
  patchBay.setParam(filterId, "frequency", 1200);
  patchBay.setParam(filterId, "resonance", 1.0);

  const multId = patchBay.addModule(patchBay.registry.get("builtin-mult"));
  patchBay.setParam(multId, "gain", 1.0);

  const envId = patchBay.addModule(patchBay.registry.get("builtin-env"));
  patchBay.setParam(envId, "attack", 0.001);
  patchBay.setParam(envId, "decay", 0.4);
  patchBay.setParam(envId, "sustain", 0.1);
  patchBay.setParam(envId, "release", 0.3);

  const destId = patchBay.addModule(
    patchBay.registry.get("builtin-destination"),
  );

  patchBay.connect(oscId, "out", filterId, "in");
  patchBay.connect(filterId, "out", multId, "a");
  patchBay.connect(envId, "out", multId, "b");
  patchBay.connect(multId, "out", destId, "in");

  graph.addModule(oscId, patchBay.modules.get(oscId).manifest);
  graph.addModule(filterId, patchBay.modules.get(filterId).manifest);
  graph.addModule(multId, patchBay.modules.get(multId).manifest);
  graph.addModule(envId, patchBay.modules.get(envId).manifest);
  graph.addModule(destId, patchBay.modules.get(destId).manifest);

  graph.redrawCables();
}
