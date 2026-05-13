export function loadFmBell(patchBay, graph) {
  const carrierId = patchBay.addModule(patchBay.registry.get("builtin-osc"));
  patchBay.setParam(carrierId, "waveform", "sine");
  patchBay.setParam(carrierId, "frequency", 440);
  patchBay.setParam(carrierId, "detune", 0);

  const modulatorId = patchBay.addModule(patchBay.registry.get("builtin-osc"));
  patchBay.setParam(modulatorId, "waveform", "sine");
  patchBay.setParam(modulatorId, "frequency", 880);
  patchBay.setParam(modulatorId, "detune", 0);

  const ringId = patchBay.addModule(patchBay.registry.get("builtin-mult"));
  patchBay.setParam(ringId, "gain", 1.0);

  const envId = patchBay.addModule(patchBay.registry.get("builtin-env"));
  patchBay.setParam(envId, "attack", 0.001);
  patchBay.setParam(envId, "decay", 1.5);
  patchBay.setParam(envId, "sustain", 0.1);
  patchBay.setParam(envId, "release", 2.5);

  const vcaId = patchBay.addModule(patchBay.registry.get("builtin-mult"));
  patchBay.setParam(vcaId, "gain", 0.9);

  const filterId = patchBay.addModule(patchBay.registry.get("builtin-filter"));
  patchBay.setParam(filterId, "type", "lowpass");
  patchBay.setParam(filterId, "frequency", 5000);
  patchBay.setParam(filterId, "resonance", 0.3);

  const reverbId = patchBay.addModule(patchBay.registry.get("builtin-reverb"));
  patchBay.setParam(reverbId, "size", 0.7);
  patchBay.setParam(reverbId, "damp", 0.4);
  patchBay.setParam(reverbId, "mix", 0.4);

  const destId = patchBay.addModule(patchBay.registry.get("builtin-destination"));

  patchBay.connect(carrierId, "out", ringId, "a");
  patchBay.connect(modulatorId, "out", ringId, "b");
  patchBay.connect(ringId, "out", vcaId, "a");
  patchBay.connect(envId, "out", vcaId, "b");
  patchBay.connect(vcaId, "out", filterId, "in");
  patchBay.connect(filterId, "out", reverbId, "in");
  patchBay.connect(reverbId, "out", destId, "in");

  graph.addModule(carrierId, patchBay.modules.get(carrierId).manifest);
  graph.addModule(modulatorId, patchBay.modules.get(modulatorId).manifest);
  graph.addModule(ringId, patchBay.modules.get(ringId).manifest);
  graph.addModule(envId, patchBay.modules.get(envId).manifest);
  graph.addModule(vcaId, patchBay.modules.get(vcaId).manifest);
  graph.addModule(filterId, patchBay.modules.get(filterId).manifest);
  graph.addModule(reverbId, patchBay.modules.get(reverbId).manifest);
  graph.addModule(destId, patchBay.modules.get(destId).manifest);

  graph.redrawCables();
}
