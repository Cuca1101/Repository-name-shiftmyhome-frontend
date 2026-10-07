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
  cache,
})
if (stale.status !== 'unavailable') throw new Error('stale must be unavailable')
if (!/waiting for a fresh driver location/i.test(stale.message || '')) {
  throw new Error(`bad stale message: ${stale.message}`)
}

console.log('ok live tracking eta mapbox')
