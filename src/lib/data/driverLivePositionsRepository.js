import { isSupabaseConfigured, supabase } from '../supabase'

/** Live GPS table (one row per driver, upserted from driver app). */
const TABLE = 'driver_locations'

/** Treat GPS as stale when older than this (ms). */
export const DRIVER_LOCATION_STALE_MS = 3 * 60 * 1000

const SELECT_WITH_JOINS = `
  id,
  driver_id,
  assignment_id,
  quote_id,
  latitude,
  longitude,
  heading,
  speed,
  accuracy,
  battery_level,
  status,
  updated_at,
  drivers ( id, full_name, phone ),
  job_assignments ( id, status ),
  quotes ( id, quote_ref, reference )
`

/**
 * @param {unknown} v
 * @returns {number | null}
 */
function parseCoord(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * @param {string | null | undefined} updatedAt
 */
export function isDriverLocationStale(updatedAt) {
  if (!updatedAt) return true
  const t = new Date(String(updatedAt)).getTime()
  if (!Number.isFinite(t)) return true
  return Date.now() - t > DRIVER_LOCATION_STALE_MS
}

/**
 * @param {string | null | undefined} status
 */
export function formatDriverTrackingStatus(status) {
  const s = String(status || '').trim()
  if (!s) return '—'
  return s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
}

/**
 * Normalize a `driver_locations` row for the operations map.
 * @param {Record<string, unknown> | null | undefined} row
 * @returns {Record<string, unknown> | null}
 */
export function normalizeDriverLocationRow(row) {
  if (!row || typeof row !== 'object') return null

  const driverId = String(row.driver_id || row.driver_key || '').trim()
  if (!driverId) return null

  const lat = parseCoord(row.latitude ?? row.lat)
  const lng = parseCoord(row.longitude ?? row.lng)
  const updated_at = row.updated_at != null ? String(row.updated_at) : null
  const stale = isDriverLocationStale(updated_at)

  const drivers =
    row.drivers && typeof row.drivers === 'object' && !Array.isArray(row.drivers) ? row.drivers : null
  const quotes =
    row.quotes && typeof row.quotes === 'object' && !Array.isArray(row.quotes) ? row.quotes : null
  const assignment =
    row.job_assignments && typeof row.job_assignments === 'object' && !Array.isArray(row.job_assignments)
      ? row.job_assignments
      : null

  let speed_mph = null
  if (row.speed != null && Number.isFinite(Number(row.speed))) {
    const s = Number(row.speed)
    speed_mph = s <= 45 ? s * 2.23694 : s
  } else if (row.speed_mph != null && Number.isFinite(Number(row.speed_mph))) {
    speed_mph = Number(row.speed_mph)
  }

  const quoteRef =
    (quotes?.quote_ref != null && String(quotes.quote_ref).trim()) ||
    (quotes?.reference != null && String(quotes.reference).trim()) ||
    null

  const assignmentRef = assignment?.id != null ? String(assignment.id).slice(0, 8) : null

  return {
    ...row,
    driver_key: driverId,
    driver_id: driverId,
    lat,
    lng,
    latitude: lat,
    longitude: lng,
    status: row.status != null ? String(row.status) : null,
    tracking_status: row.status != null ? String(row.status) : null,
    updated_at,
    stale,
    stale_label: stale ? 'Last location unavailable' : null,
    speed_mph,
    driver_name: drivers?.full_name != null ? String(drivers.full_name).trim() : null,
    driver_phone: drivers?.phone != null ? String(drivers.phone).trim() : null,
    quote_ref: quoteRef,
    assignment_ref: assignmentRef,
    assignment_status: assignment?.status != null ? String(assignment.status) : null,
  }
}

/**
 * Latest row per driver_id (most recent updated_at wins).
 * @returns {Promise<Record<string, Record<string, unknown>>>}
 */
export async function fetchLatestDriverLivePositionsMap() {
  if (!isSupabaseConfigured || !supabase) return {}
  try {
    let { data, error } = await supabase
      .from(TABLE)
      .select(SELECT_WITH_JOINS)
      .order('updated_at', { ascending: false })
      .limit(500)

    if (error) {
      const fallback = await supabase
        .from(TABLE)
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(500)
      data = fallback.data
      error = fallback.error
    }
    if (error) return {}

    /** @type {Record<string, Record<string, unknown>>} */
    const out = {}
    for (const raw of data ?? []) {
      const row = normalizeDriverLocationRow(raw)
      if (!row) continue
      const k = String(row.driver_id || '')
      if (!k || out[k]) continue
      out[k] = row
    }
    return out
  } catch {
    return {}
  }
}

/**
 * Subscribe to driver_locations changes (Supabase Realtime).
 * @param {(payload: { eventType: string, new: Record<string, unknown> | null }) => void} onEvent
 * @returns {() => void} unsubscribe
 */
export function subscribeDriverLivePositions(onEvent) {
  if (!isSupabaseConfigured || !supabase) return () => {}
  try {
    const channel = supabase
      .channel('operational-map-driver-locations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLE },
        (payload) => {
          const normalized = normalizeDriverLocationRow(
            payload.new && typeof payload.new === 'object' ? payload.new : null,
          )
          onEvent({
            eventType: payload.eventType,
            new: normalized,
          })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  } catch {
    return () => {}
  }
}
