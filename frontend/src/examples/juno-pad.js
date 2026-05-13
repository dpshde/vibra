export function loadJunoPad(patchBay, graph) {
  const osc1Id = patchBay.addModule(patchBay.registry.get("builtin-osc"));
  patchBay.setParam(osc1Id, "waveform", "sawtooth");
  patchBay.setParam(osc1Id, "frequency", 440);
  patchBay.setParam(osc1Id, "detune", -7);

  const osc2Id = patchBay.addModule(patchBay.registry.get("builtin-osc"));
  patchBay.setParam(osc2Id, "waveform", "sawtooth");
  patchBay.setParam(osc2Id, "frequency", 440);
  patchBay.setParam(osc2Id, "detune", 7);

  const filterId = patchBay.addModule(patchBay.registry.get("builtin-filter"));
  patchBay.setParam(filterId, "type", "lowpass");
  patchBay.setParam(filterId, "frequency", 800);
  patchBay.setParam(filterId, "resonance", 0.4);

  const multId = patchBay.addModule(patchBay.registry.get("builtin-mult"));
  patchBay.setParam(multId, "gain", 0.7);

  const envId = patchBay.addModule(patchBay.registry.get("builtin-env"));
  patchBay.setParam(envId, "attack", 0.8);
  patchBay.setParam(envId, "decay", 0.5);
  patchBay.setParam(envId, "sustain", 0.7);
  patchBay.setParam(envId, "release", 2.5);

  const delayId = patchBay.addModule(patchBay.registry.get("builtin-delay"));
  patchBay.setParam(delayId, "delay_ms", 380);
  patchBay.setParam(delayId, "feedback", 0.35);
  patchBay.setParam(delayId, "mix", 0.3);

  const destId = patchBay.addModule(patchBay.registry.get("builtin-destination"));

  patchBay.connect(osc1Id, "out", filterId, "in");
  patchBay.connect(osc2Id, "out", filterId, "in");
  patchBay.connect(filterId, "out", multId, "a");
  patchBay.connect(envId, "out", multId, "b");
  patchBay.connect(multId, "out", delayId, "in");
  patchBay.connect(delayId, "out", destId, "in");

  graph.addModule(osc1Id, patchBay.modules.get(osc1Id).manifest);
  graph.addModule(osc2Id, patchBay.modules.get(osc2Id).manifest);
  graph.addModule(filterId, patchBay.modules.get(filterId).manifest);
  graph.addModule(multId, patchBay.modules.get(multId).manifest);
  graph.addModule(envId, patchBay.modules.get(envId).manifest);
  graph.addModule(delayId, patchBay.modules.get(delayId).manifest);
  graph.addModule(destId, patchBay.modules.get(destId).manifest);

  graph.redrawCables();
}
