/**
 * Live Mapbox Directions smoke test for tracking ETA.
 * Usage: node --env-file=.env scripts/test-tracking-eta-live.mjs
 * or set VITE_MAPBOX_TOKEN.
 */
import {
  formatTrackingEtaTiming,
  formatTrackingEtaMiles,
  resolveTrackingDriverEta,
  shouldRefreshTrackingEta,
} from '../src/lib/trackingDriverEta.js'

const token = String(process.env.VITE_MAPBOX_TOKEN || '').trim()
if (!token) {
  console.error('VITE_MAPBOX_TOKEN required')
  process.exit(1)
}

// Driver ~4+ miles from a Glasgow collection area
const driverFar = { lng: -4.32, lat: 55.86 }
const pickupAddress = 'George Square, Glasgow, G2 1DU'

let cache = {}
const r1 = await resolveTrackingDriverEta({
  token,
  driver: driverFar,
  destinationAddress: pickupAddress,
  kind: 'collection',
  placeLabel: 'collection',
  gpsFresh: true,
  cache,
})
cache = r1.cache
console.log('far', {
  status: r1.status,
  minutesLabel: r1.minutesLabel,
  clock: r1.clock,
  milesLabel: r1.milesLabel,
  durationSeconds: r1.durationSeconds,
})
if (r1.status !== 'ready') throw new Error('expected ready ETA')
if (!(r1.durationSeconds > 300)) throw new Error('expected multi-minute drive')
if (!(Number(r1.milesLabel) >= 2)) throw new Error(`expected miles >=2, got ${r1.milesLabel}`)
const coords = r1.routeCoordinates
if (!Array.isArray(coords) || coords.length < 8) {
  throw new Error(`expected multi-point road polyline, got ${coords?.length}`)
}
// Not a straight line: a mid vertex should diverge from the chord driver→dest
const a = coords[0]
const b = coords[coords.length - 1]
const mid = coords[Math.floor(coords.length / 2)]
const chordLat = a[1] + (b[1] - a[1]) * 0.5
const chordLng = a[0] + (b[0] - a[0]) * 0.5
const midDrift =
  Math.hypot(Number(mid[0]) - chordLng, Number(mid[1]) - chordLat) * 111111
console.log('route points', coords.length, 'midDriftM~', Math.round(midDrift))
if (midDrift < 40) {
  throw new Error('route looks like a straight line (midpoint too close to chord)')
}
if (!r1.destination?.lng) throw new Error('missing destination coords')

const timing = formatTrackingEtaTiming(r1.durationSeconds)
console.log('timing', timing)
console.log('miles', formatTrackingEtaMiles(r1.distanceMeters))

// Barely moved — should not need refresh
const driverNearSame = {
  lng: driverFar.lng + 0.0001,
  lat: driverFar.lat + 0.0001,
}
if (shouldRefreshTrackingEta(cache.from, driverNearSame, cache.fetchedAt, Date.now())) {
  throw new Error('tiny move should not refresh')
}

const r2 = await resolveTrackingDriverEta({
  token,
  driver: driverNearSame,
  destinationAddress: pickupAddress,
  kind: 'collection',
  placeLabel: 'collection',
  gpsFresh: true,
  cache,
})
cache = r2.cache
if (r2.durationSeconds !== r1.durationSeconds) {
  throw new Error('cached duration should reuse without Directions hit')
}

// Meaningful move closer
const driverCloser = { lng: -4.27, lat: 55.86 }
const r3 = await resolveTrackingDriverEta({
  token,
  driver: driverCloser,
  destinationAddress: pickupAddress,
  kind: 'collection',
  placeLabel: 'collection',
  gpsFresh: true,
  cache,
  force: true,
})
cache = r3.cache
console.log('closer', {
  status: r3.status,
  minutesLabel: r3.minutesLabel,
  milesLabel: r3.milesLabel,
  durationSeconds: r3.durationSeconds,
})
if (!(r3.durationSeconds < r1.durationSeconds)) {
  throw new Error('closer driver should have shorter ETA')
}

const stale = await resolveTrackingDriverEta({
  token,
  driver: driverCloser,
  destinationAddress: pickupAddress,
  kind: 'collection',
  placeLabel: 'collection',
  gpsFresh: false,
  cache: {},
})
if (stale.status !== 'stale') throw new Error(`stale estimate status ${stale.status}`)
if (stale.message !== 'GPS delayed') throw new Error(`bad stale message: ${stale.message}`)
if (!Array.isArray(stale.routeCoordinates) || stale.routeCoordinates.length < 8) {
  throw new Error('stale cold-load must still return a road route')
}
if (!stale.destination?.lng) throw new Error('stale cold-load must still return destination')
if (!stale.phrase || !/Approximately/.test(stale.phrase)) {
  throw new Error(`stale estimate must keep the last duration: ${stale.phrase}`)
}
if (!stale.updatedAt) throw new Error('stale estimate must record when it was updated')

console.log('ok live tracking eta mapbox')
