/**
 * NODE GRAPH UI
 * DOM-based modules with SVG patch cables.
 */

export class NodeGraph {
  constructor(container, cablesSvg, modulesLayer, patchBay) {
    this.container = container
    this.cablesSvg = cablesSvg
    this.modulesLayer = modulesLayer
    this.patchBay = patchBay
    this.modules = new Map()
    this.dragState = null
    this.connectState = null
    this.setupEvents()
  }

  setupEvents() {
    this.modulesLayer.addEventListener('mousedown', (e) => {
      const header = e.target.closest('.module-header')
      if (header) {
        const moduleEl = header.closest('.module-node')
        this.startDrag(moduleEl.dataset.id, e.clientX, e.clientY)
      }

      const port = e.target.closest('.port')
      if (port) {
        this.handlePortClick(port)
      }
    })

    window.addEventListener('mousemove', (e) => {
      if (this.dragState) this.onDrag(e.clientX, e.clientY)
      if (this.connectState) this.onConnectMove(e.clientX, e.clientY)
    })

    window.addEventListener('mouseup', (e) => {
      if (this.dragState) this.endDrag()
      if (this.connectState) {
        const port = e.target.closest('.port.input')
        if (!port) {
          this.connectState.tempCable.remove()
          this.connectState = null
        }
      }
    })

    this.modulesLayer.addEventListener('contextmenu', (e) => {
      const moduleEl = e.target.closest('.module-node')
      if (moduleEl) {
        e.preventDefault()
        this.removeModule(moduleEl.dataset.id)
      }
    })
  }

  addModule(moduleId, manifest, x = 80, y = 80) {
    const el = document.createElement('div')
    el.className = 'module-node'
    el.dataset.id = moduleId
    el.style.left = `${x}px`
    el.style.top = `${y}px`

    let html = `<div class="module-header">${manifest.name}</div>`
    html += `<div class="module-body">`

    for (const input of manifest.inputs) {
      html += `<div class="port-row input"><span class="port-label">${input.name}</span><div class="port input" data-port="${input.id}"></div></div>`
    }

    for (const param of manifest.parameters) {
      const step = param.step || ''
      html += `<div class="param-row">
        <label>${param.name}</label>
        <input type="range" class="param-knob" data-param="${param.id}"
          min="${param.min}" max="${param.max}" step="${step}" value="${param.default}">
      </div>`
    }

    for (const output of manifest.outputs) {
      html += `<div class="port-row output"><div class="port output" data-port="${output.id}"></div><span class="port-label">${output.name}</span></div>`
    }

    html += `</div>`
    el.innerHTML = html

    for (const input of el.querySelectorAll('.param-knob')) {
      input.addEventListener('input', (e) => {
        const paramId = e.target.dataset.param
        const value = parseFloat(e.target.value)
        this.patchBay.setParam(moduleId, paramId, value)
      })
    }

    this.modulesLayer.appendChild(el)

    this.modules.set(moduleId, {
      el,
      x, y,
      inputEls: Object.fromEntries(Array.from(el.querySelectorAll('.port.input')).map(p => [p.dataset.port, p])),
      outputEls: Object.fromEntries(Array.from(el.querySelectorAll('.port.output')).map(p => [p.dataset.port, p]))
    })

    return el
  }

  removeModule(moduleId) {
    const mod = this.modules.get(moduleId)
    if (!mod) return
    mod.el.remove()
    this.modules.delete(moduleId)
    this.patchBay.removeModule(moduleId)
    this.redrawCables()
  }

  startDrag(id, mx, my) {
    const mod = this.modules.get(id)
    this.dragState = { id, offsetX: mx - mod.x, offsetY: my - mod.y }
  }

  onDrag(mx, my) {
    const mod = this.modules.get(this.dragState.id)
    mod.x = mx - this.dragState.offsetX
    mod.y = my - this.dragState.offsetY
    mod.el.style.left = `${mod.x}px`
    mod.el.style.top = `${mod.y}px`
    this.redrawCables()
  }

  endDrag() {
    this.dragState = null
  }

  handlePortClick(portEl) {
    const isOutput = portEl.classList.contains('output')
    const moduleEl = portEl.closest('.module-node')
    const moduleId = moduleEl.dataset.id
    const portId = portEl.dataset.port

    if (!this.connectState) {
      if (!isOutput) return
      const tempCable = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      tempCable.setAttribute('class', 'cable temp')
      this.cablesSvg.appendChild(tempCable)
      this.connectState = { sourceId: moduleId, outputId: portId, tempCable }
    } else {
      if (isOutput) {
        this.connectState.tempCable.remove()
        this.connectState = null
        return
      }
      try {
        this.patchBay.connect(this.connectState.sourceId, this.connectState.outputId, moduleId, portId)
        this.redrawCables()
      } catch (err) {
        console.error('CONNECTION FAILED:', err)
      }
      this.connectState.tempCable.remove()
      this.connectState = null
    }
  }

  onConnectMove(mx, my) {
    if (!this.connectState) return
    const mod = this.modules.get(this.connectState.sourceId)
    const srcPort = mod.outputEls[this.connectState.outputId]
    const rect = srcPort.getBoundingClientRect()
    const containerRect = this.container.getBoundingClientRect()
    const x1 = rect.left + rect.width / 2 - containerRect.left
    const y1 = rect.top + rect.height / 2 - containerRect.top
    const x2 = mx - containerRect.left
    const y2 = my - containerRect.top
    const d = `M ${x1} ${y1} C ${x1 + 50} ${y1}, ${x2 - 50} ${y2}, ${x2} ${y2}`
    this.connectState.tempCable.setAttribute('d', d)
  }

  redrawCables() {
    for (const cable of this.cablesSvg.querySelectorAll('.cable:not(.temp)')) {
      cable.remove()
    }

    for (const [id, mod] of this.modules) {
      const instance = this.patchBay.modules.get(id)
      if (!instance) continue
      for (const [inputId, conns] of Object.entries(instance.inputConnections)) {
        const targetPort = mod.inputEls[inputId]
        if (!targetPort) continue
        const tRect = targetPort.getBoundingClientRect()
        const cRect = this.container.getBoundingClientRect()
        const tx = tRect.left + tRect.width / 2 - cRect.left
        const ty = tRect.top + tRect.height / 2 - cRect.top

        for (const conn of conns) {
          const srcMod = this.modules.get(conn.sourceModuleId)
          if (!srcMod) continue
          const srcPort = srcMod.outputEls[conn.outputId]
          if (!srcPort) continue
          const sRect = srcPort.getBoundingClientRect()
          const sx = sRect.left + sRect.width / 2 - cRect.left
          const sy = sRect.top + sRect.height / 2 - cRect.top

          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
          path.setAttribute('class', 'cable')
          path.setAttribute('d', `M ${sx} ${sy} C ${sx + 50} ${sy}, ${tx - 50} ${ty}, ${tx} ${ty}`)
          this.cablesSvg.appendChild(path)
        }
      }
    }
  }
}
