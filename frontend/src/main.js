import "./styles.css";
import { getAudioContext, resumeContext } from "./synth/audio-context.js";
import { PatchBay } from "./synth/patch-bay.js";
import { BuiltinRegistry } from "./synth/registry.js";
import { EngineBridge } from "./synth/engine-bridge.js";
import { NodeGraph } from "./ui/graph.js";
import { renderPalette } from "./ui/palette.js";
import { createKeyboard } from "./ui/keyboard.js";
import { loadHelloSine } from "./examples/hello-sine.js";
import { loadPluckSynth } from "./examples/pluck-synth.js";
import { loadTremoloPad } from "./examples/tremolo-pad.js";
import { loadEchoPluck } from "./examples/echo-pluck.js";
import { loadNoisePercussion } from "./examples/noise-perc.js";
import { loadAcidBass } from "./examples/acid-bass.js";
import { loadJunoPad } from "./examples/juno-pad.js";
import { loadFmBell } from "./examples/fm-bell.js";
import { loadSpaceDrone } from "./examples/space-drone.js";
import { loadPlugins } from "./plugin/sdk.js";
import { exportOSP, importOSP } from "./patch-format/osp.js";
// Built-in manifests
import oscManifest from "./synth/builtins/oscillator.js";
import gainManifest from "./synth/builtins/gain.js";
import filterManifest from "./synth/builtins/filter.js";
import scopeManifest from "./synth/builtins/scope.js";
import destManifest from "./synth/builtins/destination.js";
import lfoManifest from "./synth/builtins/lfo.js";
import noiseManifest from "./synth/builtins/noise.js";
import envManifest from "./synth/builtins/envelope.js";
import delayManifest from "./synth/builtins/delay.js";
import multManifest from "./synth/builtins/multiplier.js";
import reverbManifest from "./synth/builtins/reverb.js";

const registry = new BuiltinRegistry();
registry.register(oscManifest);
registry.register(gainManifest);
registry.register(filterManifest);
registry.register(scopeManifest);
registry.register(destManifest);
registry.register(lfoManifest);
registry.register(noiseManifest);
registry.register(envManifest);
registry.register(delayManifest);
registry.register(multManifest);
registry.register(reverbManifest);

let ctx = null;
let patchBay = null;
let graph = null;
let bridge = null;
let runtimeSilent = false;

function updatePatchWarning() {
  const banner = document.getElementById("patch-warning");
  if (!banner) return;
  if (runtimeSilent) {
    banner.textContent =
      "Output is silent after note. Check that an Oscillator or Noise module is connected to the Destination.";
    banner.classList.remove("hidden");
    return;
  }
  const staticWarning = patchBay ? patchBay.validatePatch() : null;
  if (staticWarning) {
    banner.textContent = staticWarning;
    banner.classList.remove("hidden");
  } else {
    banner.classList.add("hidden");
  }
}

async function showErrorDialog(message) {
  window.alert(message);
}

async function ensurePatchEditorReady() {
  await initAudio();
  if (!patchBay || !graph) {
    throw new Error("Patch editor is not initialized.");
  }
}

function clearCurrentPatch() {
  if (!patchBay || !graph) return;
  for (const id of Array.from(patchBay.modules.keys())) {
    graph.removeModule(id);
  }
  runtimeSilent = false;
  updatePatchWarning();
}

function renderImportedPatch(result) {
  for (const { vibraId, manifest } of result.modules) {
    graph.addModule(vibraId, manifest);
  }
  graph.redrawCables();
  updatePatchWarning();
}

function makePatchFilename(name) {
  return (
    (name || "patch").replace(/[^a-z0-9]/gi, "_").toLowerCase() + ".osp.json"
  );
}

async function exportCurrentPatch() {
  await ensurePatchEditorReady();

  const patch = exportOSP(patchBay, { name: "Vibra Patch" });
  const jsonText = JSON.stringify(patch, null, 2);
  const fileName = makePatchFilename(patch.metadata?.name);

  const blob = new Blob([jsonText], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importPatchFromText(text) {
  await ensurePatchEditorReady();
  const patch = JSON.parse(text);
  clearCurrentPatch();
  const result = importOSP(patchBay, registry, patch);
  renderImportedPatch(result);
}

async function initAudio() {
  if (ctx) return;
  ctx = getAudioContext();
  window.ctx = ctx;
  await resumeContext();

  bridge = new EngineBridge(ctx);
  try {
    await bridge.init();
  } catch (err) {
    console.error("BRIDGE INIT FAILED:", err);
    await showErrorDialog(
      "Failed to load Wasm DSP. Run `pnpm wasm-dev` first.",
    );
    return;
  }

  // Manifests are authored in JS; WASM engine uses kind/num_inputs/num_outputs
  // but does not export metadata back to JS.

  if (ctx.state !== "running") {
    console.warn(
      "[VIBRA] AudioContext state is",
      ctx.state,
      "— attempting resume…",
    );
    await ctx.resume();
    console.log("[VIBRA] AudioContext state after resume:", ctx.state);
  } else {
    console.log("[VIBRA] AudioContext state:", ctx.state);
  }

  const masterGain = ctx.createGain();
  masterGain.gain.value = 3.0;
  bridge.getWorkletNode().connect(masterGain);
  masterGain.connect(ctx.destination);

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  masterGain.connect(analyser);
  window.workletNode = bridge.getWorkletNode();
  window.analyser = analyser;
  window.masterGain = masterGain;

  bridge.getWorkletNode().onprocessorerror = (err) => {
    console.error("[VIBRA] Processor error:", err);
  };

  patchBay = new PatchBay(bridge, registry);

  const container = document.getElementById("rack-grid");
  const cablesSvg = document.getElementById("cables");
  const modulesLayer = document.getElementById("rack-grid");
  graph = new NodeGraph(container, cablesSvg, modulesLayer, patchBay);

  bridge.onSilentWarning = () => {
    runtimeSilent = true;
    updatePatchWarning();
  };
  bridge.onSilentResolved = () => {
    runtimeSilent = false;
    updatePatchWarning();
  };
  graph.onConnectionChange = () => updatePatchWarning();

  // Initialize default voice config
  patchBay.setVoiceConfig({ mode: "poly", polyphony: 8, unisonCount: 1, unisonDetune: 0 });

  const arrangeButton = document.getElementById("btn-arrange");
  arrangeButton.onclick = () => {
    graph.arrangeModulesByIO();
  };

  const snapButton = document.getElementById("btn-snap");
  const renderSnapButton = () => {
    snapButton.textContent = graph.snapEnabled ? "snap on" : "snap off";
    snapButton.setAttribute("aria-pressed", String(graph.snapEnabled));
  };
  snapButton.onclick = () => {
    graph.setSnapEnabled(!graph.snapEnabled);
    renderSnapButton();
  };
  renderSnapButton();

  loadHelloSine(patchBay, graph);
  updatePatchWarning();

  const palette = document.getElementById("palette-list");
  renderPalette(palette, registry, (manifest) => {
    const id = patchBay.addModule(manifest);
    graph.addModule(id, manifest);
    updatePatchWarning();
  });

  const exampleSelect = document.getElementById("example-select");
  if (exampleSelect) {
    exampleSelect.onchange = async () => {
      const val = exampleSelect.value;
      if (!val) return;
      if (!ctx) {
        await initAudio();
        const startBtn = document.getElementById("btn-start");
        startBtn.textContent = "audio on";
        startBtn.disabled = true;
      }
      for (const id of Array.from(patchBay.modules.keys())) {
        graph.removeModule(id);
      }
      runtimeSilent = false;
      switch (val) {
        case "hello":
          loadHelloSine(patchBay, graph);
          break;
        case "pluck":
          loadPluckSynth(patchBay, graph);
          break;
        case "tremolo":
          loadTremoloPad(patchBay, graph);
          break;
        case "echo":
          loadEchoPluck(patchBay, graph);
          break;
        case "perc":
          loadNoisePercussion(patchBay, graph);
          break;
        case "acid":
          loadAcidBass(patchBay, graph);
          break;
        case "juno":
          loadJunoPad(patchBay, graph);
          break;
        case "fmbell":
          loadFmBell(patchBay, graph);
          break;
        case "space":
          loadSpaceDrone(patchBay, graph);
          break;
      }
      updatePatchWarning();
      exampleSelect.value = "";
    };
  }

  // Keyboard with polyphonic support
  const keyboardContainer = document.getElementById("keyboard");
  const activeNotes = new Set();
  createKeyboard(
    keyboardContainer,
    (note, freq) => {
      activeNotes.add(note);
      bridge.noteOn(note, 0.8);
    },
    (note) => {
      activeNotes.delete(note);
      bridge.noteOff(note);
    },
  );

  const scopeCanvas = document.getElementById("scope");
  const scopeCtx = scopeCanvas.getContext("2d");
  function drawScope() {
    requestAnimationFrame(drawScope);
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);
    scopeCtx.fillStyle = "#111111";
    scopeCtx.fillRect(0, 0, 320, 96);
    scopeCtx.strokeStyle = "#ff5500";
    scopeCtx.lineWidth = 2;
    scopeCtx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = (i / data.length) * 320;
      const y = (data[i] / 255) * 96;
      if (i === 0) scopeCtx.moveTo(x, y);
      else scopeCtx.lineTo(x, y);
    }
    scopeCtx.stroke();
  }
  drawScope();

  const bridgeStatus = document.getElementById("bridge-status");
  bridgeStatus.textContent = "BRIDGE OK";
}

document.getElementById("btn-start").onclick = async () => {
  await initAudio();
  document.getElementById("btn-start").textContent = "audio on";
  document.getElementById("btn-start").disabled = true;
};

document.getElementById("btn-clear").onclick = async () => {
  await ensurePatchEditorReady();
  clearCurrentPatch();
};

document.getElementById("btn-export").onclick = async () => {
  try {
    await exportCurrentPatch();
  } catch (err) {
    console.error("Export failed:", err);
    await showErrorDialog("Export failed: " + err.message);
  }
};

const fileInput = document.getElementById("file-import");
document.getElementById("btn-import").onclick = async () => {
  try {
    fileInput.click();
  } catch (err) {
    console.error("Import failed:", err);
    await showErrorDialog("Import failed: " + err.message);
  }
};

fileInput.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    await importPatchFromText(text);
  } catch (err) {
    console.error("Import failed:", err);
    await showErrorDialog("Import failed: " + err.message);
  }
  fileInput.value = "";
};

const pluginModules = import.meta.glob("./plugins/*.js");
loadPlugins(pluginModules);
