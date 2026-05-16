import { quotePassesAvailableJobsStrict } from './adminJobListRules'
import { quoteMoveYmd } from './operationsMapDateFilter'
import { formatDriveDuration } from './operationsMapDirections'
import {
  filterActiveQuotes,
  filterCancelledQuotes,
  filterCompletedQuotes,
} from './adminWorkflowFilters'
import { mergedAdminWorkflowForQuote } from './quoteAdminWorkflowMerge'
import { formatDateUK } from './formatDateDisplay'
import { parseDetailsKeyValues, formatMoveArrivalSummary, parsePricingText, formatVolumeAndCrew } from './quoteJobAdminModel'
import { getMarketplaceFinancePresentation } from './marketplaceQuoteFinance'
import { journeyExceedsEightHours } from './journeyPlannerModel'
import { JOURNEY_VAN_CAPACITY_M3 } from './journeySummary'
import {
  dispatchStatusLabel,
  driverStatusFromContext,
} from './operationsMapDispatchStatus'

function toRad(d) {
  return (d * Math.PI) / 180
}

/**
 * @param {number} lng1
 * @param {number} lat1
 * @param {number} lng2
 * @param {number} lat2
 */
export function haversineMiles(lng1, lat1, lng2, lat2) {
  const R = 3958.8
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/**
 * @param {GeoJSON.FeatureCollection} lineCollection
 */
export function sumLineCollectionMiles(lineCollection) {
  let sum = 0
  for (const f of lineCollection?.features || []) {
    const g = f.geometry
    if (!g || g.type !== 'LineString') continue
    const c = g.coordinates
    for (let i = 1; i < c.length; i++) {
      const a = c[i - 1]
      const b = c[i]
      if (!Array.isArray(a) || !Array.isArray(b)) continue
      sum += haversineMiles(a[0], a[1], b[0], b[1])
    }
  }
  return Math.round(sum * 10) / 10
}

/** @typedef {'available'|'active'|'completed'|'cancelled'|'drivers'|'journeys'} OperationsMapMode */

export const OPERATIONS_MAP_MODES = /** @type {const} */ ([
  'available',
  'active',
  'completed',
  'cancelled',
  'drivers',
  'journeys',
])

/**
 * @param {OperationsMapMode} mode
 * @param {Record<string, unknown>[]} quotes
 * @param {Record<string, unknown>[]} jobs
 */
export function quotesForOperationsMapMode(mode, quotes, jobs) {
  const j = Array.isArray(jobs) ? jobs : []
  const q = Array.isArray(quotes) ? quotes : []
  if (mode === 'available') return q.filter(quotePassesAvailableJobsStrict)
  if (mode === 'active') return filterActiveQuotes(q, j)
  if (mode === 'completed') return filterCompletedQuotes(q, j)
  if (mode === 'cancelled') return filterCancelledQuotes(q, j)
  return []
}

/**
 * @param {Record<string, unknown>} q
 */
export function quoteJobRef(q) {
  const r = q?.quote_ref != null ? String(q.quote_ref).trim() : ''
  return r || String(q?.id || '').slice(0, 8)
}

/**
 * @param {Record<string, unknown>} q
 */
export function quoteServiceLabel(q) {
  const st = String(q?.status || '').trim()
  const ps = String(q?.payment_status || '').trim()
  if (st && ps) return `${st} · ${ps}`
  return st || ps || 'Job'
}

/**
 * Road leg from Mapbox Directions only — no straight-line geometry.
 * @typedef {{ coordinates: number[][], durationSeconds: number, distanceMeters: number }} OperationsMapRouteLeg
 * @typedef {Record<string, OperationsMapRouteLeg>} RouteLegByQuoteId
 */

/**
 * @param {Record<string, unknown>[]} quotes
 * @param {Record<string, { pickup: { lng: number, lat: number } | null, delivery: { lng: number, lat: number } | null }>} coordsByQuoteId
 * @param {OperationsMapMode | 'drivers'} mode
 * @param {RouteLegByQuoteId} [routeLegByQuoteId]
 */
export function buildJobMapGeoJson(quotes, coordsByQuoteId, mode, routeLegByQuoteId) {
  /** @type {GeoJSON.Feature<GeoJSON.LineString>[]} */
  const legs = []
  /** @type {GeoJSON.Feature<GeoJSON.Point>[]} */
  const pickups = []
  /** @type {GeoJSON.Feature<GeoJSON.Point>[]} */
  const deliveries = []

  const linePalette =
    mode === 'cancelled'
      ? { main: '#f87171', glow: '#fecaca' }
      : mode === 'completed'
        ? { main: '#94a3b8', glow: '#cbd5e1' }
        : mode === 'active'
          ? { main: '#38bdf8', glow: '#bae6fd' }
          : { main: '#64748b', glow: '#94a3b8' }

  const routes = routeLegByQuoteId && typeof routeLegByQuoteId === 'object' ? routeLegByQuoteId : {}

  for (const q of quotes) {
    const id = String(q?.id || '')
    if (!id) continue
    const c = coordsByQuoteId[id]
    if (!c?.pickup || !c?.delivery) continue
    const pu = c.pickup
    const dr = c.delivery
    const ref = quoteJobRef(q)
    const name = String(q?.full_name || '').trim() || '—'
    const fin = getMarketplaceFinancePresentation(q)
    const payout =
      fin?.marketplacePayout != null && Number.isFinite(Number(fin.marketplacePayout))
        ? `£${Number(fin.marketplacePayout).toFixed(2)}`
        : '—'
    const kv = parseDetailsKeyValues(q.details)
    const moveYmd = quoteMoveYmd(q)
    const move = moveYmd ? formatDateUK(moveYmd) : '—'
    const dateTime = formatMoveArrivalSummary(q, kv) || move
    const vol = formatVolumeAndCrew(q)
    const service = quoteServiceLabel(q)

    /** Road route only — no straight segment between pins. */
    const leg = routes[id]
    const lineCoords = leg && Array.isArray(leg.coordinates) ? leg.coordinates : null
    const validLeg =
      lineCoords &&
      lineCoords.length >= 2 &&
      lineCoords.every(
        (p) =>
          Array.isArray(p) &&
          p.length >= 2 &&
          Number.isFinite(Number(p[0])) &&
          Number.isFinite(Number(p[1])),
      )

    if (validLeg) {
      const dSec =
        typeof leg.durationSeconds === 'number' && Number.isFinite(leg.durationSeconds)
          ? leg.durationSeconds
          : 0
      const dM =
        typeof leg.distanceMeters === 'number' && Number.isFinite(leg.distanceMeters)
          ? leg.distanceMeters
          : 0
      legs.push({
        type: 'Feature',
        properties: {
          quoteId: id,
          jobRef: ref,
          lineMain: linePalette.main,
          lineGlow: linePalette.glow,
          mode,
          driveDurationSec: dSec,
          driveDurationLabel: formatDriveDuration(dSec),
          driveDistanceM: dM,
        },
        geometry: {
          type: 'LineString',
          coordinates: lineCoords,
        },
      })
    }

    pickups.push({
      type: 'Feature',
      properties: {
        quoteId: id,
        jobRef: ref,
        kind: 'pickup',
        pointKind: 'pickup',
        pointNum: '1',
        markerCaption: `1 • ${ref}`,
        label: '1',
        customer: name,
        volume: vol,
        payout,
        moveDate: move,
        dateTime,
        service,
      },
      geometry: { type: 'Point', coordinates: [pu.lng, pu.lat] },
    })
    deliveries.push({
      type: 'Feature',
      properties: {
        quoteId: id,
        jobRef: ref,
        kind: 'delivery',
        pointKind: 'delivery',
        pointNum: '2',
        markerCaption: `2 • ${ref}`,
        label: '2',
        customer: name,
        volume: vol,
        payout,
        moveDate: move,
        dateTime,
        service,
      },
      geometry: { type: 'Point', coordinates: [dr.lng, dr.lat] },
    })
  }

  /** @type {GeoJSON.Feature<GeoJSON.Point>[]} */
  const centroids = []
  for (const f of pickups) {
    const id = String(f.properties?.quoteId || '')
    const c = coordsByQuoteId[id]
    if (!c?.pickup || !c?.delivery) continue
    centroids.push({
      type: 'Feature',
      properties: { ...f.properties },
      geometry: {
        type: 'Point',
        coordinates: [(c.pickup.lng + c.delivery.lng) / 2, (c.pickup.lat + c.delivery.lat) / 2],
      },
    })
  }

  /** All pickup + delivery points for clustered map layer (same props as pickups/deliveries). */
  const jobPoints = {
    type: 'FeatureCollection',
    features: [...pickups, ...deliveries],
  }

  return {
    legs: { type: 'FeatureCollection', features: legs },
    pickups: { type: 'FeatureCollection', features: pickups },
    deliveries: { type: 'FeatureCollection', features: deliveries },
    jobPoints,
    centroids: { type: 'FeatureCollection', features: centroids },
  }
}

/**
 * @param {Record<string, unknown>[]} journeys
 * @param {Record<string, unknown>[]} stopRows
 */
export function buildJourneyMapGeoJson(journeys, stopRows) {
  /** @type {GeoJSON.Feature<GeoJSON.LineString>[]} */
  const lines = []
  /** @type {GeoJSON.Feature<GeoJSON.Point>[]} */
  const points = []

  const byJourney = new Map()
  for (const s of stopRows) {
    const jid = String(s?.journey_id || '')
    if (!jid) continue
    if (!byJourney.has(jid)) byJourney.set(jid, [])
    byJourney.get(jid).push(s)
  }

  for (const j of journeys) {
    const jid = String(j?.id || '')
    if (!jid) continue
    const stops = byJourney.get(jid) || []
    const coords = []
    let seq = 0
    for (const s of stops) {
      const lng = Number(s.lng)
      const lat = Number(s.lat)
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
      coords.push([lng, lat])
      seq += 1
      const kind = String(s.stop_kind || s.kind || 'stop')
      points.push({
        type: 'Feature',
        properties: {
          journeyId: jid,
          journeyRef: j.journey_ref != null ? String(j.journey_ref) : jid.slice(0, 8),
          title: (j.summary_title && String(j.summary_title)) || (j.title && String(j.title)) || 'Journey',
          seq,
          kind,
        },
        geometry: { type: 'Point', coordinates: [lng, lat] },
      })
    }
    if (coords.length >= 2) {
      lines.push({
        type: 'Feature',
        properties: {
          journeyId: jid,
          journeyRef: j.journey_ref != null ? String(j.journey_ref) : jid.slice(0, 8),
        },
        geometry: { type: 'LineString', coordinates: coords },
      })
    }
  }

  return {
    lines: { type: 'FeatureCollection', features: lines },
    points: { type: 'FeatureCollection', features: points },
  }
}

/**
 * @param {{
 *   mode: OperationsMapMode,
 *   quotes: Record<string, unknown>[],
 *   jobs: Record<string, unknown>[],
 *   journeys: Record<string, unknown>[],
 *   journeyStops: Record<string, unknown>[],
 *   coordsByQuoteId: Record<string, { pickup: { lng: number, lat: number } | null, delivery: { lng: number, lat: number } | null }>,
 *   visibleJobQuotes?: Record<string, unknown>[] | null,
 *   visibleJourneys?: Record<string, unknown>[] | null,
 * }} ctx
 * @returns {string[]}
 */
export function buildOperationsMapWarnings(ctx) {
  const { mode, quotes, jobs, journeys, journeyStops, coordsByQuoteId, visibleJobQuotes, visibleJourneys } = ctx
  /** @type {string[]} */
  const w = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const list =
    Array.isArray(visibleJobQuotes) && visibleJobQuotes !== null
      ? visibleJobQuotes
      : quotesForOperationsMapMode(mode, quotes, jobs)
  const journeyRows = Array.isArray(visibleJourneys) && visibleJourneys !== null ? visibleJourneys : journeys

  for (const q of list) {
    const ymd = quoteMoveYmd(q)
    const d = ymd ? new Date(`${ymd}T12:00:00`) : null
    if (d && !Number.isNaN(d.getTime()) && d < today) {
      const op = (mergedAdminWorkflowForQuote(q).operationalStatus || '').trim().toLowerCase()
      if (op !== 'completed' && String(q.status) !== 'Completed') {
        w.push(`Late move date: ${quoteJobRef(q)} (${formatDateUK(ymd)})`)
      }
    }
  }

  const byJourney = new Map()
  for (const s of journeyStops) {
    const jid = String(s?.journey_id || '')
    if (!jid) continue
    if (!byJourney.has(jid)) byJourney.set(jid, [])
    byJourney.get(jid).push(s)
  }

  for (const j of journeyRows) {
    const jid = String(j?.id || '')
    if (!jid) continue
    const sec = j.total_duration_seconds != null ? Number(j.total_duration_seconds) : 0
    if (journeyExceedsEightHours(sec)) {
      const ref = j.journey_ref != null ? String(j.journey_ref) : jid.slice(0, 8)
      w.push(`Journey over 8h: ${ref} (${Math.round(sec / 3600)}h planned)`)
    }
    let vol = 0
    const stops = byJourney.get(jid) || []
    const quoteIds = [...new Set(stops.map((s) => String(s.quote_id || '').trim()).filter(Boolean))]
    for (const q of quotes) {
      if (!quoteIds.includes(String(q.id))) continue
      const parsed = parsePricingText(q.pricing)
      if (parsed.volumeM3 != null && Number.isFinite(parsed.volumeM3)) vol += parsed.volumeM3
      else if (q.total_cubic_metres != null && Number.isFinite(Number(q.total_cubic_metres))) {
        vol += Number(q.total_cubic_metres)
      }
    }
    if (vol > JOURNEY_VAN_CAPACITY_M3) {
      w.push(`Over-capacity journey (~${vol.toFixed(1)} m³): ${j.journey_ref || jid.slice(0, 8)}`)
    }
  }

  const boxes = []
  for (const q of list) {
    const id = String(q?.id || '')
    const c = coordsByQuoteId[id]
    if (!c?.pickup || !c?.delivery) continue
    const minX = Math.min(c.pickup.lng, c.delivery.lng)
    const maxX = Math.max(c.pickup.lng, c.delivery.lng)
    const minY = Math.min(c.pickup.lat, c.delivery.lat)
    const maxY = Math.max(c.pickup.lat, c.delivery.lat)
    boxes.push({ minX, maxX, minY, maxY, ref: quoteJobRef(q) })
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]
      const b = boxes[j]
      const overlap = !(a.maxX < b.minX || b.maxX < a.minX || a.maxY < b.minY || b.maxY < a.minY)
      if (overlap) {
        w.push(`Overlapping job corridors: ${a.ref} & ${b.ref}`)
        break
      }
    }
    if (w.some((x) => x.startsWith('Overlapping'))) break
  }

  const idleHours = 36
  const idleCut = Date.now() - idleHours * 3600 * 1000
  for (const q of filterActiveQuotes(Array.isArray(quotes) ? quotes : [], Array.isArray(jobs) ? jobs : [])) {
    const at = q?.assigned_at ? new Date(String(q.assigned_at)).getTime() : NaN
    const op = (mergedAdminWorkflowForQuote(q).operationalStatus || '').trim().toLowerCase()
    if (Number.isFinite(at) && at < idleCut && !op) {
      w.push(`Possibly idle assignment (${idleHours}h+): ${quoteJobRef(q)}`)
    }
  }

  return [...new Set(w)].slice(0, 14)
}

/**
 * @param {Record<string, unknown>} driver
 * @param {Record<string, unknown> | null | undefined} liveRow
 * @param {Record<string, unknown>[]} assignedQuotes
 */
export function driverDispatchPresentation(driver, liveRow, assignedQuotes, etaLabel = '—') {
  const name = String(driver?.name || '').trim() || 'Driver'
  const dispatchStatus = driverStatusFromContext(driver, liveRow, assignedQuotes)
  const status = dispatchStatusLabel(dispatchStatus)
  const updated =
    liveRow?.updated_at != null
      ? String(liveRow.updated_at).replace('T', ' ').slice(0, 16)
      : 'No live GPS yet'
  return {
    name,
    status,
    dispatchStatus,
    updated,
    eta: etaLabel,
    initials: name.slice(0, 2).toUpperCase(),
  }
}

/**
 * @param {Record<string, unknown>[]} drivers
 * @param {Record<string, unknown>[]} activeQuotes
 * @param {Record<string, unknown>[]} jobs
 * @param {Record<string, Record<string, unknown>>} liveByDriverKey
 * @param {Record<string, { pickup: { lng: number, lat: number } | null, delivery: { lng: number, lat: number } | null }>} coordsByQuoteId
 */
export function buildDriverMapFeatures(drivers, activeQuotes, jobs, liveByDriverKey, coordsByQuoteId) {
  void jobs
  /** @type {GeoJSON.Feature<GeoJSON.Point>[]} */
  const features = []

  for (const d of drivers) {
    const id = String(d?.id || '').trim()
    if (!id) continue
    const live = liveByDriverKey[id] || null
    let lng = live != null && Number.isFinite(Number(live.lng)) ? Number(live.lng) : null
    let lat = live != null && Number.isFinite(Number(live.lat)) ? Number(live.lat) : null

    const nameNorm = String(d.name || '').trim().toLowerCase()
    const assigned = activeQuotes.filter((q) => {
      const aid = String(q.assigned_driver_id || '').trim()
      if (aid && aid === id) return true
      const dn = String(q.assigned_driver_name || '').trim().toLowerCase()
      return dn && dn === nameNorm
    })

    if (lng == null || lat == null) {
      const first = assigned[0]
      if (first) {
        const c = coordsByQuoteId[String(first.id)]
        const pick = c?.pickup
        if (pick && Number.isFinite(pick.lng) && Number.isFinite(pick.lat)) {
          lng = pick.lng
          lat = pick.lat
        }
      }
    }
    if (lng == null || lat == null) continue

    const pres = driverDispatchPresentation(d, live, assigned)
    const jobRefs = assigned.map((q) => quoteJobRef(q)).slice(0, 6)

    features.push({
      type: 'Feature',
      properties: {
        driverId: id,
        ...pres,
        jobRefs: jobRefs.join(', '),
        assignedCount: assigned.length,
        speedMph: live?.speed_mph != null ? Number(live.speed_mph) : 0,
      },
      geometry: { type: 'Point', coordinates: [lng, lat] },
    })
  }
  return { type: 'FeatureCollection', features }
}
