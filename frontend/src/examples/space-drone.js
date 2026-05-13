export function loadSpaceDrone(patchBay, graph) {
  const oscId = patchBay.addModule(patchBay.registry.get("builtin-osc"));
  patchBay.setParam(oscId, "waveform", "sawtooth");
  patchBay.setParam(oscId, "frequency", 110);
  patchBay.setParam(oscId, "detune", 0);

  const osc2Id = patchBay.addModule(patchBay.registry.get("builtin-osc"));
  patchBay.setParam(osc2Id, "waveform", "sine");
  patchBay.setParam(osc2Id, "frequency", 111);
  patchBay.setParam(osc2Id, "detune", 0);

  const filterId = patchBay.addModule(patchBay.registry.get("builtin-filter"));
  patchBay.setParam(filterId, "type", "lowpass");
  patchBay.setParam(filterId, "frequency", 400);
  patchBay.setParam(filterId, "resonance", 0.6);

  const vcaId = patchBay.addModule(patchBay.registry.get("builtin-mult"));
  patchBay.setParam(vcaId, "gain", 1.0);

  const envId = patchBay.addModule(patchBay.registry.get("builtin-env"));
  patchBay.setParam(envId, "attack", 2.0);
  patchBay.setParam(envId, "decay", 0.5);
  patchBay.setParam(envId, "sustain", 0.9);
  patchBay.setParam(envId, "release", 4.0);
  patchBay.setParam(envId, "soft_attack", "On");

  const lfoId = patchBay.addModule(patchBay.registry.get("builtin-lfo"));
  patchBay.setParam(lfoId, "waveform", "sine");
  patchBay.setParam(lfoId, "frequency", 0.15);
  patchBay.setParam(lfoId, "amplitude", 0.4);
  patchBay.setParam(lfoId, "retrigger", "off");
  patchBay.setParam(lfoId, "unipolar", "off");

  const delayId = patchBay.addModule(patchBay.registry.get("builtin-delay"));
  patchBay.setParam(delayId, "delay_ms", 420);
  patchBay.setParam(delayId, "feedback", 0.55);
  patchBay.setParam(delayId, "mix", 0.4);

  const reverbId = patchBay.addModule(patchBay.registry.get("builtin-reverb"));
  patchBay.setParam(reverbId, "size", 0.9);
  patchBay.setParam(reverbId, "damp", 0.2);
  patchBay.setParam(reverbId, "mix", 0.7);

  const destId = patchBay.addModule(patchBay.registry.get("builtin-destination"));

  patchBay.connect(oscId, "out", filterId, "in");
  patchBay.connect(osc2Id, "out", filterId, "in");
  patchBay.connect(filterId, "out", vcaId, "a");
  patchBay.connect(envId, "out", vcaId, "b");
  patchBay.connect(lfoId, "out", filterId, "in");
  patchBay.connect(vcaId, "out", delayId, "in");
  patchBay.connect(delayId, "out", reverbId, "in");
  patchBay.connect(reverbId, "out", destId, "in");

  graph.addModule(oscId, patchBay.modules.get(oscId).manifest);
  graph.addModule(osc2Id, patchBay.modules.get(osc2Id).manifest);
  graph.addModule(filterId, patchBay.modules.get(filterId).manifest);
  graph.addModule(vcaId, patchBay.modules.get(vcaId).manifest);
  graph.addModule(envId, patchBay.modules.get(envId).manifest);
  graph.addModule(lfoId, patchBay.modules.get(lfoId).manifest);
  graph.addModule(delayId, patchBay.modules.get(delayId).manifest);
  graph.addModule(reverbId, patchBay.modules.get(reverbId).manifest);
  graph.addModule(destId, patchBay.modules.get(destId).manifest);

  graph.redrawCables();
}
