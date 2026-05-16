/**
 * In-memory + sessionStorage cache for Mapbox driving legs (geometry + ETA).
 * Keeps routes stable across filter changes and page reloads in the same tab.
 */

const STORAGE_KEY = 'shiftmyhome:ops-map-routes:v1'
const MAX_ENTRIES = 150

/** @type {Map<string, import('./operationsMapDirections').OperationsMapRouteLeg | null>} */
const memory = new Map()

let storageLoaded = false

/** @typedef {{ coordinates: number[][], durationSeconds: number, distanceMeters: number }} OperationsMapRouteLeg */

function loadStorageOnce() {
  if (storageLoaded) return
  storageLoaded = true
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return
    for (const [key, value] of Object.entries(parsed)) {
      if (value === null) {
        memory.set(key, null)
        continue
      }
      if (!value || typeof value !== 'object') continue
      const coords = value.coordinates
      if (!Array.isArray(coords) || coords.length < 2) continue
      memory.set(key, {
        coordinates: coords,
        durationSeconds: Number(value.durationSeconds) || 0,
        distanceMeters: Number(value.distanceMeters) || 0,
      })
    }
  } catch {
    /* ignore corrupt cache */
  }
}

function persistStorage() {
  try {
    const entries = [...memory.entries()]
    const slice = entries.length > MAX_ENTRIES ? entries.slice(-MAX_ENTRIES) : entries
    const obj = Object.fromEntries(slice)
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
  } catch {
    /* quota / private mode */
  }
}

/**
 * @param {string} key
 * @returns {OperationsMapRouteLeg | null | undefined} undefined = cache miss
 */
export function getOperationsRouteLegCached(key) {
  loadStorageOnce()
  if (!memory.has(key)) return undefined
  const v = memory.get(key)
  return v === undefined ? undefined : v
}

/**
 * @param {string} key
 * @param {OperationsMapRouteLeg | null} leg
 */
export function setOperationsRouteLegCached(key, leg) {
  loadStorageOnce()
  if (!key) return
  if (leg?.coordinates?.length >= 2) {
    memory.set(key, {
      coordinates: leg.coordinates,
      durationSeconds: Number(leg.durationSeconds) || 0,
      distanceMeters: Number(leg.distanceMeters) || 0,
    })
  } else {
    memory.set(key, null)
  }
  if (memory.size > MAX_ENTRIES) {
    const drop = memory.size - MAX_ENTRIES
    const keys = [...memory.keys()]
    for (let i = 0; i < drop; i += 1) memory.delete(keys[i])
  }
  persistStorage()
}

export function clearOperationsRouteCache() {
  memory.clear()
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
