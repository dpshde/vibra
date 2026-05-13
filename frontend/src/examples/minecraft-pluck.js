export function loadMinecraftPluck(patchBay, graph) {
  // C418-style programmed pad: warm, melancholic, slowly evolving,
  // drenched in reverb. Dual detuned triangles for the hazy core.

  const osc1Id = patchBay.addModule(patchBay.registry.get("builtin-osc"));
  patchBay.setParam(osc1Id, "waveform", "triangle");
  patchBay.setParam(osc1Id, "frequency", 220);
  patchBay.setParam(osc1Id, "detune", -8);

  const osc2Id = patchBay.addModule(patchBay.registry.get("builtin-osc"));
  patchBay.setParam(osc2Id, "waveform", "triangle");
  patchBay.setParam(osc2Id, "frequency", 220);
  patchBay.setParam(osc2Id, "detune", 8);

  // Gentle lowpass — bright enough to breathe, soft enough to stay hazy
  const filterId = patchBay.addModule(patchBay.registry.get("builtin-filter"));
  patchBay.setParam(filterId, "type", "lowpass");
  patchBay.setParam(filterId, "frequency", 1600);
  patchBay.setParam(filterId, "resonance", 0.25);

  // Slow breathing envelope — the pad hangs in the air
  const envId = patchBay.addModule(patchBay.registry.get("builtin-env"));
  patchBay.setParam(envId, "attack", 0.5);
  patchBay.setParam(envId, "decay", 1.5);
  patchBay.setParam(envId, "sustain", 0.9);
  patchBay.setParam(envId, "release", 2.5);
  patchBay.setParam(envId, "soft_attack", "On");

  const vcaId = patchBay.addModule(patchBay.registry.get("builtin-mult"));
  patchBay.setParam(vcaId, "gain", 0.9);

  // Subtle delay — just a faint echo tail, not a rhythmic effect
  const delayId = patchBay.addModule(patchBay.registry.get("builtin-delay"));
  patchBay.setParam(delayId, "delay_ms", 420);
  patchBay.setParam(delayId, "feedback", 0.25);
  patchBay.setParam(delayId, "mix", 0.2);

  // Cavernous reverb — this is where C418 lives
  const reverbId = patchBay.addModule(patchBay.registry.get("builtin-reverb"));
  patchBay.setParam(reverbId, "size", 0.9);
  patchBay.setParam(reverbId, "damp", 0.2);
  patchBay.setParam(reverbId, "mix", 0.65);

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
