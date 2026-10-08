/**
 * Customer track-page driving ETA (Mapbox Directions) from driver GPS → collection/delivery.
 * Always builds a road route from last-known driver coords when available.
 * Live ETA numbers are only shown when gpsFresh is true.
 */
import { haversineMetres } from './jobLocationAnalytics.js'
import { formatTimeUK } from './driverMotionStatus.js'

function metersToMiles(meters) {
  if (typeof meters !== 'number' || Number.isNaN(meters)) return 0
  return Math.round(meters * 0.000621371 * 10) / 10
}

function formatDriveDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  const totalMin = Math.max(1, Math.round(seconds / 60))
  if (totalMin < 60) return `${totalMin} min`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (m <= 0) return `${h} h`
  return `${h} h ${m} min`
}

/** Recalc Directions when driver moved at least this far. */
export const ETA_MOVE_THRESHOLD_M = 90

/** Max age of a cached Directions result while GPS stays fresh. */
export const ETA_MAX_AGE_MS = 60 * 1000

/**
 * @param {string | null | undefined} raw
 */
export function normalizeTrackingStatusKey(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

/**
 * Which stop to route to, or null when ETA should be hidden.
 * Checks both operational_status and status_raw so "Assigned"+"on_way" still works.
 *
 * @param {string | null | undefined} operationalStatus
 * @param {string | null | undefined} statusRaw
 * @returns {{ kind: 'collection' | 'delivery', placeLabel: string } | null}
 */
export function resolveTrackingEtaDestination(operationalStatus, statusRaw) {
  const keys = [operationalStatus, statusRaw].map(normalizeTrackingStatusKey).filter(Boolean)

  const has = (list) => keys.some((s) => list.includes(s))

  // Terminal / at-stop stages hide en-route ETA (prefer these over older statuses).
  if (has(['completed', 'cancelled', 'arrived_delivery', 'unloading'])) return null
  if (has(['arrived', 'arrived_pickup', 'loading', 'loaded'])) return null

  if (has(['pickup_completed', 'in_transit', 'in_progress', 'on_way_to_delivery'])) {
    return { kind: 'delivery', placeLabel: 'delivery' }
  }
  if (has(['on_way', 'started', 'start', 'on_the_way', 'on_way_to_collection'])) {
    return { kind: 'collection', placeLabel: 'collection' }
  }
  // Assigned / accepted: still route to collection so the customer sees a real path + ETA
  // as soon as the driver has GPS (matches Track my driver mock).
  if (
    has([
      'assigned',
      'accepted',
      'confirmed',
      'booked',
      'paid',
      'deposit_paid',
      'driver_assigned',
    ])
  ) {
    return { kind: 'collection', placeLabel: 'collection' }
  }
  return null
}

/** Fresh enough for live ETA (customer portal). Aligns with RPC live window. */
export const TRACKING_GPS_FRESH_MS = 5 * 60 * 1000

/**
 * Whether driver GPS should be treated as live for ETA (not last-known-only).
 * @param {{
 *   trackingLive?: boolean,
 *   location?: { live?: boolean, available?: boolean, updated_at?: string | null, motion?: { state?: string } | null } | null,
 *   now?: number,
 * }} args
 */
export function isTrackingGpsFresh(args = {}) {
  const loc = args.location
  if (!loc?.available) return false
  const state = String(loc.motion?.state || '').toLowerCase()
  // Never treat last-known / missing GPS as live (Uber-style).
  if (state === 'unavailable' || state === 'stale') return false
  const updatedMs = loc.updated_at ? Date.parse(String(loc.updated_at)) : NaN
  const now = args.now ?? Date.now()
  const ageOk = Number.isFinite(updatedMs) && now - updatedMs <= TRACKING_GPS_FRESH_MS
  if (!ageOk) return false
  if (args.trackingLive && loc.live) return true
  if (loc.live === true) return true
  return state === 'moving' || state === 'stationary'
}

/**
 * @param {number} durationSeconds
 * @param {number} [nowMs]
 * @returns {{ minutes: number, minutesLabel: string, clock: string, arriveAtMs: number }}
 */
export function formatTrackingEtaTiming(durationSeconds, nowMs = Date.now()) {
  const seconds = Number(durationSeconds)
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0
  const minutes = Math.max(1, Math.round(safe / 60))
  const arriveAtMs = nowMs + safe * 1000
  return {
    minutes,
    minutesLabel: formatDriveDuration(safe),
    clock: formatTimeUK(new Date(arriveAtMs).toISOString()),
    arriveAtMs,
  }
}

/**
 * @param {number} distanceMeters
 */
export function formatTrackingEtaMiles(distanceMeters) {
  const miles = metersToMiles(Number(distanceMeters) || 0)
  if (!Number.isFinite(miles) || miles <= 0) return '—'
  return miles < 0.1 ? '<0.1' : miles.toFixed(1).replace(/\.0$/, '')
}

/**
 * @param {{ lng: number, lat: number } | null | undefined} prev
 * @param {{ lng: number, lat: number }} next
 * @param {number | null | undefined} lastFetchedAt
 * @param {number} [now]
 * @param {{ moveM?: number, maxAgeMs?: number }} [opts]
 */
export function shouldRefreshTrackingEta(prev, next, lastFetchedAt, now = Date.now(), opts = {}) {
  const moveM = opts.moveM ?? ETA_MOVE_THRESHOLD_M
  const maxAgeMs = opts.maxAgeMs ?? ETA_MAX_AGE_MS
  if (!next || !Number.isFinite(next.lng) || !Number.isFinite(next.lat)) return false
  if (lastFetchedAt == null || !Number.isFinite(lastFetchedAt)) return true
  if (now - lastFetchedAt >= maxAgeMs) return true
  if (
    prev &&
    Number.isFinite(prev.lng) &&
    Number.isFinite(prev.lat) &&
    haversineMetres(prev.lng, prev.lat, next.lng, next.lat) >= moveM
  ) {
    return true
  }
  return false
}

/**
 * Build road route + optional live ETA from driver coords → destination address.
 *
 * @param {{
 *   token: string,
 *   driver: { lng: number, lat: number },
 *   destinationAddress: string,
 *   kind: 'collection' | 'delivery',
 *   placeLabel: string,
 *   gpsFresh: boolean,
 *   cache: Record<string, unknown>,
 *   force?: boolean,
 * }} args
 */
export async function resolveTrackingDriverEta(args) {
  const token = String(args.token || '').trim()
  const placeLabel = args.placeLabel || args.kind
  const gpsFresh = Boolean(args.gpsFresh)

  const base = {
    active: true,
    kind: args.kind,
    placeLabel,
    routeCoordinates: null,
    destination: null,
  }

  if (!token || !args.destinationAddress?.trim()) {
    return {
      ...base,
      status: 'error',
      message: 'ETA temporarily unavailable',
      minutesLabel: null,
      clock: null,
      milesLabel: null,
      durationSeconds: null,
      distanceMeters: null,
      cache: args.cache,
    }
  }

  const driver = {
    lng: Number(args.driver?.lng),
    lat: Number(args.driver?.lat),
  }
  if (!Number.isFinite(driver.lng) || !Number.isFinite(driver.lat)) {
    return {
      ...base,
      status: 'unavailable',
      message: 'ETA currently unavailable — waiting for a fresh driver location',
      minutesLabel: null,
      clock: null,
      milesLabel: null,
      durationSeconds: null,
      distanceMeters: null,
      cache: args.cache,
    }
  }

  const destKey = `${args.kind}|${String(args.destinationAddress).trim().toLowerCase()}`
  let cache = { ...(args.cache || {}) }
  if (cache.destKey !== destKey) {
    cache = {
      destKey,
      dest: null,
      from: null,
      fetchedAt: null,
      durationSeconds: null,
      distanceMeters: null,
      coordinates: null,
      kind: args.kind,
    }
  }

  const { geocodeAddress } = await import('./mapboxRouteApi.js')
  const { fetchMapboxDrivingRoute } = await import('./operationsMapDirections.js')

  if (!cache.dest) {
    try {
      const { geocodeAddressCached } = await import('./operationsMapGeocodeCache.js')
      cache.dest = await geocodeAddressCached(args.destinationAddress, token)
    } catch {
      cache.dest = await geocodeAddress(args.destinationAddress, token)
    }
  }
  if (!cache.dest) {
    return {
      ...base,
      status: 'error',
      message: 'ETA temporarily unavailable',
      minutesLabel: null,
      clock: null,
      milesLabel: null,
      durationSeconds: null,
      distanceMeters: null,
      cache,
    }
  }

  const now = Date.now()
  const kindChanged = cache.kind != null && cache.kind !== args.kind
  const hasRoute = Array.isArray(cache.coordinates) && cache.coordinates.length >= 2

  // Stale GPS: still build a last-known road route once, but do not keep re-hitting Directions.
  // Fresh GPS: throttle by movement / age as usual.
  const needsFetch =
    args.force ||
    kindChanged ||
    !hasRoute ||
    (gpsFresh && shouldRefreshTrackingEta(cache.from, driver, cache.fetchedAt, now))

  if (needsFetch) {
    const route = await fetchMapboxDrivingRoute(driver, cache.dest, token)
    if (route?.coordinates?.length >= 2) {
      cache = {
        ...cache,
        from: { ...driver },
        fetchedAt: now,
        durationSeconds: route.durationSeconds,
        distanceMeters: route.distanceMeters,
        coordinates: route.coordinates,
        kind: args.kind,
      }
    }
  }

  const routeCoordinates =
    Array.isArray(cache.coordinates) && cache.coordinates.length >= 2 ? cache.coordinates : null

  // Never present ETA as live when GPS is stale — keep route + dest visible.
  if (!gpsFresh) {
    return {
      ...base,
      status: 'unavailable',
      message: 'ETA currently unavailable — waiting for a fresh driver location',
      minutesLabel: null,
      clock: null,
      milesLabel: null,
      durationSeconds: cache.durationSeconds ?? null,
      distanceMeters: cache.distanceMeters ?? null,
      routeCoordinates,
      destination: cache.dest,
      cache,
    }
  }

  if (cache.durationSeconds == null || !Number.isFinite(cache.durationSeconds)) {
    return {
      ...base,
      status: 'error',
      message: 'ETA temporarily unavailable',
      minutesLabel: null,
      clock: null,
      milesLabel: null,
      durationSeconds: null,
      distanceMeters: null,
      routeCoordinates,
      destination: cache.dest,
      cache,
    }
  }

  const timing = formatTrackingEtaTiming(cache.durationSeconds, now)
  return {
    ...base,
    status: 'ready',
    message: null,
    minutesLabel: timing.minutesLabel,
    clock: timing.clock,
    milesLabel: formatTrackingEtaMiles(cache.distanceMeters || 0),
    durationSeconds: cache.durationSeconds,
    distanceMeters: cache.distanceMeters,
    routeCoordinates,
    destination: cache.dest,
    cache,
  }
}
