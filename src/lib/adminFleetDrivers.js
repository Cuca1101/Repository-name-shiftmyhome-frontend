import { fetchFleetDrivers, findFleetDriverByNormalizedName, upsertFleetDriver } from './data/driversRepository'
import { isSupabaseConfigured } from './supabase'
import { loadAdminDrivers as loadSessionDrivers, saveAdminDrivers } from './adminFleetLocalStore'

/** @type {import('./data/driversRepository').fleetDriverToAdminRecord extends Function ? ReturnType<typeof import('./data/driversRepository').fleetDriverToAdminRecord>[] : never[] | null} */
let fleetCache = null

/**
 * Load fleet drivers: Supabase first, else browser session fallback.
 * @returns {Promise<import('./adminFleetLocalStore').AdminDriverRecord[]>}
 */
export async function loadFleetDriversForAdmin() {
  if (isSupabaseConfigured) {
    const remote = await fetchFleetDrivers()
    if (remote.length > 0) {
      fleetCache = remote
      return remote
    }
    const session = loadSessionDrivers()
    if (session.length > 0) {
      const migrated = []
      for (const d of session) {
        try {
          const row = await upsertFleetDriver({
            ...d,
            legacySessionId: d.id,
          })
          if (row) migrated.push(row)
        } catch (e) {
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.warn('[fleet] migrate driver failed', d.name, e)
          }
        }
      }
      if (migrated.length) {
        fleetCache = migrated
        return migrated
      }
    }
    fleetCache = []
    return []
  }
  fleetCache = loadSessionDrivers()
  return fleetCache
}

/** Synchronous access (cache or session). */
export function getFleetDriversCached() {
  if (fleetCache) return fleetCache
  return loadSessionDrivers()
}

/**
 * @param {string} name
 */
export function findFleetDriverByName(name) {
  const list = getFleetDriversCached()
  return findFleetDriverByNormalizedName(name, list)
}

/** @param {import('./adminFleetLocalStore').AdminDriverRecord[]} list */
export function setFleetDriversCache(list) {
  fleetCache = list
  if (!isSupabaseConfigured) saveAdminDrivers(list)
}
