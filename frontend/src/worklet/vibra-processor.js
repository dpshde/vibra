class VibraProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.wasm = null;
    this.memory = null;
    this.enginePtr = 0;
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
          this.wasm.vibra_add_module(this.enginePtr, msg.id, msg.kind);
          break;
        case "removeModule":
          this.wasm.vibra_remove_module(this.enginePtr, msg.id);
          break;
        case "connect":
          this.wasm.vibra_connect(
            this.enginePtr,
            msg.sourceId,
            msg.sourcePort,
            msg.targetId,
            msg.targetPort,
          );
          break;
        case "disconnect":
          this.wasm.vibra_disconnect(
            this.enginePtr,
            msg.sourceId,
            msg.sourcePort,
            msg.targetId,
            msg.targetPort,
          );
          break;
        case "param":
          this.wasm.vibra_set_param(
            this.enginePtr,
            msg.moduleId,
            msg.paramId,
            msg.value,
          );
          break;
        case "voiceMode":
          this.wasm.vibra_set_voice_mode(
            this.enginePtr,
            msg.mode,
            msg.polyphony,
            msg.unisonCount,
            msg.unisonDetune,
          );
          break;
        case "noteOn":
          console.log("[VIBRA] noteOn received", msg.note, msg.velocity);
          this.noteActive = true;
          this.debugCount = 0;
          this.copyDebugCount = 0;
          this.silentBlocks = 0;
          this.silentWarningSent = false;
          try {
            this.wasm.vibra_note_on(this.enginePtr, msg.note, msg.velocity);
          } catch (err) {
            console.error("[VIBRA] vibra_note_on crashed:", err);
            this.ready = false;
          }
          break;
        case "noteOff":
          console.log("[VIBRA] noteOff received", msg.note);
          this.noteActive = false;
          try {
            this.wasm.vibra_note_off(this.enginePtr, msg.note);
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

      this.enginePtr = this.wasm.vibra_create(sr, 128);
      if (!this.enginePtr) {
        throw new Error("vibra_create returned null");
      }
      this.ready = true;
      this.port.postMessage({ type: "ready" });
    } catch (err) {
      console.error("[VIBRA] Wasm init failed:", err);
      this.port.postMessage({ type: "error", message: err.message });
    }
  }

  process(inputs, outputs, parameters) {
    if (!this.ready || !this.wasm || !this.enginePtr) {
      return true;
    }
    const output = outputs[0];
    const frames = output[0].length;
    const channels = output.length;

    let ptr;
    try {
      ptr = this.wasm.vibra_process(this.enginePtr, frames, channels);
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
    if (this.noteActive && this.copyDebugCount < 30) {
      console.log(
        "[VIBRA] copy verify  ch:",
        channels,
        "frames:",
        frames,
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
}

registerProcessor("vibra-processor", VibraProcessor);
