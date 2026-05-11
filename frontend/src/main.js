import "./styles.css";
import { getAudioContext, resumeContext } from "./synth/audio-context.js";
import { PatchBay } from "./synth/patch-bay.js";
import { BuiltinRegistry } from "./synth/registry.js";
import { NodeGraph } from "./ui/graph.js";
import { renderPalette } from "./ui/palette.js";
import { createKeyboard } from "./ui/keyboard.js";
import { loadHelloSine } from "./examples/hello-sine.js";
import { loadPlugins } from "./plugin/sdk.js";

// Built-in manifests
import oscManifest from "./synth/builtins/oscillator.js";
import gainManifest from "./synth/builtins/gain.js";
import filterManifest from "./synth/builtins/filter.js";
import scopeManifest from "./synth/builtins/scope.js";
import destManifest from "./synth/builtins/destination.js";

const registry = new BuiltinRegistry();
registry.register(oscManifest);
registry.register(gainManifest);
registry.register(filterManifest);
registry.register(scopeManifest);
registry.register(destManifest);

let ctx = null;
let patchBay = null;
let graph = null;

function initAudio() {
  if (ctx) return;
  ctx = getAudioContext();
  resumeContext();

  patchBay = new PatchBay(ctx, registry);

  const container = document.getElementById("graph-container");
  const cablesSvg = document.getElementById("cables");
  const modulesLayer = document.getElementById("modules-layer");
  graph = new NodeGraph(container, cablesSvg, modulesLayer, patchBay);

  // Default patch
  loadHelloSine(patchBay, graph);

  // Palette
  const palette = document.getElementById("palette-list");
  renderPalette(palette, registry, (manifest) => {
    const id = patchBay.addModule(manifest);
    const x = 80 + Math.random() * 300;
    const y = 80 + Math.random() * 300;
    graph.addModule(id, manifest, x, y);
  });

  // Toolbar
  document.getElementById("btn-add-osc").onclick = () => {
    const id = patchBay.addModule(registry.get("builtin-osc"));
    graph.addModule(id, registry.get("builtin-osc"), 80, 80);
  };
  document.getElementById("btn-add-gain").onclick = () => {
    const id = patchBay.addModule(registry.get("builtin-gain"));
    graph.addModule(id, registry.get("builtin-gain"), 80, 80);
  };
  document.getElementById("btn-add-filter").onclick = () => {
    const id = patchBay.addModule(registry.get("builtin-filter"));
    graph.addModule(id, registry.get("builtin-filter"), 80, 80);
  };
  document.getElementById("btn-clear").onclick = () => {
    for (const id of Array.from(patchBay.modules.keys())) {
      graph.removeModule(id);
    }
  };

  // Virtual keyboard
  const keyboardContainer = document.getElementById("keyboard");
  let activeOsc = null;
  createKeyboard(
    keyboardContainer,
    (note, freq) => {
      if (activeOsc) {
        activeOsc.stop();
        activeOsc.disconnect();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.value = 0.2;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      activeOsc = osc;
    },
    (note) => {
      if (activeOsc) {
        activeOsc.stop();
        activeOsc.disconnect();
        activeOsc = null;
      }
    },
  );

  // Scope
  const scopeCanvas = document.getElementById("scope");
  const scopeCtx = scopeCanvas.getContext("2d");
  function drawScope() {
    requestAnimationFrame(drawScope);
    for (const mod of patchBay.modules.values()) {
      if (mod.manifest.id === "builtin-scope") {
        const analyser = mod.node;
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteTimeDomainData(data);
        scopeCtx.fillStyle = "#000000";
        scopeCtx.fillRect(0, 0, 320, 96);
        scopeCtx.strokeStyle = "#00ff41";
        scopeCtx.lineWidth = 2;
        scopeCtx.beginPath();
        for (let i = 0; i < data.length; i++) {
          const x = (i / data.length) * 320;
          const y = (data[i] / 255) * 96;
          if (i === 0) scopeCtx.moveTo(x, y);
          else scopeCtx.lineTo(x, y);
        }
        scopeCtx.stroke();
        break;
      }
    }
  }
  drawScope();

  // Bridge status
  const bridgeStatus = document.getElementById("bridge-status");
  const hasBridge = typeof window !== "undefined" && Boolean(window.zero);
  bridgeStatus.textContent = hasBridge ? "BRIDGE OK" : "NO BRIDGE";
}

document.getElementById("btn-start").onclick = () => {
  initAudio();
  document.getElementById("btn-start").textContent = "[ AUDIO ON ]";
  document.getElementById("btn-start").disabled = true;
};

// Auto-load dynamic plugins
const pluginModules = import.meta.glob("./plugins/*.js");
loadPlugins(pluginModules);
