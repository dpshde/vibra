/**
 * RACK UI
 * Free-positioned module cards with SVG patch cables.
 */

const DEFAULT_MODULE_WIDTH = 280;
const MIN_MODULE_WIDTH = 220;
const MIN_MODULE_HEIGHT = 140;
const MODULE_GAP = 20;
const MODULE_ROW_HEIGHT = 240;
const WORKSPACE_PADDING = 20;
const GRID_SIZE = 20;

function formatParamValue(value, step) {
  if (!step || step === "") return Math.round(parseFloat(value)).toString();
  const stepNum = parseFloat(step);
  if (isNaN(stepNum) || stepNum >= 1)
    return Math.round(parseFloat(value)).toString();
  const decimals = Math.max(0, Math.ceil(-Math.log10(stepNum)));
  let str = parseFloat(value).toFixed(decimals);
  if (str.includes(".")) {
    str = str.replace(/0+$/, "").replace(/\.$/, "");
  }
  return str;
}

export class NodeGraph {
  constructor(container, cablesSvg, modulesLayer, patchBay) {
    this.container = container;
    this.cablesSvg = cablesSvg;
    this.modulesLayer = modulesLayer;
    this.patchBay = patchBay;
    this.modules = new Map();
    this.connectState = null;
    this.dragState = null;
    this.resizeState = null;
    this.snapEnabled = true;
    this.onConnectionChange = null;
    this.setupEvents();
    this.updateWorkspaceSize();
  }

  setupEvents() {
    this.modulesLayer.addEventListener("mousedown", (e) => {
      const resizeHandle = e.target.closest(".module-resize-handle");
      if (resizeHandle) {
        const moduleEl = resizeHandle.closest(".module-node");
        if (moduleEl && e.button === 0) {
          this.startResize(moduleEl, e);
        }
        return;
      }

      const port = e.target.closest(".port");
      if (port) {
        e.preventDefault();
        this.handlePortClick(port);
        return;
      }

      const header = e.target.closest(".module-header");
      const moduleEl = header?.closest(".module-node");
      if (moduleEl && e.button === 0) {
        this.startDrag(moduleEl, e);
      }
    });

    window.addEventListener("mousemove", (e) => {
      if (this.resizeState) {
        e.preventDefault();
        this.onResizeMove(e);
        return;
      }

      if (this.dragState) {
        e.preventDefault();
        this.onDragMove(e);
        return;
      }

      if (this.connectState) {
        e.preventDefault();
        this.onConnectMove(e.clientX, e.clientY);
      }
    });

    window.addEventListener("mouseup", (e) => {
      if (this.resizeState) {
        this.stopResize();
      }

      if (this.dragState) {
        this.stopDrag();
      }

      if (this.connectState) {
        const port = e.target.closest(".port.input");
        if (port) {
          const targetModuleEl = port.closest(".module-node");
          const targetId = Number(targetModuleEl.dataset.id);
          const inputId = port.dataset.port;
          try {
            this.patchBay.connect(
              this.connectState.sourceId,
              this.connectState.outputId,
              targetId,
              inputId,
            );
            this.redrawCables();
            if (typeof this.onConnectionChange === "function")
              this.onConnectionChange();
          } catch (err) {
            console.error("CONNECTION FAILED:", err);
          }
        }
        this.connectState.tempCable.remove();
        this.connectState = null;
      }
    });

    window.addEventListener("resize", () => {
      this.updateWorkspaceSize();
      this.redrawCables();
    });

    const ro = new ResizeObserver(() => {
      this.updateWorkspaceSize();
      this.redrawCables();
    });
    ro.observe(this.container);
    if (this.container.parentElement) {
      ro.observe(this.container.parentElement);
    }

    this.modulesLayer.addEventListener("contextmenu", (e) => {
      const moduleEl = e.target.closest(".module-node");
      if (moduleEl) {
        e.preventDefault();
        this.removeModule(Number(moduleEl.dataset.id));
      }
    });
  }

  getNextModulePosition(excludeId = null) {
    const availableWidth =
      this.container.parentElement?.clientWidth ??
      this.container.clientWidth ??
      DEFAULT_MODULE_WIDTH + WORKSPACE_PADDING * 2;
    const usableWidth = Math.max(
      availableWidth - WORKSPACE_PADDING * 2,
      DEFAULT_MODULE_WIDTH,
    );
    const columns = Math.max(
      1,
      Math.floor(
        (usableWidth + MODULE_GAP) / (DEFAULT_MODULE_WIDTH + MODULE_GAP),
      ),
    );
    const index =
      this.modules.size -
      (excludeId !== null && this.modules.has(excludeId) ? 1 : 0);

    return {
      x:
        WORKSPACE_PADDING +
        (index % columns) * (DEFAULT_MODULE_WIDTH + MODULE_GAP),
      y: WORKSPACE_PADDING + Math.floor(index / columns) * MODULE_ROW_HEIGHT,
    };
  }

  getVisibleModuleRecords(excludeId = null) {
    return Array.from(this.modules.entries())
      .filter(([id]) => id !== excludeId)
      .map(([id, mod]) => ({
        id,
        mod,
        category: this.patchBay.modules.get(id)?.manifest?.category ?? null,
      }));
  }

  getVisibleConnections(moduleId) {
    const instance = this.patchBay.modules.get(moduleId);
    if (!instance) {
      return { upstream: [], downstream: [] };
    }

    const upstreamIds = new Set();
    const downstreamIds = new Set();

    for (const conns of Object.values(instance.inputConnections)) {
      for (const conn of conns) {
        upstreamIds.add(conn.sourceModuleId);
      }
    }

    for (const conns of Object.values(instance.outputConnections)) {
      for (const conn of conns) {
        downstreamIds.add(conn.targetModuleId);
      }
    }

    const toVisibleRecord = (id) => {
      const mod = this.modules.get(id);
      if (!mod) return null;
      return { id, mod };
    };

    return {
      upstream: Array.from(upstreamIds).map(toVisibleRecord).filter(Boolean),
      downstream: Array.from(downstreamIds)
        .map(toVisibleRecord)
        .filter(Boolean),
    };
  }

  getAverageCenterY(records) {
    if (records.length === 0) {
      return WORKSPACE_PADDING + MIN_MODULE_HEIGHT / 2;
    }

    return (
      records.reduce((sum, { mod }) => sum + mod.y + mod.height / 2, 0) /
      records.length
    );
  }

  isPlacementOccupied(x, y, width, height, excludeId = null) {
    for (const [id, mod] of this.modules) {
      if (id === excludeId) continue;

      const overlaps = !(
        x + width + MODULE_GAP <= mod.x ||
        x >= mod.x + mod.width + MODULE_GAP ||
        y + height + MODULE_GAP <= mod.y ||
        y >= mod.y + mod.height + MODULE_GAP
      );

      if (overlaps) {
        return true;
      }
    }

    return false;
  }

  findOpenModulePosition(x, y, width, height, excludeId = null) {
    const base = this.normalizePosition(x, y);
    if (!this.isPlacementOccupied(base.x, base.y, width, height, excludeId)) {
      return base;
    }

    const step = this.snapEnabled ? GRID_SIZE : 10;
    const maxRadius = 80;

    for (let radius = 1; radius <= maxRadius; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;

          const candidate = this.normalizePosition(
            base.x + dx * step,
            base.y + dy * step,
          );

          if (
            !this.isPlacementOccupied(
              candidate.x,
              candidate.y,
              width,
              height,
              excludeId,
            )
          ) {
            return candidate;
          }
        }
      }
    }

    return base;
  }

  getCategorySpawnPosition(moduleId, category, width, height) {
    const visibleModules = this.getVisibleModuleRecords(moduleId);
    if (visibleModules.length === 0) {
      return this.getNextModulePosition(moduleId);
    }

    const nextPosition = this.getNextModulePosition(moduleId);
    const sameCategory = visibleModules.filter(
      ({ category: visibleCategory }) => visibleCategory === category,
    );

    if (sameCategory.length > 0) {
      return {
        x: Math.min(...sameCategory.map(({ mod }) => mod.x)),
        y:
          Math.max(...sameCategory.map(({ mod }) => mod.y + mod.height)) +
          MODULE_GAP,
      };
    }

    const sourceMods = visibleModules.filter(
      ({ category: visibleCategory }) => visibleCategory === "source",
    );
    const modulationMods = visibleModules.filter(
      ({ category: visibleCategory }) => visibleCategory === "modulation",
    );
    const outputMods = visibleModules.filter(
      ({ category: visibleCategory }) => visibleCategory === "output",
    );
    const utilityLikeMods = visibleModules.filter(
      ({ category: visibleCategory }) =>
        visibleCategory === "utility" || visibleCategory === "effect",
    );

    if (category === "output") {
      return {
        x:
          Math.max(...visibleModules.map(({ mod }) => mod.x + mod.width)) +
          MODULE_GAP,
        y:
          this.getAverageCenterY(
            utilityLikeMods.length > 0 ? utilityLikeMods : visibleModules,
          ) -
          height / 2,
      };
    }

    if (category === "source") {
      if (outputMods.length > 0) {
        return {
          x:
            Math.min(...outputMods.map(({ mod }) => mod.x)) -
            width -
            MODULE_GAP,
          y: this.getAverageCenterY(outputMods) - height / 2,
        };
      }

      return { x: WORKSPACE_PADDING, y: nextPosition.y };
    }

    if (category === "modulation") {
      if (sourceMods.length > 0) {
        return {
          x: Math.min(...sourceMods.map(({ mod }) => mod.x)),
          y:
            Math.max(...sourceMods.map(({ mod }) => mod.y + mod.height)) +
            MODULE_GAP,
        };
      }

      if (modulationMods.length > 0) {
        return {
          x: Math.min(...modulationMods.map(({ mod }) => mod.x)),
          y:
            Math.max(...modulationMods.map(({ mod }) => mod.y + mod.height)) +
            MODULE_GAP,
        };
      }
    }

    if (outputMods.length > 0) {
      return {
        x: Math.min(...outputMods.map(({ mod }) => mod.x)) - width - MODULE_GAP,
        y:
          this.getAverageCenterY(
            utilityLikeMods.length > 0 ? utilityLikeMods : outputMods,
          ) -
          height / 2,
      };
    }

    if (sourceMods.length > 0) {
      return {
        x:
          Math.max(...sourceMods.map(({ mod }) => mod.x + mod.width)) +
          MODULE_GAP,
        y: this.getAverageCenterY(sourceMods) - height / 2,
      };
    }

    return { x: nextPosition.x, y: nextPosition.y };
  }

  getSmartSpawnPosition(moduleId, manifest, width, height) {
    const nextPosition = this.getNextModulePosition(moduleId);
    const { upstream, downstream } = this.getVisibleConnections(moduleId);
    const connectedNeighbors = [...upstream, ...downstream];

    let desiredX = nextPosition.x;
    let desiredY = nextPosition.y;

    if (connectedNeighbors.length > 0) {
      if (upstream.length > 0 && downstream.length > 0) {
        const leftBound =
          Math.max(...upstream.map(({ mod }) => mod.x + mod.width)) +
          MODULE_GAP;
        const rightBound =
          Math.min(...downstream.map(({ mod }) => mod.x)) - width - MODULE_GAP;

        desiredX =
          leftBound <= rightBound ? (leftBound + rightBound) / 2 : leftBound;
      } else if (upstream.length > 0) {
        desiredX =
          Math.max(...upstream.map(({ mod }) => mod.x + mod.width)) +
          MODULE_GAP;
      } else {
        desiredX =
          Math.min(...downstream.map(({ mod }) => mod.x)) - width - MODULE_GAP;
      }

      desiredY = this.getAverageCenterY(connectedNeighbors) - height / 2;
    } else {
      const categoryPosition = this.getCategorySpawnPosition(
        moduleId,
        manifest.category,
        width,
        height,
      );
      desiredX = categoryPosition.x;
      desiredY = categoryPosition.y;
    }

    return this.findOpenModulePosition(
      desiredX,
      desiredY,
      width,
      height,
      moduleId,
    );
  }

  snapCoordinate(value) {
    return (
      WORKSPACE_PADDING +
      Math.round((value - WORKSPACE_PADDING) / GRID_SIZE) * GRID_SIZE
    );
  }

  normalizePosition(x, y) {
    let nextX = Math.max(WORKSPACE_PADDING, Math.round(x));
    let nextY = Math.max(WORKSPACE_PADDING, Math.round(y));

    if (this.snapEnabled) {
      nextX = this.snapCoordinate(nextX);
      nextY = this.snapCoordinate(nextY);
    }

    return { x: nextX, y: nextY };
  }

  positionModule(mod, x, y) {
    const nextPosition = this.normalizePosition(x, y);
    mod.x = nextPosition.x;
    mod.y = nextPosition.y;
    mod.el.style.left = `${mod.x}px`;
    mod.el.style.top = `${mod.y}px`;
  }

  sizeModule(mod, width, height) {
    mod.width = Math.max(MIN_MODULE_WIDTH, Math.round(width));
    mod.height = Math.max(MIN_MODULE_HEIGHT, Math.round(height));
    mod.el.style.width = `${mod.width}px`;
    mod.el.style.height = `${mod.height}px`;
  }

  setSnapEnabled(enabled) {
    this.snapEnabled = Boolean(enabled);

    if (this.snapEnabled) {
      for (const mod of this.modules.values()) {
        this.positionModule(mod, mod.x, mod.y);
      }
      this.updateWorkspaceSize();
      this.redrawCables();
    }
  }

  updateWorkspaceSize() {
    const viewportWidth = this.container.parentElement?.clientWidth ?? 0;
    const viewportHeight = this.container.parentElement?.clientHeight ?? 0;

    let width = Math.max(
      viewportWidth,
      DEFAULT_MODULE_WIDTH + WORKSPACE_PADDING * 2,
    );
    let height = Math.max(
      viewportHeight,
      MODULE_ROW_HEIGHT + WORKSPACE_PADDING * 2,
    );

    for (const mod of this.modules.values()) {
      width = Math.max(width, mod.x + mod.width + WORKSPACE_PADDING);
      height = Math.max(height, mod.y + mod.height + WORKSPACE_PADDING);
    }

    this.container.style.width = `${Math.ceil(width)}px`;
    this.container.style.height = `${Math.ceil(height)}px`;
  }

  startDrag(moduleEl, e) {
    const moduleId = Number(moduleEl.dataset.id);
    const mod = this.modules.get(moduleId);
    if (!mod) return;

    const rect = moduleEl.getBoundingClientRect();
    this.dragState = {
      moduleId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };

    moduleEl.classList.add("dragging");
    e.preventDefault();
  }

  onDragMove(e) {
    if (!this.dragState) return;

    const mod = this.modules.get(this.dragState.moduleId);
    if (!mod) return;

    const containerRect = this.container.getBoundingClientRect();
    const x = e.clientX - containerRect.left - this.dragState.offsetX;
    const y = e.clientY - containerRect.top - this.dragState.offsetY;

    this.positionModule(mod, x, y);
    this.updateWorkspaceSize();
    this.redrawCables();
  }

  stopDrag() {
    if (!this.dragState) return;

    const mod = this.modules.get(this.dragState.moduleId);
    if (mod) {
      mod.el.classList.remove("dragging");
    }

    this.dragState = null;
    this.updateWorkspaceSize();
    this.redrawCables();
  }

  startResize(moduleEl, e) {
    const moduleId = Number(moduleEl.dataset.id);
    const mod = this.modules.get(moduleId);
    if (!mod) return;

    this.resizeState = {
      moduleId,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: mod.width,
      startHeight: mod.height,
    };

    moduleEl.classList.add("resizing");
    e.preventDefault();
  }

  onResizeMove(e) {
    if (!this.resizeState) return;

    const mod = this.modules.get(this.resizeState.moduleId);
    if (!mod) return;

    const nextWidth =
      this.resizeState.startWidth + (e.clientX - this.resizeState.startX);
    const nextHeight =
      this.resizeState.startHeight + (e.clientY - this.resizeState.startY);

    this.sizeModule(mod, nextWidth, nextHeight);
    this.updateWorkspaceSize();
    this.redrawCables();
  }

  stopResize() {
    if (!this.resizeState) return;

    const mod = this.modules.get(this.resizeState.moduleId);
    if (mod) {
      mod.el.classList.remove("resizing");
    }

    this.resizeState = null;
    this.updateWorkspaceSize();
    this.redrawCables();
  }

  arrangeModulesInRows() {
    const availableWidth =
      this.container.parentElement?.clientWidth ?? this.container.clientWidth;
    const maxRowWidth = Math.max(
      availableWidth - WORKSPACE_PADDING,
      DEFAULT_MODULE_WIDTH + WORKSPACE_PADDING,
    );

    let x = WORKSPACE_PADDING;
    let y = WORKSPACE_PADDING;
    let rowHeight = 0;

    const orderedModules = Array.from(this.modules.entries()).sort(
      ([a], [b]) => a - b,
    );

    for (const [, mod] of orderedModules) {
      if (x > WORKSPACE_PADDING && x + mod.width > maxRowWidth) {
        x = WORKSPACE_PADDING;
        y += rowHeight + MODULE_GAP;
        rowHeight = 0;
      }

      this.positionModule(mod, x, y);
      x += mod.width + MODULE_GAP;
      rowHeight = Math.max(rowHeight, mod.height);
    }

    this.updateWorkspaceSize();
    this.redrawCables();
  }

  arrangeModulesByIO() {
    const orderedIds = Array.from(this.modules.keys()).sort((a, b) => a - b);
    if (orderedIds.length === 0) return;

    const infos = new Map(
      orderedIds.map((id) => {
        const instance = this.patchBay.modules.get(id);
        return [
          id,
          {
            id,
            mod: this.modules.get(id),
            instance,
            incoming: new Set(),
            outgoing: new Set(),
            inputCount: instance?.manifest.inputs.length ?? 0,
            outputCount: instance?.manifest.outputs.length ?? 0,
          },
        ];
      }),
    );

    for (const info of infos.values()) {
      for (const conns of Object.values(
        info.instance?.outputConnections ?? {},
      )) {
        for (const conn of conns) {
          info.outgoing.add(conn.targetModuleId);
          const targetInfo = infos.get(conn.targetModuleId);
          targetInfo?.incoming.add(info.id);
        }
      }
    }

    const layers = new Map();
    for (const id of orderedIds) {
      const info = infos.get(id);
      if (info.incoming.size === 0) {
        layers.set(id, 0);
      }
    }

    for (let pass = 0; pass < orderedIds.length; pass++) {
      let changed = false;
      for (const id of orderedIds) {
        const info = infos.get(id);
        if (info.incoming.size === 0) continue;

        const upstreamLayers = Array.from(info.incoming)
          .map((sourceId) => layers.get(sourceId))
          .filter((layer) => layer !== undefined);

        if (upstreamLayers.length !== info.incoming.size) continue;

        const nextLayer = Math.max(...upstreamLayers) + 1;
        if (layers.get(id) !== nextLayer) {
          layers.set(id, nextLayer);
          changed = true;
        }
      }

      if (!changed) break;
    }

    const resolvedMaxLayer = layers.size > 0 ? Math.max(...layers.values()) : 0;
    const sinkFallbackLayer = Math.max(resolvedMaxLayer + 1, 2);

    for (const id of orderedIds) {
      if (layers.has(id)) continue;

      const info = infos.get(id);
      if (info.inputCount === 0 && info.outputCount > 0) {
        layers.set(id, 0);
      } else if (info.outputCount === 0 && info.inputCount > 0) {
        layers.set(id, sinkFallbackLayer);
      } else {
        layers.set(id, Math.min(1, sinkFallbackLayer - 1));
      }
    }

    const columns = new Map();
    for (const id of orderedIds) {
      const layer = layers.get(id) ?? 0;
      if (!columns.has(layer)) {
        columns.set(layer, []);
      }
      columns.get(layer).push(infos.get(id));
    }

    const sortedLayers = Array.from(columns.keys()).sort((a, b) => a - b);
    let x = WORKSPACE_PADDING;

    for (const layer of sortedLayers) {
      const column = columns.get(layer);
      column.sort((a, b) => {
        if (a.mod.y !== b.mod.y) return a.mod.y - b.mod.y;
        return a.id - b.id;
      });

      let y = WORKSPACE_PADDING;
      let columnWidth = DEFAULT_MODULE_WIDTH;

      for (const info of column) {
        this.positionModule(info.mod, x, y);
        y += info.mod.height + MODULE_GAP;
        columnWidth = Math.max(columnWidth, info.mod.width);
      }

      x += columnWidth + MODULE_GAP;
    }

    this.updateWorkspaceSize();
    this.redrawCables();
  }

  addModule(moduleId, manifest, x, y) {
    const el = document.createElement("div");
    el.className = "module-node";
    el.dataset.id = moduleId;
    if (manifest.category) {
      el.dataset.category = manifest.category;
    }

    const displayName = manifest.plainName || manifest.name;
    let html = `<div class="module-header">
      <div class="module-header-title">${displayName}</div>
    </div>`;
    html += `<div class="module-body">`;

    for (const input of manifest.inputs) {
      html += `<div class="port-row input"><span class="port-label">${input.name}</span><div class="port input" data-port="${input.id}"></div></div>`;
    }

    const instance = this.patchBay.modules.get(moduleId);
    const currentParams = instance ? instance.params : {};

    for (const param of manifest.parameters) {
      const step = param.step || "";
      const value = currentParams[param.id] ?? param.default;
      let paramHtml = "";
      if (param.type === "enum") {
        paramHtml = `<select class="param-knob" data-param="${param.id}">`;
        for (const v of param.values) {
          const selected = v === value ? " selected" : "";
          paramHtml += `<option value="${v}"${selected}>${v}</option>`;
        }
        paramHtml += `</select>`;
      } else {
        paramHtml = `<input type="range" class="param-knob" data-param="${param.id}" data-step="${step}"
          min="${param.min}" max="${param.max}" step="${step}" value="${value}">
          <span class="param-value">${formatParamValue(value, step)}</span>`;
      }
      html += `<div class="param-row">
        <label>${param.name}</label>
        ${paramHtml}
      </div>`;
    }

    if (manifest.id === "builtin-env") {
      html += `<div class="param-visual"><canvas class="adsr-curve" width="240" height="60"></canvas></div>`;
    } else if (manifest.id === "builtin-filter") {
      html += `<div class="param-visual"><canvas class="filter-curve" width="240" height="60"></canvas></div>`;
    }

    for (const output of manifest.outputs) {
      html += `<div class="port-row output"><div class="port output" data-port="${output.id}"></div><span class="port-label">${output.name}</span></div>`;
    }

    html += `</div>`;
    html += `<div class="module-resize-handle" aria-hidden="true"></div>`;
    el.innerHTML = html;

    for (const input of el.querySelectorAll("input.param-knob")) {
      input.addEventListener("input", (e) => {
        const paramId = e.target.dataset.param;
        const value = parseFloat(e.target.value);
        this.patchBay.setParam(moduleId, paramId, value);
        this.updateModuleVisuals(moduleId, manifest);
        const step = e.target.dataset.step || "";
        const valueSpan = e.target.nextElementSibling;
        if (valueSpan && valueSpan.classList.contains("param-value")) {
          valueSpan.textContent = formatParamValue(e.target.value, step);
        }
      });
    }

    for (const select of el.querySelectorAll("select.param-knob")) {
      select.addEventListener("change", (e) => {
        const paramId = e.target.dataset.param;
        const value = e.target.value;
        this.patchBay.setParam(moduleId, paramId, value);
        this.updateModuleVisuals(moduleId, manifest);
      });
    }

    if (manifest.id === "builtin-osc") {
      this.setupWaveformPicker(moduleId, el);
    }
    if (manifest.id === "builtin-env" || manifest.id === "builtin-filter") {
      this.updateModuleVisuals(moduleId, manifest);
    }

    this.modulesLayer.appendChild(el);

    const naturalHeight = Math.max(el.offsetHeight, MIN_MODULE_HEIGHT);
    const mod = {
      el,
      x: 0,
      y: 0,
      width: DEFAULT_MODULE_WIDTH,
      height: naturalHeight,
      inputEls: Object.fromEntries(
        Array.from(el.querySelectorAll(".port.input")).map((p) => [
          p.dataset.port,
          p,
        ]),
      ),
      outputEls: Object.fromEntries(
        Array.from(el.querySelectorAll(".port.output")).map((p) => [
          p.dataset.port,
          p,
        ]),
      ),
    };

    this.modules.set(moduleId, mod);

    this.sizeModule(mod, DEFAULT_MODULE_WIDTH, naturalHeight);
    const nextPosition =
      x !== undefined && y !== undefined
        ? { x, y }
        : this.getSmartSpawnPosition(moduleId, manifest, mod.width, mod.height);
    this.positionModule(mod, nextPosition.x, nextPosition.y);
    this.updateWorkspaceSize();
    this.redrawCables();
    return el;
  }

  removeModule(moduleId) {
    const mod = this.modules.get(moduleId);
    if (!mod) return;
    mod.el.remove();
    this.modules.delete(moduleId);
    this.patchBay.removeModule(moduleId);
    this.updateWorkspaceSize();
    this.redrawCables();
    if (typeof this.onConnectionChange === "function")
      this.onConnectionChange();
  }

  handlePortClick(portEl) {
    const isOutput = portEl.classList.contains("output");
    const moduleEl = portEl.closest(".module-node");
    const moduleId = Number(moduleEl.dataset.id);
    const portId = portEl.dataset.port;

    if (!isOutput) {
      // Ignore input clicks during a drag — completion happens on mouseup
      return;
    }

    if (this.connectState) {
      this.connectState.tempCable.remove();
      this.connectState = null;
    }

    const tempCable = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    tempCable.setAttribute("class", "cable temp");
    this.cablesSvg.appendChild(tempCable);
    this.connectState = { sourceId: moduleId, outputId: portId, tempCable };
  }

  onConnectMove(mx, my) {
    if (!this.connectState) return;
    const mod = this.modules.get(this.connectState.sourceId);
    const srcPort = mod.outputEls[this.connectState.outputId];
    const rect = srcPort.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();
    const x1 = rect.left + rect.width / 2 - containerRect.left;
    const y1 = rect.top + rect.height / 2 - containerRect.top;
    const x2 = mx - containerRect.left;
    const y2 = my - containerRect.top;
    const d = `M ${x1} ${y1} C ${x1 + 50} ${y1}, ${x2 - 50} ${y2}, ${x2} ${y2}`;
    this.connectState.tempCable.setAttribute("d", d);
  }

  redrawCables() {
    for (const group of this.cablesSvg.querySelectorAll(".cable-group")) {
      group.remove();
    }

    for (const [id, mod] of this.modules) {
      const instance = this.patchBay.modules.get(id);
      if (!instance) continue;
      for (const [inputId, conns] of Object.entries(
        instance.inputConnections,
      )) {
        const targetPort = mod.inputEls[inputId];
        if (!targetPort) continue;
        const tRect = targetPort.getBoundingClientRect();
        const cRect = this.container.getBoundingClientRect();
        const tx = tRect.left + tRect.width / 2 - cRect.left;
        const ty = tRect.top + tRect.height / 2 - cRect.top;

        for (const conn of conns) {
          const srcMod = this.modules.get(conn.sourceModuleId);
          if (!srcMod) continue;
          const srcPort = srcMod.outputEls[conn.outputId];
          if (!srcPort) continue;
          const sRect = srcPort.getBoundingClientRect();
          const sx = sRect.left + sRect.width / 2 - cRect.left;
          const sy = sRect.top + sRect.height / 2 - cRect.top;

          const d = `M ${sx} ${sy} C ${sx + 50} ${sy}, ${tx - 50} ${ty}, ${tx} ${ty}`;
          const group = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "g",
          );
          group.setAttribute("class", "cable-group");

          const srcInstance = this.patchBay.modules.get(conn.sourceModuleId);
          const category = srcInstance?.manifest?.category;
          let strokeColor = "var(--fg)";
          if (category === "source") strokeColor = "#00d4aa";
          else if (category === "modulation") strokeColor = "#ff5500";
          else if (category === "effect") strokeColor = "#4488ff";

          const path = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "path",
          );
          path.setAttribute("class", "cable");
          path.setAttribute("d", d);
          path.setAttribute("stroke", strokeColor);

          const hitPath = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "path",
          );
          hitPath.setAttribute("class", "cable-hit");
          hitPath.setAttribute("d", d);
          hitPath.setAttribute("stroke", "transparent");
          hitPath.setAttribute("stroke-width", "12");
          hitPath.setAttribute("fill", "none");
          hitPath.setAttribute("pointer-events", "stroke");

          group.appendChild(path);
          group.appendChild(hitPath);

          group.addEventListener("click", (e) => {
            e.stopPropagation();
            this.patchBay.disconnect(
              conn.sourceModuleId,
              conn.outputId,
              id,
              inputId,
            );
            this.redrawCables();
          });

          this.cablesSvg.appendChild(group);
        }
      }
    }
  }

  updateModuleVisuals(moduleId, manifest) {
    const mod = this.modules.get(moduleId);
    if (!mod) return;
    if (manifest.id === "builtin-env") {
      this.drawAdsrCurve(mod.el);
    } else if (manifest.id === "builtin-filter") {
      this.drawFilterCurve(mod.el);
    }
  }

  drawAdsrCurve(el) {
    const canvas = el.querySelector(".adsr-curve");
    if (!canvas) return;
    const attack = parseFloat(
      el.querySelector('[data-param="attack"]')?.value || 0.01,
    );
    const decay = parseFloat(
      el.querySelector('[data-param="decay"]')?.value || 0.3,
    );
    const sustain = parseFloat(
      el.querySelector('[data-param="sustain"]')?.value || 0.5,
    );
    const release = parseFloat(
      el.querySelector('[data-param="release"]')?.value || 0.5,
    );
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const pad = 4;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "var(--bg)";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, h - pad);
    ctx.lineTo(w - pad, h - pad);
    ctx.stroke();
    const displayTime = attack + decay + 0.5 + release;
    const attackX = pad + (attack / displayTime) * (w - 2 * pad);
    const decayX = attackX + (decay / displayTime) * (w - 2 * pad);
    const sustainX = decayX + (0.5 / displayTime) * (w - 2 * pad);
    const releaseX = sustainX + (release / displayTime) * (w - 2 * pad);
    const topY = pad + 4;
    const bottomY = h - pad;
    const sustainY = bottomY - sustain * (bottomY - topY);
    ctx.strokeStyle = "var(--fg)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pad, bottomY);
    ctx.lineTo(attackX, topY);
    ctx.lineTo(decayX, sustainY);
    ctx.lineTo(sustainX, sustainY);
    ctx.lineTo(releaseX, bottomY);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 85, 0, 0.12)";
    ctx.beginPath();
    ctx.moveTo(pad, bottomY);
    ctx.lineTo(attackX, topY);
    ctx.lineTo(decayX, sustainY);
    ctx.lineTo(sustainX, sustainY);
    ctx.lineTo(releaseX, bottomY);
    ctx.lineTo(releaseX, bottomY);
    ctx.lineTo(pad, bottomY);
    ctx.fill();
  }

  setupWaveformPicker(moduleId, el) {
    const select = el.querySelector('.param-knob[data-param="waveform"]');
    if (!select) return;
    const currentValue = select.value;
    const container = document.createElement("div");
    container.className = "waveform-picker";
    const waveforms = {
      sine: '<svg viewBox="0 0 32 20" class="waveform-icon"><path d="M0 10 C8 0, 24 20, 32 10" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>',
      square:
        '<svg viewBox="0 0 32 20" class="waveform-icon"><path d="M0 4 h14 v12 h14" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>',
      sawtooth:
        '<svg viewBox="0 0 32 20" class="waveform-icon"><path d="M0 16 L28 4 L28 16" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>',
      triangle:
        '<svg viewBox="0 0 32 20" class="waveform-icon"><path d="M0 16 L16 4 L32 16" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>',
    };
    for (const [value, svg] of Object.entries(waveforms)) {
      const btn = document.createElement("button");
      btn.className = "waveform-btn";
      btn.type = "button";
      btn.innerHTML = svg;
      if (value === currentValue) btn.classList.add("active");
      btn.onclick = () => {
        select.value = value;
        select.dispatchEvent(new Event("change"));
        for (const b of container.querySelectorAll(".waveform-btn")) {
          b.classList.toggle("active", b === btn);
        }
      };
      container.appendChild(btn);
    }
    select.parentNode.insertBefore(container, select.nextSibling);
    select.style.display = "none";
  }

  drawFilterCurve(el) {
    const canvas = el.querySelector(".filter-curve");
    if (!canvas) return;
    const type =
      el.querySelector('.param-knob[data-param="type"]')?.value || "lowpass";
    const cutoff = parseFloat(
      el.querySelector('.param-knob[data-param="frequency"]')?.value || 1000,
    );
    const resonance = parseFloat(
      el.querySelector('.param-knob[data-param="resonance"]')?.value || 0.7,
    );
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const pad = 4;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "var(--bg)";
    ctx.fillRect(0, 0, w, h);
    const logMin = Math.log10(20);
    const logMax = Math.log10(20000);
    const cutoffLog = Math.log10(Math.max(20, Math.min(20000, cutoff)));
    const cutoffX =
      pad + ((cutoffLog - logMin) / (logMax - logMin)) * (w - 2 * pad);
    function gainAtFreq(freq) {
      const f = freq / cutoff;
      let gain = 0;
      if (type === "lowpass") {
        if (f <= 1) gain = 0;
        else gain = -24 * Math.log2(f);
      } else if (type === "highpass") {
        if (f >= 1) gain = 0;
        else gain = -24 * Math.log2(1 / f);
      } else if (type === "bandpass") {
        gain = -24 * Math.abs(Math.log2(f));
      }
      const peak = resonance * 6 * Math.exp(-Math.pow(Math.log2(f) * 4, 2));
      return gain + peak;
    }
    ctx.strokeStyle = "var(--fg)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let px = pad; px <= w - pad; px += 2) {
      const freqLog = logMin + ((px - pad) / (w - 2 * pad)) * (logMax - logMin);
      const freq = Math.pow(10, freqLog);
      const gainDb = gainAtFreq(freq);
      const y = h / 3 - (gainDb / 30) * ((h * 2) / 3);
      const clampedY = Math.max(pad, Math.min(h - pad, y));
      if (px === pad) ctx.moveTo(px, clampedY);
      else ctx.lineTo(px, clampedY);
    }
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 85, 0, 0.12)";
    ctx.lineTo(w - pad, h - pad);
    ctx.lineTo(pad, h - pad);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 85, 0, 0.4)";
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cutoffX, pad);
    ctx.lineTo(cutoffX, h - pad);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
