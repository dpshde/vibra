const NOTE_OFFSETS = {
  C: 0,
  "C#": 1,
  D: 2,
  "D#": 3,
  E: 4,
  F: 5,
  "F#": 6,
  G: 7,
  "G#": 8,
  A: 9,
  "A#": 10,
  B: 11,
};

function noteToMidi(note) {
  if (typeof note === "number") return note;

  const match = /^([A-G]#?)(-?\d+)$/.exec(note);
  if (!match) {
    console.warn("[VIBRA] Invalid note, defaulting to A4:", note);
    return 69;
  }

  const [, pitchClass, octaveText] = match;
  return (Number(octaveText) + 1) * 12 + NOTE_OFFSETS[pitchClass];
}

export class EngineBridge {
  constructor(audioContext) {
    this.ctx = audioContext;
    this.workletNode = null;
    this.ready = false;
    this.pending = [];
    this.onSilentWarning = null;
    this.onSilentResolved = null;
  }

  async init() {
    const workletUrl = new URL("../worklet/vibra-processor.js", import.meta.url)
      .href;
    await this.ctx.audioWorklet.addModule(workletUrl);

    this.workletNode = new AudioWorkletNode(this.ctx, "vibra-processor", {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });

    this.manifests = [];

    this.workletNode.port.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === "ready") {
        this.ready = true;
        for (const cb of this.pending) cb();
        this.pending = [];
      } else if (msg.type === "process-stats") {
        console.log("[VIBRA-MAIN] process-stats", msg);
      } else if (msg.type === "silent-warning") {
        if (typeof this.onSilentWarning === "function") this.onSilentWarning();
      } else if (msg.type === "silent-resolved") {
        if (typeof this.onSilentResolved === "function")
          this.onSilentResolved();
      } else if (msg.type === "error") {
        console.error("WORKLET ERROR:", msg.message);
      }
    };

    const wasmResponse = await fetch("/vibra_dsp.wasm");
    const wasmBytes = await wasmResponse.arrayBuffer();
    this.workletNode.port.postMessage({ type: "init-wasm", wasmBytes });

    return new Promise((resolve, reject) => {
      if (this.ready) {
        resolve();
        return;
      }
      const timeout = setTimeout(
        () => reject(new Error("Wasm init timeout")),
        5000,
      );
      this.pending.push(() => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  getWorkletNode() {
    return this.workletNode;
  }

  addModule(id, kind) {
    this.workletNode.port.postMessage({ type: "addModule", id, kind });
  }

  removeModule(id) {
    this.workletNode.port.postMessage({ type: "removeModule", id });
  }

  connect(sourceId, sourcePort, targetId, targetPort) {
    this.workletNode.port.postMessage({
      type: "connect",
      sourceId,
      sourcePort,
      targetId,
      targetPort,
    });
  }

  disconnect(sourceId, sourcePort, targetId, targetPort) {
    this.workletNode.port.postMessage({
      type: "disconnect",
      sourceId,
      sourcePort,
      targetId,
      targetPort,
    });
  }

  setParam(moduleId, paramId, value) {
    this.workletNode.port.postMessage({
      type: "param",
      moduleId,
      paramId,
      value,
    });
  }

  noteOn(note, velocity) {
    this.workletNode.port.postMessage({
      type: "noteOn",
      note: noteToMidi(note),
      velocity,
    });
  }

  noteOff(note) {
    this.workletNode.port.postMessage({
      type: "noteOff",
      note: noteToMidi(note),
    });
  }

  setVoiceMode(mode, polyphony, unisonCount, unisonDetune) {
    this.workletNode.port.postMessage({
      type: "voiceMode",
      mode,
      polyphony,
      unisonCount,
      unisonDetune,
    });
  }
}
