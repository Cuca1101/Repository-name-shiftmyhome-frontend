/**
 * Customer track-page job stage (collection → delivery → done).
 * Journey-to-collection starts only when the driver presses Start Job (on_way).
 */
import { normalizeTrackingStatusKey } from './trackingDriverEta.js'

/**
 * @typedef {'awaiting_departure' | 'en_route_collection' | 'arrived_collection' | 'collected' | 'en_route_delivery' | 'arrived_delivery' | 'completed' | 'cancelled' | 'pending'} TrackingJobStage
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
 *   journeyActive: boolean,
 *   arrivedMessage: string | null,
 *   stageMessage: string | null,
 *   waitingMessage: string | null,
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
      journeyActive: false,
      arrivedMessage: null,
      stageMessage: null,
      waitingMessage: null,
    }
  }
  if (has(['completed'])) {
    return {
      stage: 'completed',
      badge: 'Completed',
      etaKind: null,
      placeLabel: null,
      showLiveEta: false,
      journeyActive: false,
      arrivedMessage: null,
      stageMessage: null,
      waitingMessage: null,
    }
  }
  if (has(['arrived_delivery', 'unloading'])) {
    return {
      stage: 'arrived_delivery',
      badge: 'Arrived at delivery',
      etaKind: null,
      placeLabel: 'delivery',
      showLiveEta: false,
      journeyActive: true,
      arrivedMessage: 'Your driver has arrived at delivery',
      stageMessage: null,
      waitingMessage: null,
    }
  }
  // Loaded / pickup done → items collected; next step is delivery.
  if (has(['pickup_completed', 'loaded'])) {
    return {
      stage: 'collected',
      badge: 'On the way to delivery',
      etaKind: 'delivery',
      placeLabel: 'delivery',
      showLiveEta: true,
      journeyActive: true,
      arrivedMessage: null,
      stageMessage: 'Job collected — next your driver will deliver',
      waitingMessage: null,
    }
  }
  if (has(['in_transit', 'in_progress', 'on_way_to_delivery'])) {
    return {
      stage: 'en_route_delivery',
      badge: 'On the way to delivery',
      etaKind: 'delivery',
      placeLabel: 'delivery',
      showLiveEta: true,
      journeyActive: true,
      arrivedMessage: null,
      stageMessage: 'Job collected — on the way to delivery',
      waitingMessage: null,
    }
  }
  if (has(['arrived', 'arrived_pickup', 'loading'])) {
    return {
      stage: 'arrived_collection',
      badge: 'Arrived at collection',
      etaKind: null,
      placeLabel: 'collection',
      showLiveEta: false,
      journeyActive: true,
      arrivedMessage: 'Your driver has arrived at collection',
      stageMessage: null,
      waitingMessage: null,
    }
  }
  // Start Job in the driver app sets on_way / started — only then is the journey live.
  if (has(['on_way', 'started', 'start', 'on_the_way', 'on_way_to_collection'])) {
    return {
      stage: 'en_route_collection',
      badge: 'On the way to collection',
      etaKind: 'collection',
      placeLabel: 'collection',
      showLiveEta: true,
      journeyActive: true,
      arrivedMessage: null,
      stageMessage: 'Your driver is on the way to collection',
      waitingMessage: null,
    }
  }
  // Assigned but Start Job not pressed yet.
  if (
    has([
      'assigned',
      'accepted',
      'confirmed',
      'booked',
      'paid',
      'deposit_paid',
      'driver_assigned',
      'active',
    ])
  ) {
    return {
      stage: 'awaiting_departure',
      badge: 'Driver assigned',
      etaKind: null,
      placeLabel: 'collection',
      showLiveEta: false,
      journeyActive: false,
      arrivedMessage: null,
      stageMessage: 'Your driver has not yet started the journey to collection.',
      waitingMessage: 'Waiting for driver to depart.',
    }
  }
  return {
    stage: 'pending',
    badge: 'Tracking',
    etaKind: null,
    placeLabel: 'collection',
    showLiveEta: false,
    journeyActive: false,
    arrivedMessage: null,
    stageMessage: null,
    waitingMessage: null,
  }
}

/**
 * Customer GPS / journey status labels for the blue status card.
 * Show real motion (Moving / Stopped) whenever GPS is fresh — even before Start Job.
 * ETA / “on the way” claims stay gated separately via journeyActive / showLiveEta.
 *
 * @param {{ state?: string } | null | undefined} motion
 * @param {boolean} gpsFresh
 * @param {{ journeyActive?: boolean }} [opts]
 */
export function resolveGpsStatusHeadline(motion, gpsFresh, opts = {}) {
  const state = String(motion?.state || '').toLowerCase()
  if (state === 'moving' && gpsFresh) return 'Moving'
  if (state === 'stationary' && gpsFresh) {
    return opts.journeyActive ? 'Stopped' : 'Waiting for driver to depart'
  }
  if (!opts.journeyActive) return 'Waiting for driver to depart'
  if (state === 'stale' || (!gpsFresh && state !== 'unavailable')) return 'GPS delayed'
  return 'GPS unavailable'
}
