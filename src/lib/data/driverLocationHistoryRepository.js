import { isSupabaseConfigured, supabase } from '../supabase'

const TABLE = 'driver_location_history'

/**
 * @param {string} quoteId
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<Array<{ lng: number, lat: number, recorded_at: string, status: string | null, speed: number | null }>>}
 */
export async function fetchDriverLocationHistoryForQuote(quoteId, opts = {}) {
  if (!isSupabaseConfigured || !supabase) return []
  const id = String(quoteId || '').trim()
  if (!id) return []

  const limit = opts.limit && opts.limit > 0 ? Math.min(opts.limit, 5000) : 2000

  const { data, error } = await supabase
    .from(TABLE)
    .select('latitude, longitude, recorded_at, status, speed, heading')
    .eq('quote_id', id)
    .order('recorded_at', { ascending: true })
    .limit(limit)

  if (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[driver_location_history] fetch failed', error.message)
    }
    return []
  }

  return (data ?? [])
    .map((row) => {
      const lng = Number(row.longitude)
      const lat = Number(row.latitude)
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
      return {
        lng,
        lat,
        recorded_at: String(row.recorded_at),
        status: row.status != null ? String(row.status) : null,
        speed: row.speed != null ? Number(row.speed) : null,
        heading: row.heading != null ? Number(row.heading) : null,
      }
    })
    .filter(Boolean)
}

/**
 * Latest trail for active job on operations map (driver drawer).
 * @param {string} driverId
 * @param {string} [quoteId]
 */
export async function fetchDriverLocationHistoryForDriver(driverId, quoteId) {
  if (!isSupabaseConfigured || !supabase) return []
  const did = String(driverId || '').trim()
  if (!did) return []

  let query = supabase
    .from(TABLE)
    .select('latitude, longitude, recorded_at, status, speed, quote_id')
    .eq('driver_id', did)
    .order('recorded_at', { ascending: true })
    .limit(1500)

  const qid = String(quoteId || '').trim()
  if (qid) query = query.eq('quote_id', qid)

  const { data, error } = await query
  if (error) return []

  return (data ?? [])
    .map((row) => {
      const lng = Number(row.longitude)
      const lat = Number(row.latitude)
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
      return {
        lng,
        lat,
        recorded_at: String(row.recorded_at),
        status: row.status != null ? String(row.status) : null,
        speed: row.speed != null ? Number(row.speed) : null,
      }
    })
    .filter(Boolean)
}
