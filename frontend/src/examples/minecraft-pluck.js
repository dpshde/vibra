export function loadMinecraftPluck(patchBay, graph) {
  // Detuned dual oscillators for that slightly chorus-y music-box warmth
  const osc1Id = patchBay.addModule(patchBay.registry.get("builtin-osc"));
  patchBay.setParam(osc1Id, "waveform", "triangle");
  patchBay.setParam(osc1Id, "frequency", 440);
  patchBay.setParam(osc1Id, "detune", -5);

  const osc2Id = patchBay.addModule(patchBay.registry.get("builtin-osc"));
  patchBay.setParam(osc2Id, "waveform", "triangle");
  patchBay.setParam(osc2Id, "frequency", 440);
  patchBay.setParam(osc2Id, "detune", 5);

  // Brighten slightly above the triangle's natural mellowness
  const filterId = patchBay.addModule(patchBay.registry.get("builtin-filter"));
  patchBay.setParam(filterId, "type", "lowpass");
  patchBay.setParam(filterId, "frequency", 3500);
  patchBay.setParam(filterId, "resonance", 0.4);

  // Tight pluck envelope — the hallmark of the Minecraft sound
  const envId = patchBay.addModule(patchBay.registry.get("builtin-env"));
  patchBay.setParam(envId, "attack", 0.001);
  patchBay.setParam(envId, "decay", 0.12);
  patchBay.setParam(envId, "sustain", 0.0);
  patchBay.setParam(envId, "release", 0.35);
  patchBay.setParam(envId, "soft_attack", "Off");

  const vcaId = patchBay.addModule(patchBay.registry.get("builtin-mult"));
  patchBay.setParam(vcaId, "gain", 1.0);

  // Cavernous reverb — the "cave" ambience
  const reverbId = patchBay.addModule(patchBay.registry.get("builtin-reverb"));
  patchBay.setParam(reverbId, "size", 0.85);
  patchBay.setParam(reverbId, "damp", 0.3);
  patchBay.setParam(reverbId, "mix", 0.6);

  // Gentle delay echo for the trail
  const delayId = patchBay.addModule(patchBay.registry.get("builtin-delay"));
  patchBay.setParam(delayId, "delay_ms", 320);
  patchBay.setParam(delayId, "feedback", 0.3);
  patchBay.setParam(delayId, "mix", 0.25);

  const destId = patchBay.addModule(patchBay.registry.get("builtin-destination"));

  patchBay.connect(osc1Id, "out", filterId, "in");
  patchBay.connect(osc2Id, "out", filterId, "in");
  patchBay.connect(filterId, "out", vcaId, "a");
  patchBay.connect(envId, "out", vcaId, "b");
  patchBay.connect(vcaId, "out", delayId, "in");
  patchBay.connect(delayId, "out", reverbId, "in");
  patchBay.connect(reverbId, "out", destId, "in");

  graph.addModule(osc1Id, patchBay.modules.get(osc1Id).manifest);
  graph.addModule(osc2Id, patchBay.modules.get(osc2Id).manifest);
  graph.addModule(filterId, patchBay.modules.get(filterId).manifest);
  graph.addModule(envId, patchBay.modules.get(envId).manifest);
  graph.addModule(vcaId, patchBay.modules.get(vcaId).manifest);
  graph.addModule(delayId, patchBay.modules.get(delayId).manifest);
  graph.addModule(reverbId, patchBay.modules.get(reverbId).manifest);
  graph.addModule(destId, patchBay.modules.get(destId).manifest);

  graph.redrawCables();
}
