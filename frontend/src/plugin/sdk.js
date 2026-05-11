/**
 * VIBRA PLUGIN SDK
 *
 * A plugin is a JS module exporting a manifest:
 * {
 *   id: string,
 *   name: string,
 *   category: string,
 *   inputs: PortDef[],
 *   outputs: PortDef[],
 *   parameters: ParamDef[],
 *   create(audioContext): AudioNode,
 *   update(node, params): void,
 *   destroy(node): void
 * }
 */

const registry = new Map()

export function validateManifest(manifest) {
  if (!manifest.id || typeof manifest.id !== 'string') throw new Error('PLUGIN MISSING ID')
  if (!manifest.name || typeof manifest.name !== 'string') throw new Error('PLUGIN MISSING NAME')
  if (!manifest.category) manifest.category = 'other'
  if (!Array.isArray(manifest.inputs)) manifest.inputs = []
  if (!Array.isArray(manifest.outputs)) manifest.outputs = []
  if (!Array.isArray(manifest.parameters)) manifest.parameters = []
  if (typeof manifest.create !== 'function') throw new Error('PLUGIN MISSING create()')
  if (typeof manifest.update !== 'function') manifest.update = () => {}
  if (typeof manifest.destroy !== 'function') manifest.destroy = () => {}
  return manifest
}

export function registerPlugin(manifest) {
  const m = validateManifest(manifest)
  if (registry.has(m.id)) {
    console.warn(`PLUGIN ${m.id} ALREADY REGISTERED -- OVERWRITING`)
  }
  registry.set(m.id, m)
  return m.id
}

export function getPlugin(id) {
  return registry.get(id)
}

export function allPlugins() {
  return Array.from(registry.values())
}

export function pluginsByCategory() {
  const map = new Map()
  for (const p of registry.values()) {
    if (!map.has(p.category)) map.set(p.category, [])
    map.get(p.category).push(p)
  }
  return map
}

/** Load plugins from a dynamic import map */
export async function loadPlugins(modules) {
  for (const [path, factory] of Object.entries(modules)) {
    try {
      const mod = await factory()
      const manifest = mod.default || mod
      registerPlugin(manifest)
      console.log(`LOADED PLUGIN ${manifest.id} FROM ${path}`)
    } catch (err) {
      console.error(`FAILED TO LOAD PLUGIN FROM ${path}:`, err)
    }
  }
}
