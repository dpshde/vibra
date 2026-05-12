export function loadEchoPluck(patchBay, graph) {
  const oscId = patchBay.addModule(patchBay.registry.get("builtin-osc"));
  patchBay.setParam(oscId, "waveform", "sawtooth");
  patchBay.setParam(oscId, "frequency", 440);

  const filterId = patchBay.addModule(patchBay.registry.get("builtin-filter"));
  patchBay.setParam(filterId, "type", "lowpass");
  patchBay.setParam(filterId, "frequency", 1500);
  patchBay.setParam(filterId, "resonance", 0.8);

  const multId = patchBay.addModule(patchBay.registry.get("builtin-mult"));
  patchBay.setParam(multId, "gain", 1.0);

  const envId = patchBay.addModule(patchBay.registry.get("builtin-env"));
  patchBay.setParam(envId, "attack", 0.001);
  patchBay.setParam(envId, "decay", 0.3);
  patchBay.setParam(envId, "sustain", 0.05);
  patchBay.setParam(envId, "release", 0.4);

  const delayId = patchBay.addModule(patchBay.registry.get("builtin-delay"));
  patchBay.setParam(delayId, "delay_ms", 300);
  patchBay.setParam(delayId, "feedback", 0.4);
  patchBay.setParam(delayId, "mix", 0.4);

  const destId = patchBay.addModule(
    patchBay.registry.get("builtin-destination"),
  );

  patchBay.connect(oscId, "out", filterId, "in");
  patchBay.connect(filterId, "out", multId, "a");
  patchBay.connect(envId, "out", multId, "b");
  patchBay.connect(multId, "out", delayId, "in");
  patchBay.connect(delayId, "out", destId, "in");

  graph.addModule(oscId, patchBay.modules.get(oscId).manifest);
  graph.addModule(filterId, patchBay.modules.get(filterId).manifest);
  graph.addModule(multId, patchBay.modules.get(multId).manifest);
  graph.addModule(envId, patchBay.modules.get(envId).manifest);
  graph.addModule(delayId, patchBay.modules.get(delayId).manifest);
  graph.addModule(destId, patchBay.modules.get(destId).manifest);

  graph.redrawCables();
}
