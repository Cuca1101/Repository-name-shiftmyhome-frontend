/**
 * Customer track-page driving ETA (Mapbox Directions) from driver GPS → collection/delivery.
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
 * @param {string | null | undefined} operationalStatus
 * @param {string | null | undefined} statusRaw
 * @returns {{ kind: 'collection' | 'delivery', placeLabel: string } | null}
 */
export function resolveTrackingEtaDestination(operationalStatus, statusRaw) {
  const s = normalizeTrackingStatusKey(operationalStatus || statusRaw)
  if (['on_way', 'started', 'start'].includes(s)) {
    return { kind: 'collection', placeLabel: 'collection' }
  }
  if (['pickup_completed', 'in_transit', 'in_progress'].includes(s)) {
    return { kind: 'delivery', placeLabel: 'delivery' }
  }
  // Arrived / loading / unloading / completed — no en-route ETA
  return null
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
 * Fetch (or reuse) driving ETA from driver → destination address.
 * Geocodes destination once per address; throttles Directions via shouldRefreshTrackingEta.
 *
 * @param {{
 *   token: string,
 *   driver: { lng: number, lat: number },
 *   destinationAddress: string,
 *   kind: 'collection' | 'delivery',
 *   placeLabel: string,
 *   gpsFresh: boolean,
 *   cache: {
 *     destKey?: string,
 *     dest?: { lng: number, lat: number } | null,
 *     from?: { lng: number, lat: number } | null,
 *     fetchedAt?: number | null,
 *     durationSeconds?: number | null,
 *     distanceMeters?: number | null,
 *     kind?: string | null,
 *   },
 *   force?: boolean,
 * }} args
 */
export async function resolveTrackingDriverEta(args) {
  const token = String(args.token || '').trim()
  const placeLabel = args.placeLabel || args.kind
  const emptyUnavailable = {
    active: true,
    kind: args.kind,
    placeLabel,
    status: 'unavailable',
    message: 'ETA currently unavailable — waiting for a fresh driver location',
    minutesLabel: null,
    clock: null,
    milesLabel: null,
    durationSeconds: null,
    distanceMeters: null,
    routeCoordinates: null,
    destination: null,
  }

  if (!args.gpsFresh) {
    const cache = { ...(args.cache || {}) }
    const coords = Array.isArray(cache.coordinates) && cache.coordinates.length >= 2 ? cache.coordinates : null
    return {
      ...emptyUnavailable,
      routeCoordinates: coords,
      destination: cache.dest || null,
      cache,
    }
  }

  if (!token || !args.destinationAddress?.trim()) {
    return {
      active: true,
      kind: args.kind,
      placeLabel,
      status: 'error',
      message: 'ETA temporarily unavailable',
      minutesLabel: null,
      clock: null,
      milesLabel: null,
      durationSeconds: null,
      distanceMeters: null,
      routeCoordinates: null,
      destination: null,
      cache: args.cache,
    }
  }

  const driver = {
    lng: Number(args.driver?.lng),
    lat: Number(args.driver?.lat),
  }
  if (!Number.isFinite(driver.lng) || !Number.isFinite(driver.lat)) {
    return { ...emptyUnavailable, cache: args.cache }
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
    // Prefer shared browser geocode cache when available; fall back to direct geocode for Node tests.
    try {
      const { geocodeAddressCached } = await import('./operationsMapGeocodeCache.js')
      cache.dest = await geocodeAddressCached(args.destinationAddress, token)
    } catch {
      cache.dest = await geocodeAddress(args.destinationAddress, token)
    }
  }
  if (!cache.dest) {
    return {
      active: true,
      kind: args.kind,
      placeLabel,
      status: 'error',
      message: 'ETA temporarily unavailable',
      minutesLabel: null,
      clock: null,
      milesLabel: null,
      durationSeconds: null,
      distanceMeters: null,
      routeCoordinates: null,
      destination: null,
      cache,
    }
  }

  const now = Date.now()
  const kindChanged = cache.kind != null && cache.kind !== args.kind
  const needsFetch =
    args.force ||
    kindChanged ||
    shouldRefreshTrackingEta(cache.from, driver, cache.fetchedAt, now)

  if (needsFetch) {
    const route = await fetchMapboxDrivingRoute(driver, cache.dest, token)
    if (!route) {
      // Keep previous good ETA/route if we have one and GPS is still fresh
      if (cache.durationSeconds != null && Number.isFinite(cache.durationSeconds)) {
        const timing = formatTrackingEtaTiming(cache.durationSeconds, now)
        return {
          active: true,
          kind: args.kind,
          placeLabel,
          status: 'ready',
          message: null,
          minutesLabel: timing.minutesLabel,
          clock: timing.clock,
          milesLabel: formatTrackingEtaMiles(cache.distanceMeters || 0),
          durationSeconds: cache.durationSeconds,
          distanceMeters: cache.distanceMeters,
          routeCoordinates: cache.coordinates || null,
          destination: cache.dest,
          cache,
        }
      }
      return {
        active: true,
        kind: args.kind,
        placeLabel,
        status: 'error',
        message: 'ETA temporarily unavailable',
        minutesLabel: null,
        clock: null,
        milesLabel: null,
        durationSeconds: null,
        distanceMeters: null,
        routeCoordinates: null,
        destination: cache.dest,
        cache,
      }
    }
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

  const timing = formatTrackingEtaTiming(cache.durationSeconds, now)
  return {
    active: true,
    kind: args.kind,
    placeLabel,
    status: 'ready',
    message: null,
    minutesLabel: timing.minutesLabel,
    clock: timing.clock,
    milesLabel: formatTrackingEtaMiles(cache.distanceMeters || 0),
    durationSeconds: cache.durationSeconds,
    distanceMeters: cache.distanceMeters,
    routeCoordinates: cache.coordinates || null,
    destination: cache.dest,
    cache,
  }
}
