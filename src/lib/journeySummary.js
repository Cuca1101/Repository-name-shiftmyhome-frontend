import { haversineMeters } from './journeyRouteOptimize'
import { metersToMiles } from './mapboxRouteApi'
import {
  buildPricingBreakdownSections,
  formatMoveArrivalSummary,
  parseDetailsKeyValues,
  parseInventoryTableRows,
  parsePricingText,
  parseWizardStructured,
  mergeDetailSections,
} from './quoteJobAdminModel'

/** Typical Luton-style capacity for “over capacity” warning (m³). */
export const JOURNEY_VAN_CAPACITY_M3 = 18

/**
 * @param {unknown} address
 */
export function extractUkPostcode(address) {
  const s = String(address ?? '')
    .trim()
    .replace(/\s+/g, ' ')
  const m = s.match(/([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})$/i)
  return m ? m[1].toUpperCase().replace(/\s+/g, ' ') : ''
}

/**
 * @param {Record<string, unknown>[]} quotesOrdered
 */
export function maxVolumeM3FromQuotes(quotesOrdered) {
  let max = 0
  for (const q of quotesOrdered || []) {
    const { volumeM3 } = parsePricingText(q?.pricing)
    const v =
      volumeM3 != null && Number.isFinite(volumeM3)
        ? volumeM3
        : q?.total_cubic_metres != null && Number.isFinite(Number(q.total_cubic_metres))
          ? Number(q.total_cubic_metres)
          : 0
    if (v > max) max = v
  }
  return Math.round(max * 100) / 100
}

/**
 * @param {Record<string, unknown>[]} quotesOrdered
 */
export function sumVolumeM3FromQuotes(quotesOrdered) {
  let sum = 0
  for (const q of quotesOrdered || []) {
    const { volumeM3 } = parsePricingText(q?.pricing)
    if (volumeM3 != null && Number.isFinite(volumeM3)) sum += volumeM3
    else if (q?.total_cubic_metres != null && Number.isFinite(Number(q.total_cubic_metres))) {
      sum += Number(q.total_cubic_metres)
    }
  }
  return Math.round(sum * 100) / 100
}

/**
 * @param {Record<string, unknown>[]} quotesOrdered
 * @returns {number | null}
 */
export function estimatedWeightKgFromQuotes(quotesOrdered) {
  let sum = 0
  let any = false
  for (const q of quotesOrdered || []) {
    const kv = parseDetailsKeyValues(q?.details)
    const w =
      kv['Estimated weight'] ||
      kv['Total weight'] ||
      kv['Weight (kg)'] ||
      kv['Weight'] ||
      ''
    const m = String(w).match(/([\d,.]+)\s*kg/i) || String(w).match(/^([\d,.]+)\s*kg?$/i)
    if (m) {
      const n = parseFloat(m[1].replace(/,/g, ''))
      if (Number.isFinite(n) && n > 0) {
        sum += n
        any = true
      }
    }
  }
  return any ? Math.round(sum * 10) / 10 : null
}

/**
 * @param {Record<string, unknown>[]} quotesOrdered
 * @param {{ totalDurationSeconds: number }} totals
 */
export function buildJourneyMarketplaceTitle(quotesOrdered, totals) {
  let maxCrew = 0
  for (const q of quotesOrdered || []) {
    const c = Number(q?.crew_size)
    if (Number.isFinite(c) && c > 0) maxCrew = Math.max(maxCrew, Math.round(c))
  }
  const crewLabel = maxCrew > 0 ? `${maxCrew} Man` : 'Crew TBC'
  const dur = Math.max(0, Math.round(Number(totals?.totalDurationSeconds) || 0))
  const dayBand = dur >= 8 * 3600 ? 'Full Day' : dur >= 4 * 3600 ? 'Half Day' : 'Standard'
  const maxVol = maxVolumeM3FromQuotes(quotesOrdered)
  const volBit = maxVol > 0 ? `${maxVol}m³` : 'Volume TBC'
  return `${crewLabel} Journey / ${dayBand} / ${volBit}`
}

/**
 * @param {{ quotes: Record<string, unknown>[], jobsCount: number }} p
 * @returns {string[]}
 */
export function buildJourneyRequirementsBadges(p) {
  const quotes = Array.isArray(p?.quotes) ? p.quotes : []
  const jobsCount = Math.max(0, Number(p?.jobsCount) || quotes.length)
  /** @type {Set<string>} */
  const tags = new Set()
  if (jobsCount > 1) tags.add('Multi-stop')

  for (const q of quotes) {
    const text = `${String(q?.details ?? '')}\n${String(q?.message ?? '')}`.toLowerCase()
    if (/\bstairs\b|flight|no lift|walk.?up/i.test(text)) tags.add('Stairs')
    if (/\blong carry\b|long walk|carry distance/i.test(text)) tags.add('Long carry')

    const sections = parseWizardStructured(q?.details)
    const merged = mergeDetailSections(sections, ['Move & access', 'Access', 'Route'])
    const accessBlob = Object.values(merged).join(' ').toLowerCase()
    if (/\bstairs\b|no lift/i.test(accessBlob)) tags.add('Stairs')
    if (/\blong carry\b|long walk/i.test(accessBlob)) tags.add('Long carry')

    const { heavy } = buildPricingBreakdownSections(q)
    if (heavy.length > 0) tags.add('Heavy items')

    const rows = parseInventoryTableRows(q?.inventory, q?.details)
    for (const r of rows) {
      const st = String(r.sizeType || '').toLowerCase()
      if (st.includes('heavy') || st.includes('large')) tags.add('Heavy items')
    }
  }

  return [...tags]
}

/**
 * @param {Record<string, unknown>[]} quotesOrdered
 */
export function buildJourneyMoveDateAndRange(quotesOrdered) {
  /** @type {string[]} */
  const dates = []
  /** @type {string[]} */
  const ranges = []
  for (const q of quotesOrdered || []) {
    if (q?.move_date) dates.push(String(q.move_date))
    const kv = parseDetailsKeyValues(q?.details)
    ranges.push(formatMoveArrivalSummary(q, kv))
  }
  dates.sort()
  const moveDate = dates[0] || null
  const uniqRanges = [...new Set(ranges.map((r) => String(r).trim()).filter((r) => r && r !== '—'))]
  const timeRangeSummary =
    uniqRanges.length === 0 ? '—' : uniqRanges.length === 1 ? uniqRanges[0] : `${uniqRanges[0]} · … (${uniqRanges.length} windows)`
  return { moveDate, timeRangeSummary }
}

/**
 * First pickup → last delivery postcodes from stop order.
 * @param {import('./journeyPlannerModel.js').JourneyStop[]} stops
 */
export function firstLastPostcodesFromStops(stops) {
  const list = Array.isArray(stops) ? stops : []
  const firstPickup = list.find((s) => s.kind === 'pickup')
  const lastDel = [...list].reverse().find((s) => s.kind === 'delivery')
  return {
    fromPostcode: extractUkPostcode(firstPickup?.address),
    toPostcode: extractUkPostcode(lastDel?.address),
  }
}

/**
 * @param {import('./journeyPlannerModel.js').JourneyStop[]} stops
 * @returns {number|null}
 */
export function straightLineMilesAlongStops(stops) {
  const list = (Array.isArray(stops) ? stops : []).filter(
    (s) => s.lng != null && s.lat != null && Number.isFinite(s.lng) && Number.isFinite(s.lat),
  )
  if (list.length < 2) return null
  let m = 0
  for (let i = 1; i < list.length; i++) {
    m += haversineMeters(
      { lng: list[i - 1].lng, lat: list[i - 1].lat },
      { lng: list[i].lng, lat: list[i].lat },
    )
  }
  return Math.round(metersToMiles(m) * 10) / 10
}

/**
 * @param {number|null|undefined} roadMiles
 * @param {number|null|undefined} straightMiles
 * @param {{ ratio?: number }} [opts]
 */
export function isRouteInefficient(roadMiles, straightMiles, opts = {}) {
  const ratio = opts.ratio != null && Number.isFinite(opts.ratio) ? opts.ratio : 1.42
  const r = Number(roadMiles)
  const s = Number(straightMiles)
  if (!Number.isFinite(r) || !Number.isFinite(s) || s <= 0) return false
  return r > s * ratio
}
