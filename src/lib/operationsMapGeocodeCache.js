import { geocodeAddress } from './mapboxRouteApi'

const cache = new Map()

/**
 * @param {string} address
 * @param {string} token
 * @returns {Promise<{ lng: number, lat: number } | null>}
 */
export async function geocodeAddressCached(address, token) {
  const k = String(address || '').trim().toLowerCase()
  if (!k || !token) return null
  if (cache.has(k)) return cache.get(k)
  const r = await geocodeAddress(address, token)
  if (r) cache.set(k, r)
  return r
}

export function clearOperationsGeocodeCache() {
  cache.clear()
}
