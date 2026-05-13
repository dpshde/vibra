export function loadTremoloPad(patchBay, graph) {
  const oscId = patchBay.addModule(patchBay.registry.get("builtin-osc"));
  patchBay.setParam(oscId, "waveform", "triangle");
  patchBay.setParam(oscId, "frequency", 440);

  const vcaId = patchBay.addModule(patchBay.registry.get("builtin-mult"));
  patchBay.setParam(vcaId, "gain", 1.0);

  const tremId = patchBay.addModule(patchBay.registry.get("builtin-mult"));
  patchBay.setParam(tremId, "gain", 1.0);

  const envId = patchBay.addModule(patchBay.registry.get("builtin-env"));
  patchBay.setParam(envId, "attack", 1.0);
  patchBay.setParam(envId, "decay", 0.2);
  patchBay.setParam(envId, "sustain", 0.8);
  patchBay.setParam(envId, "release", 1.5);
  patchBay.setParam(envId, "soft_attack", "On");

  const lfoId = patchBay.addModule(patchBay.registry.get("builtin-lfo"));
  patchBay.setParam(lfoId, "waveform", "sine");
  patchBay.setParam(lfoId, "frequency", 5);
  patchBay.setParam(lfoId, "amplitude", 1.0);
  patchBay.setParam(lfoId, "retrigger", "off");
  patchBay.setParam(lfoId, "unipolar", "on");

  const reverbId = patchBay.addModule(patchBay.registry.get("builtin-reverb"));
  patchBay.setParam(reverbId, "size", 0.5);
  patchBay.setParam(reverbId, "damp", 0.4);
  patchBay.setParam(reverbId, "mix", 0.25);

  const destId = patchBay.addModule(
    patchBay.registry.get("builtin-destination"),
  );

  patchBay.connect(oscId, "out", vcaId, "a");
  patchBay.connect(envId, "out", vcaId, "b");
  patchBay.connect(vcaId, "out", tremId, "a");
  patchBay.connect(lfoId, "out", tremId, "b");
  patchBay.connect(tremId, "out", reverbId, "in");
  patchBay.connect(reverbId, "out", destId, "in");

  graph.addModule(oscId, patchBay.modules.get(oscId).manifest);
  graph.addModule(vcaId, patchBay.modules.get(vcaId).manifest);
  graph.addModule(envId, patchBay.modules.get(envId).manifest);
  graph.addModule(tremId, patchBay.modules.get(tremId).manifest);
  graph.addModule(lfoId, patchBay.modules.get(lfoId).manifest);
  graph.addModule(reverbId, patchBay.modules.get(reverbId).manifest);
  graph.addModule(destId, patchBay.modules.get(destId).manifest);

  graph.redrawCables();
}
