import { ModuleInstance } from "./module.js";

const COMPATIBILITY_MESSAGES = {
  exact: null,
  compatible: {
    "modulation-level": {
      text: "Modulation into a Level input creates dynamic shaping — tremolo, wah, or evolving textures. This is a classic pairing.",
      suggestion: null,
    },
    "level-modulation": {
      text: "Level into a Modulation input gives a unipolar offset. The modulation will stay above center and won't swing negative.",
      suggestion: "If you want bipolar movement, try an LFO output instead.",
    },
    "audio-trigger": {
      text: "Audio into a Trigger input fires on every waveform crossing, creating a frantic stuttering effect.",
      suggestion: "If you want note-based gating, leave this unconnected (keyboard triggers automatically) or use a dedicated trigger module.",
    },
    "trigger-audio": {
      text: "Trigger into an Audio input creates sparse clicks or pulses. The signal will be mostly silent with brief spikes.",
      suggestion: "If you want a continuous tone, try an Oscillator or Noise source.",
    },
    "pitch-modulation": {
      text: "Pitch into a Modulation input shifts the modulation center frequency based on note height.",
      suggestion: "If you want rhythmic wobble, try an LFO output instead.",
    },
    "modulation-pitch": {
      text: "Modulation into a Pitch input creates vibrato or pitch wobble. Great for expressive leads.",
      suggestion: null,
    },
    "pitch-level": {
      text: "Pitch into a Level input makes higher notes louder and lower notes quieter — a velocity-like effect.",
      suggestion: "If you want consistent volume shaping, try an Envelope output instead.",
    },
    "level-pitch": {
      text: "Level into a Pitch input shifts pitch by amplitude. Creates ring-modulation-like artifacts.",
      suggestion: "If you want pitch glide or vibrato, try an LFO or dedicated pitch source.",
    },
    "modulation-audio": {
      text: "Modulation into an Audio input is very quiet unless boosted. You'll hear a faint wobble, not a tone.",
      suggestion: "If you want a sound source here, try an Oscillator or Noise module.",
    },
    "audio-modulation": {
      text: "Audio into a Modulation input creates ring modulation / AM synthesis. Harsh, complex, and often dissonant.",
      suggestion: "If you want smooth rhythmic shaping, try an LFO or Envelope output instead.",
    },
  },
  mismatch: {
    default: {
      text: "This pairing is unusual. The signals are technically compatible, but the result may not be what you expect.",
      suggestion: "Check the port's accepted types and try a matching source.",
    },
  },
};

function getCompatibilityLevel(sourceType, targetAccepts, targetSignalType) {
  if (!Array.isArray(targetAccepts) || targetAccepts.length === 0) return "exact";
  if (targetAccepts.includes(sourceType)) return "exact";
  const compatKey = `${sourceType}-${targetSignalType || "audio"}`;
  if (COMPATIBILITY_MESSAGES.compatible[compatKey]) return "compatible";
  return "mismatch";
}

function getCompatibilityMessage(sourceType, targetSignalType) {
  const compatKey = `${sourceType}-${targetSignalType || "audio"}`;
  const entry = COMPATIBILITY_MESSAGES.compatible[compatKey] || COMPATIBILITY_MESSAGES.mismatch.default;
  let text = entry.text;
  if (entry.suggestion) {
    text += " " + entry.suggestion;
  }
  return text;
}

function getCompatibility(sourceType, targetAccepts, targetSignalType) {
  const level = getCompatibilityLevel(sourceType, targetAccepts, targetSignalType);
  const message = level === "exact" ? null : getCompatibilityMessage(sourceType, targetSignalType);
  return { level, message, sourceType, targetType: targetSignalType };
}

export class PatchBay {
  constructor(bridge, registry) {
    this.bridge = bridge;
    this.registry = registry;
    this.modules = new Map();
    this.nextId = 1;
    this.voiceConfig = {
      mode: "poly",
      polyphony: 8,
      unisonCount: 1,
      unisonDetune: 0,
    };
  }

  setVoiceConfig(config) {
    this.voiceConfig = { ...this.voiceConfig, ...config };
    if (this.bridge) {
      const modeMap = { mono: 0, poly: 1, unison: 2, legato: 3, paraphonic: 4 };
      const mode = modeMap[this.voiceConfig.mode] ?? 1;
      this.bridge.setVoiceMode(
        mode,
        this.voiceConfig.polyphony,
        this.voiceConfig.unisonCount,
        this.voiceConfig.unisonDetune,
      );
    }
  }

  addModule(manifest) {
    const id = this.nextId++;
    let node = null;
    if (manifest.kind === undefined && typeof manifest.create === "function") {
      node = manifest.create();
    }
    const instance = new ModuleInstance(id, manifest, node);
    this.modules.set(id, instance);

    if (manifest.kind !== undefined) {
      this.bridge.addModule(id, manifest.kind);
      for (const p of manifest.parameters) {
        if (p.paramId !== undefined && p.default !== undefined) {
          let val = p.default;
          if (p.type === "enum") val = p.values.indexOf(p.default);
          this.bridge.setParam(id, p.paramId, val);
        }
      }
    }
    return id;
  }

  removeModule(id) {
    const instance = this.modules.get(id);
    if (!instance) return;
    for (const [inputId, conns] of Object.entries(instance.inputConnections)) {
      for (const conn of [...conns]) {
        this.disconnect(conn.sourceModuleId, conn.outputId, id, inputId);
      }
    }
    for (const [outputId, conns] of Object.entries(
      instance.outputConnections,
    )) {
      for (const conn of [...conns]) {
        this.disconnect(id, outputId, conn.targetModuleId, conn.inputId);
      }
    }
    if (instance.manifest.kind !== undefined) {
      this.bridge.removeModule(id);
    }
    instance.destroy();
    this.modules.delete(id);
  }

  connect(sourceId, outputId, targetId, inputId) {
    const source = this.modules.get(sourceId);
    const target = this.modules.get(targetId);
    if (!source || !target) throw new Error("MODULE NOT FOUND");

    const outputIdx = source.manifest.outputs.findIndex(
      (o) => o.id === outputId,
    );
    const inputIdx = target.manifest.inputs.findIndex((i) => i.id === inputId);
    if (outputIdx === -1 || inputIdx === -1) throw new Error("PORT NOT FOUND");

    const compat = this.getCompatibility(sourceId, outputId, targetId, inputId);
    if (compat && compat.level === "mismatch") {
      console.warn("COMPATIBILITY NOTE:", compat.message);
    }

    if (
      source.manifest.kind !== undefined &&
      target.manifest.kind !== undefined
    ) {
      this.bridge.connect(sourceId, outputIdx, targetId, inputIdx);
    }

    source.addOutputConnection(outputId, targetId, inputId);
    target.addInputConnection(inputId, sourceId, outputId);
  }

  getCompatibility(sourceId, outputId, targetId, inputId) {
    const source = this.modules.get(sourceId);
    const target = this.modules.get(targetId);
    if (!source || !target) return null;

    const output = source.manifest.outputs.find((o) => o.id === outputId);
    const input = target.manifest.inputs.find((i) => i.id === inputId);
    if (!output || !input) return null;

    return getCompatibility(output.signalType, input.accepts, input.signalType);
  }

  disconnect(sourceId, outputId, targetId, inputId) {
    const source = this.modules.get(sourceId);
    const target = this.modules.get(targetId);
    if (!source || !target) return;

    const outputIdx = source.manifest.outputs.findIndex(
      (o) => o.id === outputId,
    );
    const inputIdx = target.manifest.inputs.findIndex((i) => i.id === inputId);

    if (
      source.manifest.kind !== undefined &&
      target.manifest.kind !== undefined
    ) {
      this.bridge.disconnect(sourceId, outputIdx, targetId, inputIdx);
    }

    source.removeOutputConnection(outputId, targetId, inputId);
    target.removeInputConnection(inputId, sourceId, outputId);
  }

  setParam(moduleId, paramId, value) {
    const instance = this.modules.get(moduleId);
    if (!instance) return;
    instance.params[paramId] = value;

    const manifest = instance.manifest;
    const paramDef = manifest.parameters.find((p) => p.id === paramId);
    if (
      paramDef &&
      paramDef.paramId !== undefined &&
      manifest.kind !== undefined
    ) {
      let val = value;
      if (paramDef.type === "enum") val = paramDef.values.indexOf(value);
      this.bridge.setParam(moduleId, paramDef.paramId, val);
    }

    if (typeof manifest.update === "function") {
      manifest.update(instance.node, instance.params);
    }
  }

  noteOn(note, velocity) {
    this.bridge.noteOn(note, velocity);
  }

  noteOff(note) {
    this.bridge.noteOff(note);
  }

  validatePatch() {
    let destId = null;
    for (const [id, inst] of this.modules) {
      if (inst.manifest.category === "output") {
        destId = id;
        break;
      }
    }
    if (!destId) {
      return "Add a Destination module to hear sound.";
    }
    const dest = this.modules.get(destId);
    const destInputs = Object.keys(dest.inputConnections);
    if (destInputs.length === 0) {
      return "Destination has no input. Connect a source module to it.";
    }
    for (const [srcId, inst] of this.modules) {
      if (inst.manifest.category !== "source") continue;
      if (this._reachesAudioSource(srcId, destId)) return null;
    }
    return "No audio source (Oscillator / Noise) is connected to the Destination.";
  }

  _reachesAudioSource(startId, targetId) {
    const visited = new Set();
    const queue = [startId];
    while (queue.length) {
      const curr = queue.shift();
      if (curr === targetId) return true;
      if (visited.has(curr)) continue;
      visited.add(curr);
      const inst = this.modules.get(curr);
      if (!inst) continue;
      // The LFO generates its own waveform; it does not pass audio from its
      // inputs (FM / Sync) through to its output. Tracing through it would give
      // a false positive for patches like Osc→LFO→Gain→Destination.
      if (inst.manifest.id === "builtin-lfo") continue;
      for (const conns of Object.values(inst.outputConnections)) {
        for (const c of conns) {
          queue.push(c.targetModuleId);
        }
      }
    }
    return false;
  }

  toJSON() {
    return {
      modules: Array.from(this.modules.values()).map((m) => ({
        id: m.id,
        manifestId: m.manifest.id,
        params: m.params,
      })),
      connections: Array.from(this.modules.values()).flatMap((m) =>
        Object.entries(m.outputConnections).flatMap(([outputId, conns]) =>
          conns.map((c) => ({
            source: m.id,
            output: outputId,
            target: c.targetModuleId,
            input: c.inputId,
          })),
        ),
      ),
    };
  }
}
