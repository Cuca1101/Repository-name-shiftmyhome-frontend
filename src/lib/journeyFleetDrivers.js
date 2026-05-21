import { loadFleetDriversForAdmin } from './adminFleetDrivers'
import { isSupabaseConfigured, supabase } from './supabase'

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   phone: string,
 *   vehicleType: string,
 *   status: string,
 * }} DispatchDriverOption
 */

/**
 * Active fleet drivers for journey dispatch modal (includes vehicle when available).
 * @returns {Promise<DispatchDriverOption[]>}
 */
export async function fetchActiveFleetDriversForDispatch() {
  const list = await loadFleetDriversForAdmin()
  const active = list.filter((d) => String(d.status || '') === 'Active' && String(d.id || '').trim())

  /** @type {Record<string, { vehicle_type?: string, phone?: string }>} */
  let metaById = {}
  if (isSupabaseConfigured && supabase && active.length > 0) {
    const ids = active.map((d) => String(d.id))
    const { data } = await supabase.from('drivers').select('id, vehicle_type, phone').in('id', ids.slice(0, 100))
    for (const row of data ?? []) {
      if (row?.id) metaById[String(row.id)] = row
    }
  }

  return active
    .map((d) => {
      const meta = metaById[String(d.id)] || {}
      return {
        id: String(d.id),
        name: String(d.name || '').trim(),
        phone: String(meta.phone || d.phone || '').trim(),
        vehicleType: String(meta.vehicle_type || '').trim(),
        status: String(d.status || 'Active'),
      }
    })
    .filter((d) => d.name)
}

/**
 * @param {string[]} driverIds
 * @returns {Promise<Record<string, string>>}
 */
export async function fetchDriverNamesByIds(driverIds) {
  const ids = [...new Set((driverIds || []).map((x) => String(x || '').trim()).filter(Boolean))]
  /** @type {Record<string, string>} */
  const out = {}
  if (!isSupabaseConfigured || !supabase || ids.length === 0) return out
  const { data } = await supabase.from('drivers').select('id, full_name').in('id', ids.slice(0, 100))
  for (const row of data ?? []) {
    if (row?.id) out[String(row.id)] = String(row.full_name || '').trim()
  }
  return out
}
