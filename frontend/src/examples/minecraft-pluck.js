export function loadMinecraftPluck(patchBay, graph) {
  // Single clean source — the note block is a pitched PCM sample, not a chorus
  const oscId = patchBay.addModule(patchBay.registry.get("builtin-osc"));
  patchBay.setParam(oscId, "waveform", "triangle");
  patchBay.setParam(oscId, "frequency", 440);
  patchBay.setParam(oscId, "detune", 0);

  // Very gentle lowpass — almost transparent, just takes the digital edge off
  const filterId = patchBay.addModule(patchBay.registry.get("builtin-filter"));
  patchBay.setParam(filterId, "type", "lowpass");
  patchBay.setParam(filterId, "frequency", 8000);
  patchBay.setParam(filterId, "resonance", 0.2);

  // Ultra-tight pluck — short, dry, discrete
  const envId = patchBay.addModule(patchBay.registry.get("builtin-env"));
  patchBay.setParam(envId, "attack", 0.001);
  patchBay.setParam(envId, "decay", 0.06);
  patchBay.setParam(envId, "sustain", 0.0);
  patchBay.setParam(envId, "release", 0.15);
  patchBay.setParam(envId, "soft_attack", "Off");

  const vcaId = patchBay.addModule(patchBay.registry.get("builtin-mult"));
  patchBay.setParam(vcaId, "gain", 1.0);

  // The Minecraft note block is bone dry — no reverb, no delay
  const destId = patchBay.addModule(patchBay.registry.get("builtin-destination"));

  patchBay.connect(oscId, "out", filterId, "in");
  patchBay.connect(filterId, "out", vcaId, "a");
  patchBay.connect(envId, "out", vcaId, "b");
  patchBay.connect(vcaId, "out", destId, "in");

  graph.addModule(oscId, patchBay.modules.get(oscId).manifest);
  graph.addModule(filterId, patchBay.modules.get(filterId).manifest);
  graph.addModule(envId, patchBay.modules.get(envId).manifest);
  graph.addModule(vcaId, patchBay.modules.get(vcaId).manifest);
  graph.addModule(destId, patchBay.modules.get(destId).manifest);

  graph.redrawCables();
}
