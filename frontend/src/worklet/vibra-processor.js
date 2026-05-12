class VibraProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.wasm = null;
    this.memory = null;
    this.ready = false;
    this.debugCount = 0;
    this.noteActive = false;
    this.silentBlocks = 0;
  }

  async initWasm(bytes) {
    try {
      const module = await WebAssembly.compile(bytes);
      const instance = await WebAssembly.instantiate(module, {});
      this.wasm = instance.exports;
      this.memory = instance.exports.memory;

      const sr =
        typeof sampleRate !== "undefined" && sampleRate > 0
          ? sampleRate
          : this.context?.sampleRate || 48000;
      console.log("[VIBRA] sampleRate =", sr);

      this.wasm.vibra_init(sr, 128);
      this.ready = true;
      this.port.postMessage({ type: "ready" });
    } catch (err) {
      console.error("[VIBRA] Wasm init failed:", err);
      this.port.postMessage({ type: "error", message: err.message });
    }
  }

  process(inputs, outputs, parameters) {
    if (!this.ready || !this.wasm) {
      return true;
    }
    const output = outputs[0];
    const frames = output[0].length;
    const channels = output.length;

    const ptr = this.wasm.vibra_process(frames, channels);
    if (!ptr) {
      console.warn("[VIBRA] process returned null ptr");
      return true;
    }

    const mem = new Float32Array(this.memory.buffer);
    const offset = ptr / 4;

    // Find max absolute value in this block
    let maxVal = 0;
    for (let i = 0; i < frames * channels; i++) {
      maxVal = Math.max(maxVal, Math.abs(mem[offset + i]));
    }

    // Debug logging: 30 calls after noteOn, plus whenever maxVal changes significantly
    if (this.debugCount < 30) {
      const noteStr = this.noteActive ? " [NOTE]" : "";
      console.log(
        "[VIBRA] process",
        this.debugCount,
        noteStr,
        "max:",
        maxVal.toFixed(6),
        "first:",
        mem[offset].toFixed(6),
      );
      this.debugCount++;
    } else if (this.noteActive && Math.abs(maxVal - this._lastMax) > 0.001) {
      console.log("[VIBRA] level change max:", maxVal.toFixed(6));
    }
    this._lastMax = maxVal;

    // Detect persistent silence after noteOn
    if (this.noteActive) {
      if (maxVal < 0.0001) {
        this.silentBlocks++;
        if (this.silentBlocks === 10) {
          console.warn(
            "[VIBRA] 10 silent blocks in a row after noteOn — engine output is zero",
          );
        }
      } else {
        this.silentBlocks = 0;
      }
    }

    for (let c = 0; c < channels; c++) {
      const out = output[c];
      for (let i = 0; i < frames; i++) {
        out[i] = mem[offset + i * channels + c];
      }
    }
    return true;
  }
}

// Wire up messages outside the class so we can hook into the processor instance
// We use a small hack: override the global registerProcessor to capture the instance
const originalRegisterProcessor = registerProcessor;
let processorInstance = null;

// Override to capture the instance created by the browser
const VibraProcessorProxy = class extends AudioWorkletProcessor {
  constructor() {
    super();
    processorInstance = this;
    this.wasm = null;
    this.memory = null;
    this.ready = false;
    this.debugCount = 0;
    this.copyDebugCount = 0;
    this.noteActive = false;
    this.silentBlocks = 0;
    this.silentWarningSent = false;
    this._lastMax = 0;

    this.port.onmessage = (event) => {
      const msg = event.data;
      if (!this.ready) {
        if (msg.type === "init-wasm") {
          this.initWasm(msg.wasmBytes);
        }
        return;
      }
      switch (msg.type) {
        case "addModule":
          this.wasm.vibra_add_module(msg.id, msg.kind);
          break;
        case "removeModule":
          this.wasm.vibra_remove_module(msg.id);
          break;
        case "connect":
          this.wasm.vibra_connect(
            msg.sourceId,
            msg.sourcePort,
            msg.targetId,
            msg.targetPort,
          );
          break;
        case "disconnect":
          this.wasm.vibra_disconnect(
            msg.sourceId,
            msg.sourcePort,
            msg.targetId,
            msg.targetPort,
          );
          break;
        case "param":
          this.wasm.vibra_set_param(msg.moduleId, msg.paramId, msg.value);
          break;
        case "noteOn":
          console.log("[VIBRA] noteOn received", msg.note, msg.velocity);
          this.noteActive = true;
          this.debugCount = 0;
          this.copyDebugCount = 0;
          this.silentBlocks = 0;
          this.silentWarningSent = false;
          try {
            this.wasm.vibra_note_on(msg.note, msg.velocity);
          } catch (err) {
            console.error("[VIBRA] vibra_note_on crashed:", err);
            this.ready = false;
          }
          break;
        case "noteOff":
          console.log("[VIBRA] noteOff received", msg.note);
          this.noteActive = false;
          try {
            this.wasm.vibra_note_off(msg.note);
          } catch (err) {
            console.error("[VIBRA] vibra_note_off crashed:", err);
            this.ready = false;
          }
          break;
      }
    };
  }

  async initWasm(bytes) {
    try {
      const module = await WebAssembly.compile(bytes);
      const instance = await WebAssembly.instantiate(module, {});
      this.wasm = instance.exports;
      this.memory = instance.exports.memory;

      const sr =
        typeof sampleRate !== "undefined" && sampleRate > 0
          ? sampleRate
          : this.context?.sampleRate || 48000;
      console.log("[VIBRA] sampleRate =", sr);

      this.wasm.vibra_init(sr, 128);
      this.ready = true;
      this.port.postMessage({ type: "ready" });
    } catch (err) {
      console.error("[VIBRA] Wasm init failed:", err);
      this.port.postMessage({ type: "error", message: err.message });
    }
  }

  process(inputs, outputs, parameters) {
    if (!this.ready || !this.wasm) {
      return true;
    }
    const output = outputs[0];
    const frames = output[0].length;
    const channels = output.length;

    let ptr;
    try {
      ptr = this.wasm.vibra_process(frames, channels);
    } catch (err) {
      console.error("[VIBRA] vibra_process crashed:", err);
      this.ready = false;
      return true;
    }
    if (!ptr) {
      console.warn("[VIBRA] process returned null ptr");
      return true;
    }

    const mem = new Float32Array(this.memory.buffer);
    const offset = ptr / 4;

    let maxVal = 0;
    for (let i = 0; i < frames * channels; i++) {
      maxVal = Math.max(maxVal, Math.abs(mem[offset + i]));
    }

    if (this.debugCount < 30) {
      const noteStr = this.noteActive ? " [NOTE]" : "";
      console.log(
        "[VIBRA] process",
        this.debugCount,
        noteStr,
        "max:",
        maxVal.toFixed(6),
        "first:",
        mem[offset].toFixed(6),
      );
      this.debugCount++;
    } else if (this.noteActive && Math.abs(maxVal - this._lastMax) > 0.001) {
      console.log("[VIBRA] level change max:", maxVal.toFixed(6));
    }
    this._lastMax = maxVal;

    if (this.noteActive) {
      if (maxVal < 0.0001) {
        this.silentBlocks++;
        if (this.silentBlocks === 10 && !this.silentWarningSent) {
          this.silentWarningSent = true;
          this.port.postMessage({ type: "silent-warning" });
          console.warn(
            "[VIBRA] 10 silent blocks in a row after noteOn — engine output is zero",
          );
        }
      } else {
        if (this.silentBlocks >= 10 && this.silentWarningSent) {
          this.port.postMessage({ type: "silent-resolved" });
          this.silentWarningSent = false;
        }
        this.silentBlocks = 0;
      }
    }

    for (let c = 0; c < channels; c++) {
      const out = output[c];
      for (let i = 0; i < frames; i++) {
        out[i] = mem[offset + i * channels + c];
      }
    }

    let outMax = 0;
    for (let c = 0; c < channels; c++) {
      for (let i = 0; i < frames; i++) {
        outMax = Math.max(outMax, Math.abs(output[c][i]));
      }
    }
    const rustMax = this.wasm.vibra_debug_master_max
      ? this.wasm.vibra_debug_master_max()
      : -1;
    if (this.noteActive && this.copyDebugCount < 30) {
      console.log(
        "[VIBRA] copy verify  ch:",
        channels,
        "frames:",
        frames,
        "rustMasterMax:",
        rustMax.toFixed(6),
        "jsMemMax:",
        maxVal.toFixed(6),
        "jsOutMax:",
        outMax.toFixed(6),
      );
      this.port.postMessage({
        type: "process-stats",
        count: this.copyDebugCount,
        maxVal,
        first: mem[offset],
        channels,
        frames,
        outMax,
      });
      this.copyDebugCount++;
    }

    return true;
  }
};

registerProcessor("vibra-processor", VibraProcessorProxy);
