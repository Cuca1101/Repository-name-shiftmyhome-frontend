/**
 * Customer track-page driving ETA (Mapbox Directions) from driver GPS → collection/delivery.
 * Always builds a road route from last-known driver coords when available.
 * Live ETA numbers are only shown when gpsFresh is true.
 */
import { haversineMetres } from './jobLocationAnalytics.js'
import { formatTimeUK } from './driverMotionStatus.js'

function formatDriveDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—'
  const totalMin = Math.max(1, Math.round(seconds / 60))
  if (totalMin < 60) return `${totalMin} min`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (m <= 0) return `${h} h`
  return `${h} h ${m} min`
}

function formatEtaDurationWords(seconds) {
  const totalMin = Math.max(1, Math.round((Number.isFinite(seconds) && seconds > 0 ? seconds : 0) / 60))
  if (totalMin < 60) return totalMin === 1 ? '1 minute' : `${totalMin} minutes`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  const hours = h === 1 ? '1 hour' : `${h} hours`
  if (m <= 0) return hours
  const minutes = m === 1 ? '1 minute' : `${m} minutes`
  return `${hours} ${minutes}`
}

/** Recalc Directions when driver moved at least this far. */
export const ETA_MOVE_THRESHOLD_M = 90

/** Max age of a cached Directions result while GPS stays fresh. Also the backoff after a failed route. */
export const ETA_MAX_AGE_MS = 60 * 1000

/** Customer copy when geocoding or Directions does not return a duration. */
export const ETA_UNAVAILABLE_MESSAGE = 'Arrival time temporarily unavailable'

/** How long the track page may stay on “Calculating…” before showing the unavailable state. */
export const ETA_CALCULATING_TIMEOUT_MS = 12 * 1000

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
  // Still at collection (not yet loaded) — no driving ETA to delivery yet.
  if (has(['arrived', 'arrived_pickup', 'loading'])) return null

  // Collected / loaded / in transit → route + ETA to delivery.
  if (has(['pickup_completed', 'loaded', 'in_transit', 'in_progress', 'on_way_to_delivery'])) {
    return { kind: 'delivery', placeLabel: 'delivery' }
  }
  // Only after Start Job (on_way / started) — never for assigned-only.
  if (has(['on_way', 'started', 'start', 'on_the_way', 'on_way_to_collection'])) {
    return { kind: 'collection', placeLabel: 'collection' }
  }
  return null
}

/** Fresh enough for live ETA (customer portal). Aligns with RPC live window. */
export const TRACKING_GPS_FRESH_MS = 5 * 60 * 1000

/**
 * Visible GPS age from the last position timestamp (not the page refresh clock).
 * @param {string | null | undefined} updatedAt
 * @param {number} [nowMs]
 * @returns {{ stale: boolean, clock: string | null, ago: string | null, text: string }}
 */
export function formatTrackingLocationLabel(updatedAt, nowMs = Date.now()) {
  const ms = updatedAt ? Date.parse(String(updatedAt)) : NaN
  if (!Number.isFinite(ms)) {
    return { stale: true, clock: null, ago: null, text: 'Last known location' }
  }
  const ageSec = Math.max(0, Math.round((nowMs - ms) / 1000))
  const clock = formatTimeUK(new Date(ms).toISOString())
  const unit = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
  let ago
  if (ageSec < 60) ago = `${unit(ageSec, 'second')} ago`
  else if (ageSec < 3600) ago = `${unit(Math.round(ageSec / 60), 'minute')} ago`
  else if (ageSec < 86400) ago = `${unit(Math.floor(ageSec / 3600), 'hour')} ago`
  else ago = `${unit(Math.floor(ageSec / 86400), 'day')} ago`
  const stale = nowMs - ms > TRACKING_GPS_FRESH_MS
  return {
    stale,
    clock,
    ago,
    text: stale
      ? `Last known location at ${clock} · ${ago}`
      : `Last updated at ${clock} · ${ago}`,
  }
}

/**
 * @param {{ lng?: number, lat?: number } | null | undefined} point
 * @returns {{ lng: number, lat: number } | null}
 */
function finiteLngLat(point) {
  const lng = Number(point?.lng)
  const lat = Number(point?.lat)
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
  if (Math.abs(lng) > 180 || Math.abs(lat) > 90) return null
  return { lng, lat }
}

/**
 * Whether driver GPS should be treated as live for ETA (not last-known-only).
 * @param {{
 *   trackingLive?: boolean,
 *   location?: { live?: boolean, available?: boolean, updated_at?: string | null, motion?: { state?: string } | null } | null,
 *   now?: number,
 * }} args
 */
export function isTrackingGpsFresh(args = {}) {
  return resolveTrackingGpsState(args) === 'fresh'
}

/**
 * GPS quality for the track page. Motion “Stopped” is still fresh GPS — it is not arrival.
 * @param {{
 *   trackingLive?: boolean,
 *   location?: { live?: boolean, available?: boolean, updated_at?: string | null, motion?: { state?: string } | null } | null,
 *   now?: number,
 * }} args
 * @returns {'fresh' | 'stale' | 'unavailable'}
 */
export function resolveTrackingGpsState(args = {}) {
  const loc = args.location
  if (!loc?.available) return 'unavailable'
  const state = String(loc.motion?.state || '').toLowerCase()
  if (state === 'unavailable') return 'unavailable'
  // Never treat last-known / missing GPS as live (Uber-style).
  if (state === 'stale') return 'stale'
  const updatedMs = loc.updated_at ? Date.parse(String(loc.updated_at)) : NaN
  const now = args.now ?? Date.now()
  const ageOk = Number.isFinite(updatedMs) && now - updatedMs <= TRACKING_GPS_FRESH_MS
  if (!ageOk) return 'stale'
  if (args.trackingLive && loc.live) return 'fresh'
  if (loc.live === true) return 'fresh'
  if (state === 'moving' || state === 'stationary') return 'fresh'
  return 'stale'
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
  const clock = formatTimeUK(new Date(arriveAtMs).toISOString())
  return {
    minutes,
    minutesLabel: formatDriveDuration(safe),
    clock,
    phrase: `Approximately ${formatEtaDurationWords(safe)} · Estimated arrival ${clock}`,
    arriveAtMs,
  }
}

/**
 * @param {number} distanceMeters
 */
export function formatTrackingEtaMiles(distanceMeters) {
  const meters = Number(distanceMeters)
  if (!Number.isFinite(meters) || meters <= 0) return '—'
  const miles = meters * 0.000621371
  if (miles < 0.1) return '<0.1'
  return (Math.round(miles * 10) / 10).toFixed(1).replace(/\.0$/, '')
}

/**
 * Collection vs delivery address for the current ETA leg.
 * @param {'collection' | 'delivery' | null | undefined} kind
 * @param {string | null | undefined} pickup
 * @param {string | null | undefined} delivery
 */
export function trackingEtaAddress(kind, pickup, delivery) {
  const raw = kind === 'delivery' ? delivery : pickup
  return String(raw || '').trim()
}

/**
 * A fresh Directions result can be shown. A few metres still counts — rounding that to “—”
 * used to leave the page on “Calculating…” after a successful route.
 * @param {{ status?: string, phrase?: string | null, clock?: string | null, minutesLabel?: string | null } | null | undefined} view
 * @param {boolean} gpsFresh
 */
export function isTrackingEtaDisplayReady(view, gpsFresh) {
  if (!gpsFresh || !view || view.status !== 'ready') return false
  if (!view.phrase || !view.clock) return false
  if (!view.minutesLabel || view.minutesLabel === '—') return false
  return true
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
 *   gpsState?: 'fresh' | 'stale' | 'unavailable',
 *   gpsUpdatedAt?: string | null,
 *   destinationPoint?: { lng: number, lat: number } | null,
 *   cache: Record<string, unknown>,
 *   force?: boolean,
 * }} args
 */
export async function resolveTrackingDriverEta(args) {
  const token = String(args.token || '').trim()
  const placeLabel = args.placeLabel || args.kind
  const gpsState = args.gpsState || (args.gpsFresh ? 'fresh' : 'stale')
  const gpsFresh = gpsState === 'fresh'

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
      message: ETA_UNAVAILABLE_MESSAGE,
      minutesLabel: null,
      clock: null,
      phrase: null,
      milesLabel: null,
      durationSeconds: null,
      distanceMeters: null,
      updatedAt: null,
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
      message: gpsState === 'unavailable' ? 'GPS unavailable' : 'GPS delayed',
      minutesLabel: null,
      clock: null,
      phrase: null,
      milesLabel: null,
      durationSeconds: null,
      distanceMeters: null,
      updatedAt: args.gpsUpdatedAt || null,
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
      failedAt: null,
    }
  }

  const { geocodeAddress } = await import('./mapboxRouteApi.js')
  const { fetchMapboxDrivingRoute } = await import('./operationsMapDirections.js')

  const givenDest = finiteLngLat(args.destinationPoint)
  if (givenDest) cache.dest = givenDest
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
      message: ETA_UNAVAILABLE_MESSAGE,
      minutesLabel: null,
      clock: null,
      phrase: null,
      milesLabel: null,
      durationSeconds: null,
      distanceMeters: null,
      updatedAt: null,
      cache,
    }
  }

  const now = Date.now()
  const kindChanged = cache.kind != null && cache.kind !== args.kind
  const hasRoute = Array.isArray(cache.coordinates) && cache.coordinates.length >= 2
  const failAgeOk = !cache.failedAt || now - Number(cache.failedAt) >= ETA_MAX_AGE_MS

  // Stale GPS: still build a last-known road route once, but do not keep re-hitting Directions.
  // Fresh GPS: throttle by movement / age. Failures wait out the same window unless forced.
  const needsFetch =
    args.force ||
    kindChanged ||
    (!hasRoute && failAgeOk) ||
    (gpsFresh && hasRoute && shouldRefreshTrackingEta(cache.from, driver, cache.fetchedAt, now))

  if (needsFetch) {
    const route = await fetchMapboxDrivingRoute(driver, cache.dest, token, {
      profile: 'driving-traffic',
      timeoutMs: 8000,
    })
    if (route?.coordinates?.length >= 2 && Number.isFinite(route.durationSeconds)) {
      cache = {
        ...cache,
        from: { ...driver },
        fetchedAt: now,
        failedAt: null,
        durationSeconds: route.durationSeconds,
        distanceMeters: route.distanceMeters,
        coordinates: route.coordinates,
        kind: args.kind,
      }
    } else {
      cache = {
        ...cache,
        failedAt: now,
        kind: args.kind,
      }
    }
  }

  const routeCoordinates =
    Array.isArray(cache.coordinates) && cache.coordinates.length >= 2 ? cache.coordinates : null

  const hasDuration = cache.durationSeconds != null && Number.isFinite(cache.durationSeconds)
  const updatedAt =
    args.gpsUpdatedAt
    || (cache.fetchedAt ? new Date(cache.fetchedAt).toISOString() : null)

  // A route from old GPS is an old estimate, not a live arrival time.
  if (!gpsFresh) {
    if (!hasDuration) {
      return {
        ...base,
        status: 'unavailable',
        message: gpsState === 'unavailable' ? 'GPS unavailable' : 'GPS delayed',
        minutesLabel: null,
        clock: null,
        phrase: null,
        milesLabel: null,
        durationSeconds: null,
        distanceMeters: null,
        updatedAt,
        routeCoordinates,
        destination: cache.dest,
        cache,
      }
    }
    const timing = formatTrackingEtaTiming(cache.durationSeconds, cache.fetchedAt || now)
    return {
      ...base,
      status: 'stale',
      message: 'GPS delayed',
      minutesLabel: timing.minutesLabel,
      clock: timing.clock,
      phrase: timing.phrase,
      milesLabel: formatTrackingEtaMiles(cache.distanceMeters || 0),
      durationSeconds: cache.durationSeconds,
      distanceMeters: cache.distanceMeters,
      updatedAt,
      routeCoordinates,
      destination: cache.dest,
      cache,
    }
  }

  if (!hasDuration) {
    return {
      ...base,
      status: 'error',
      message: ETA_UNAVAILABLE_MESSAGE,
      minutesLabel: null,
      clock: null,
      phrase: null,
      milesLabel: null,
      durationSeconds: null,
      distanceMeters: null,
      updatedAt: null,
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
    phrase: timing.phrase,
    milesLabel: formatTrackingEtaMiles(cache.distanceMeters || 0),
    durationSeconds: cache.durationSeconds,
    distanceMeters: cache.distanceMeters,
    updatedAt,
    routeCoordinates,
    destination: cache.dest,
    cache,
  }
}

/**
 * Driving route between collection and delivery, independent of the driver ETA leg.
 * @param {{ token: string, pickupAddress: string, deliveryAddress: string }} args
 */
export async function resolveJobRoadRoute(args) {
  const token = String(args.token || '').trim()
  const pickup = String(args.pickupAddress || '').trim()
  const delivery = String(args.deliveryAddress || '').trim()
  const failed = (message, collection = null, dropoff = null) => ({
    status: 'error',
    message,
    collection,
    delivery: dropoff,
    coordinates: null,
  })
  if (!token || !pickup || !delivery) {
    return failed('Route could not be loaded. Try again.')
  }
  try {
    const { geocodeAddress } = await import('./mapboxRouteApi.js')
    const { fetchMapboxDrivingRoute } = await import('./operationsMapDirections.js')
    const geo = async (address) => finiteLngLat(await geocodeAddress(address, token))
    const [collection, dropoff] = await Promise.all([geo(pickup), geo(delivery)])
    if (!collection || !dropoff) return failed('Route could not be loaded. Try again.', collection, dropoff)
    const route = await fetchMapboxDrivingRoute(collection, dropoff, token, {
      profile: 'driving',
      timeoutMs: 8000,
    })
    if (!route?.coordinates || route.coordinates.length < 2) {
      return failed('Route could not be loaded. Try again.', collection, dropoff)
    }
    return {
      status: 'ready',
      message: null,
      collection,
      delivery: dropoff,
      coordinates: route.coordinates,
    }
  } catch (err) {
    const timedOut = /timeout|aborted/i.test(String(err?.message || err || ''))
    return failed(timedOut ? 'Route took too long to load. Try again.' : 'Route could not be loaded. Try again.')
  }
}
