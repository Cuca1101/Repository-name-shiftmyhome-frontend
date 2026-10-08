/**
 * Customer track-page job stage (collection → delivery → done).
 */
import { normalizeTrackingStatusKey } from './trackingDriverEta.js'

/**
 * @typedef {'en_route_collection' | 'arrived_collection' | 'en_route_delivery' | 'arrived_delivery' | 'completed' | 'cancelled' | 'pending'} TrackingJobStage
 */

/**
 * @param {string | null | undefined} operationalStatus
 * @param {string | null | undefined} statusRaw
 * @returns {{
 *   stage: TrackingJobStage,
 *   badge: string,
 *   etaKind: 'collection' | 'delivery' | null,
 *   placeLabel: string | null,
 *   showLiveEta: boolean,
 *   arrivedMessage: string | null,
 * }}
 */
export function resolveTrackingJobStage(operationalStatus, statusRaw) {
  const keys = [operationalStatus, statusRaw].map(normalizeTrackingStatusKey).filter(Boolean)
  const has = (list) => keys.some((s) => list.includes(s))

  if (has(['cancelled'])) {
    return {
      stage: 'cancelled',
      badge: 'Cancelled',
      etaKind: null,
      placeLabel: null,
      showLiveEta: false,
      arrivedMessage: null,
    }
  }
  if (has(['completed'])) {
    return {
      stage: 'completed',
      badge: 'Completed',
      etaKind: null,
      placeLabel: null,
      showLiveEta: false,
      arrivedMessage: null,
    }
  }
  if (has(['arrived_delivery', 'unloading'])) {
    return {
      stage: 'arrived_delivery',
      badge: 'Arrived at delivery',
      etaKind: null,
      placeLabel: 'delivery',
      showLiveEta: false,
      arrivedMessage: 'Driver arrived at delivery',
    }
  }
  if (has(['pickup_completed', 'in_transit', 'in_progress', 'on_way_to_delivery'])) {
    return {
      stage: 'en_route_delivery',
      badge: 'On the way to delivery',
      etaKind: 'delivery',
      placeLabel: 'delivery',
      showLiveEta: true,
      arrivedMessage: null,
    }
  }
  if (has(['arrived', 'arrived_pickup', 'loading', 'loaded'])) {
    return {
      stage: 'arrived_collection',
      badge: 'Arrived at collection',
      etaKind: null,
      placeLabel: 'collection',
      showLiveEta: false,
      arrivedMessage: 'Driver arrived at collection',
    }
  }
  if (has(['on_way', 'started', 'start', 'on_the_way', 'on_way_to_collection'])) {
    return {
      stage: 'en_route_collection',
      badge: 'On the way to collection',
      etaKind: 'collection',
      placeLabel: 'collection',
      showLiveEta: true,
      arrivedMessage: null,
    }
  }
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
    return {
      stage: 'en_route_collection',
      badge: 'On the way to collection',
      etaKind: 'collection',
      placeLabel: 'collection',
      showLiveEta: true,
      arrivedMessage: null,
    }
  }
  return {
    stage: 'pending',
    badge: 'Tracking',
    etaKind: null,
    placeLabel: null,
    showLiveEta: false,
    arrivedMessage: null,
  }
}

/**
 * Customer GPS status labels for the blue status card.
 * @param {{ state?: string } | null | undefined} motion
 * @param {boolean} gpsFresh
 */
export function resolveGpsStatusHeadline(motion, gpsFresh) {
  const state = String(motion?.state || '').toLowerCase()
  if (state === 'moving' && gpsFresh) return 'Moving'
  if (state === 'stationary' && gpsFresh) return 'Stopped'
  if (state === 'stale' || (!gpsFresh && state !== 'unavailable')) return 'GPS delayed'
  return 'GPS unavailable'
}
