/**
 * Customer tracking badge must not become Loading when GPS stops.
 * Run: node scripts/test-tracking-stage-gps.mjs
 */
import {
  resolveCustomerTrackingStage,
  resolveGpsStatusHeadline,
} from '../src/lib/trackingJobStage.js'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const enRoute = resolveCustomerTrackingStage({
  status_raw: 'on_way',
  operational_status: 'Loading',
  location: { available: false, live: false, motion: { state: 'unavailable' } },
})
assert(enRoute.badge === 'Left for collection', `stale display label changed the badge to ${enRoute.badge}`)
assert(enRoute.stage === 'en_route_collection', `stage became ${enRoute.stage}`)

const realLoading = resolveCustomerTrackingStage({
  status_raw: 'loading_started',
  operational_status: 'Loading',
})
assert(realLoading.badge === 'Loading', `real loading stage is ${realLoading.badge}`)

const arrived = resolveCustomerTrackingStage({
  status_raw: 'arrived_pickup',
  operational_status: 'At collection',
})
assert(arrived.badge === 'At collection', `arrival badge is ${arrived.badge}`)
assert(arrived.badge !== 'Loading', 'arrival was labelled Loading')

const delivery = resolveCustomerTrackingStage({
  status_raw: 'arrived_delivery',
  operational_status: 'At delivery',
})
assert(delivery.badge === 'At delivery', `delivery badge is ${delivery.badge}`)

const cancelled = resolveCustomerTrackingStage({
  status_raw: 'arrived_pickup',
  operational_status: 'Cancelled',
  cancelled: true,
  assignment_status: 'cancelled',
})
assert(cancelled.badge === 'Cancelled', `cancelled booking badge is ${cancelled.badge}`)
assert(cancelled.stage === 'cancelled', `cancelled booking stage is ${cancelled.stage}`)

const finished = resolveCustomerTrackingStage({
  status_raw: 'on_way',
  operational_status: 'Completed',
  completed_at: '2026-10-21T12:00:00Z',
})
assert(finished.badge === 'Completed', `completed booking badge is ${finished.badge}`)

const staleHeadline = resolveGpsStatusHeadline({ state: 'stale' }, false, { journeyActive: true })
assert(staleHeadline === 'GPS delayed', `stale GPS headline is ${staleHeadline}`)
assert(!/loading/i.test(staleHeadline), 'GPS headline says Loading')

const missingHeadline = resolveGpsStatusHeadline({ state: 'unavailable' }, false, { journeyActive: true })
assert(missingHeadline === 'GPS unavailable', `missing GPS headline is ${missingHeadline}`)

const stopped = resolveGpsStatusHeadline({ state: 'stationary' }, true, { journeyActive: true })
assert(stopped === 'Stopped', `fresh stop headline is ${stopped}`)

console.log('tracking stage GPS checks passed')
