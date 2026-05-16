import { parseDetailsKeyValues, formatMoveArrivalSummary, formatVolumeAndCrew, parsePricingText } from './quoteJobAdminModel'

/**
 * @typedef {'pickup' | 'delivery'} JourneyStopKind
 */

/**
 * @typedef {{
 *   id: string,
 *   quoteId: string,
 *   kind: JourneyStopKind,
 *   jobRef: string,
 *   address: string,
 *   timeWindow: string,
 *   customerName: string,
 *   serviceMinutes: number,
 *   volumeCrew: string,
 *   notes: string,
 *   lng?: number | null,
 *   lat?: number | null,
 * }} JourneyStop
 */

/** @param {number} totalSeconds */
export function formatJourneyDurationHhMm(totalSeconds) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h <= 0) return `${m}m`
  return `${h}h ${String(m).padStart(2, '0')}m`
}

/** @param {Record<string, unknown>} q */
function estimateStopMinutes(q, kind) {
  const { volumeM3 } = parsePricingText(q.pricing)
  const vol =
    volumeM3 != null && Number.isFinite(volumeM3)
      ? volumeM3
      : q.total_cubic_metres != null && Number.isFinite(Number(q.total_cubic_metres))
        ? Number(q.total_cubic_metres)
        : 0
  const volAdj = Math.min(90, Math.round(vol * 6))
  const base = kind === 'pickup' ? 40 : 35
  return Math.max(20, Math.min(240, base + volAdj))
}

/**
 * Build pickup then delivery for each quote, preserving quote order.
 * @param {Record<string, unknown>[]} quotesOrdered
 * @returns {JourneyStop[]}
 */
export function buildStopsFromQuotesOrdered(quotesOrdered) {
  /** @type {JourneyStop[]} */
  const out = []
  for (const q of quotesOrdered) {
    if (!q || typeof q !== 'object' || q.id == null) continue
    const quoteId = String(q.id)
    const ref = q.quote_ref ? String(q.quote_ref) : quoteId.slice(0, 8)
    const kv = parseDetailsKeyValues(q.details)
    const tw = formatMoveArrivalSummary(q, kv)
    const addrP = String(q.pickup_address || '').trim() || '—'
    const addrD = String(q.delivery_address || '').trim() || '—'
    const name = String(q.full_name || '').trim() || '—'
    const notes = String(q.message || '').trim() || ''
    out.push({
      id: `${quoteId}-pickup`,
      quoteId,
      kind: 'pickup',
      jobRef: ref,
      address: addrP,
      timeWindow: tw || '—',
      customerName: name,
      serviceMinutes: estimateStopMinutes(q, 'pickup'),
      volumeCrew: formatVolumeAndCrew(q),
      notes,
    })
    out.push({
      id: `${quoteId}-delivery`,
      quoteId,
      kind: 'delivery',
      jobRef: ref,
      address: addrD,
      timeWindow: tw || '—',
      customerName: name,
      serviceMinutes: estimateStopMinutes(q, 'delivery'),
      volumeCrew: formatVolumeAndCrew(q),
      notes,
    })
  }
  return out
}

/**
 * @param {JourneyStop[]} stops
 * @param {number | null} driveSeconds
 */
export function computeJourneyTotals(stops, driveSeconds) {
  const serviceSeconds = stops.reduce((sum, s) => sum + (Number(s.serviceMinutes) || 0) * 60, 0)
  const drive = driveSeconds != null && Number.isFinite(driveSeconds) ? Math.round(driveSeconds) : 0
  const totalDurationSeconds = drive + serviceSeconds
  const quoteIds = new Set(stops.map((s) => s.quoteId))
  return {
    totalDriveSeconds: drive,
    totalServiceSeconds: serviceSeconds,
    totalDurationSeconds,
    jobsCount: quoteIds.size,
  }
}

const EIGHT_HOURS_SEC = 8 * 3600

/** @param {number} totalDurationSeconds */
export function journeyExceedsEightHours(totalDurationSeconds) {
  return totalDurationSeconds > EIGHT_HOURS_SEC
}

/**
 * Each job's pickup stop must appear before its delivery stop in the ordered list.
 * @param {JourneyStop[]} stops
 * @returns {{ ok: boolean, message?: string }}
 */
export function validatePickupBeforeDeliveryForStops(stops) {
  if (!Array.isArray(stops) || stops.length === 0) return { ok: true }
  /** @type {Record<string, number>} */
  const pickupIndex = {}
  for (let i = 0; i < stops.length; i++) {
    const s = stops[i]
    const qid = String(s.quoteId || '').trim()
    if (!qid) continue
    if (s.kind === 'pickup') pickupIndex[qid] = i
    if (s.kind === 'delivery') {
      if (pickupIndex[qid] === undefined) {
        return {
          ok: false,
          message: `Delivery for ${s.jobRef || qid} appears before its pickup — move pickup earlier in the list.`,
        }
      }
      if (i < pickupIndex[qid]) {
        return {
          ok: false,
          message: `Delivery for ${s.jobRef || qid} is ordered before its pickup — reorder stops.`,
        }
      }
    }
  }
  return { ok: true }
}

/**
 * All pickups first (stable within pickups), then all deliveries (stable within deliveries).
 * Valid for multi-job journeys: each pickup still precedes its delivery.
 * @param {JourneyStop[]} stops
 * @returns {JourneyStop[]}
 */
export function sortStopsPickupsFirstAllJobs(stops) {
  if (!Array.isArray(stops)) return []
  const pickups = stops.filter((s) => s.kind === 'pickup')
  const deliveries = stops.filter((s) => s.kind === 'delivery')
  return [...pickups, ...deliveries]
}

/**
 * Sort by quote `move_date` (day), then pickup before delivery, then job ref.
 * @param {JourneyStop[]} stops
 * @param {Record<string, unknown>[]} quotesOrdered
 * @returns {JourneyStop[]}
 */
export function sortStopsByMoveDateAndKind(stops, quotesOrdered) {
  if (!Array.isArray(stops)) return []
  const byQuote = new Map(
    (quotesOrdered || [])
      .filter((q) => q && typeof q === 'object' && q.id != null)
      .map((q) => [String(q.id), q]),
  )
  /** @param {JourneyStop} s */
  function dayMs(s) {
    const q = byQuote.get(String(s.quoteId || '').trim())
    if (!q?.move_date) return Number.MAX_SAFE_INTEGER
    const raw = String(q.move_date).slice(0, 10)
    const t = Date.parse(raw)
    return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER
  }
  /** @param {JourneyStop} s */
  function kindRank(s) {
    return s.kind === 'pickup' ? 0 : 1
  }
  return [...stops].sort((a, b) => {
    const da = dayMs(a)
    const db = dayMs(b)
    if (da !== db) return da - db
    const k = kindRank(a) - kindRank(b)
    if (k !== 0) return k
    return String(a.jobRef || '').localeCompare(String(b.jobRef || ''))
  })
}
