/**
 * Customer track-page job stage (collection → delivery → done).
 * Journey-to-collection starts only when the driver presses Start Job (on_way).
 */
import { normalizeTrackingStatusKey } from './trackingDriverEta.js'

/**
 * @typedef {'awaiting_departure' | 'en_route_collection' | 'arrived_collection' | 'collected' | 'en_route_delivery' | 'arrived_delivery' | 'completed' | 'cancelled' | 'pending'} TrackingJobStage
 */

function statusKey(raw) {
  return String(raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
}

/**
 * A finished job stays Completed even when an older journey status is still stored beside it.
 * Pickup completed is a journey step, not a finished move.
 * @param {Record<string, unknown> | null | undefined} tracking
 */
export function resolveCustomerTrackingStage(tracking) {
  const completed = Boolean(
    tracking?.completed
    || tracking?.completed_at
    || statusKey(tracking?.operational_status) === 'completed'
    || statusKey(tracking?.status_raw) === 'completed'
    || statusKey(tracking?.assignment_status) === 'completed',
  )
  if (completed) {
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
  // Admin cancellation sets operational_status / cancelled_at and may leave the
  // last journey key in quotes.status. That cancellation has to win over
  // on_way or arrived_pickup. A display label such as "Loading" must not.
  const cancelled = Boolean(
    tracking?.cancelled
    || tracking?.cancelled_at
    || statusKey(tracking?.operational_status) === 'cancelled'
    || statusKey(tracking?.status_raw) === 'cancelled'
    || statusKey(tracking?.assignment_status) === 'cancelled',
  )
  if (cancelled) {
    return resolveTrackingJobStage('cancelled', null)
  }
  // quotes.status is the workflow key. operational_status is often the display
  // label ("Loading", "Left for collection"). Passing both made a stale
  // "Loading" label win over "on_way", because loading is checked first.
  // GPS age is not an input. A missing or stale fix must not change this badge.
  const loadClock = new Set(['loading', 'loading_started', 'unloading', 'unloading_started', 'unloading_completed'])
  let machine = statusKey(tracking?.status_raw)
  if (loadClock.has(machine)) machine = ''
  const assignment = statusKey(tracking?.assignment_status)
  if (!machine && assignment && !loadClock.has(assignment)) {
    return resolveTrackingJobStage(assignment, null)
  }
  const display = statusKey(tracking?.operational_status)
  if (loadClock.has(display)) {
    return resolveTrackingJobStage(machine || assignment || 'assigned', null)
  }
  if (machine) {
    return resolveTrackingJobStage(machine, null)
  }
  return resolveTrackingJobStage(display, null)
}

/**
 * Banner for the customer tracking page. Uses the same stage as admin Job Details.
 * GPS motion is not an input. Loading rows do not count as arrival.
 *
 * @param {ReturnType<import('./jobDispatchTimeline.js').buildAdminLiveStage>} stage
 * @param {Record<string, unknown> | null | undefined} [tracking]
 */
export function customerTrackingFromLiveStage(stage, tracking) {
  const cancelled = Boolean(
    tracking?.cancelled
    || tracking?.cancelled_at
    || statusKey(tracking?.operational_status) === 'cancelled'
    || statusKey(tracking?.status_raw) === 'cancelled'
    || statusKey(tracking?.assignment_status) === 'cancelled',
  )
  if (cancelled) return resolveTrackingJobStage('cancelled', null)

  const completed = Boolean(
    tracking?.completed
    || tracking?.completed_at
    || stage?.delivery?.complete?.at
    || statusKey(tracking?.operational_status) === 'completed'
    || statusKey(tracking?.status_raw) === 'completed'
    || statusKey(tracking?.assignment_status) === 'completed',
  )
  if (completed) {
    return {
      stage: 'completed',
      badge: 'Completed',
      etaKind: null,
      placeLabel: null,
      showLiveEta: false,
      journeyActive: false,
      arrivedMessage: null,
      stageMessage: 'Your move is complete',
      waitingMessage: null,
    }
  }
  if (stage?.delivery?.arrived?.at) {
    return resolveTrackingJobStage('arrived_delivery', null)
  }
  if (stage?.delivery?.start?.at) {
    return resolveTrackingJobStage('in_transit', null)
  }
  if (stage?.collection?.complete?.at) {
    return resolveTrackingJobStage('pickup_completed', null)
  }
  if (stage?.collection?.arrived?.at) {
    return resolveTrackingJobStage('arrived_pickup', null)
  }
  if (stage?.collection?.start?.at) {
    return resolveTrackingJobStage('on_way', null)
  }
  return resolveTrackingJobStage('assigned', null)
}

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
  if (has(['arrived_delivery', 'at_delivery'])) {
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
  if (has(['in_transit', 'on_way_to_delivery', 'left_for_delivery'])) {
    return {
      stage: 'en_route_delivery',
      badge: 'Left for delivery',
      etaKind: 'delivery',
      placeLabel: 'delivery',
      showLiveEta: true,
      journeyActive: true,
      arrivedMessage: null,
      stageMessage: 'Your driver is on the way to delivery',
      waitingMessage: null,
    }
  }
  if (has(['pickup_completed', 'loaded', 'collection_finished', 'items_collected'])) {
    return {
      stage: 'collected',
      badge: 'Collection complete',
      etaKind: null,
      placeLabel: null,
      showLiveEta: false,
      journeyActive: true,
      arrivedMessage: null,
      stageMessage: 'Collection is complete',
      waitingMessage: null,
    }
  }
  if (has(['arrived', 'arrived_pickup', 'at_collection'])) {
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
  if (has(['on_way', 'started', 'start', 'on_the_way', 'on_way_to_collection', 'left_for_collection'])) {
    return {
      stage: 'en_route_collection',
      badge: 'Left for collection',
      etaKind: 'collection',
      placeLabel: 'collection',
      showLiveEta: true,
      journeyActive: true,
      arrivedMessage: null,
      stageMessage: 'Your driver is on the way to collection',
      waitingMessage: null,
    }
  }
  // Loading and unloading are item clocks. They are not a customer stage.
  if (has(['loading', 'loading_started', 'unloading', 'unloading_started', 'unloading_completed'])) {
    return {
      stage: 'awaiting_departure',
      badge: 'Driver assigned',
      etaKind: null,
      placeLabel: 'collection',
      showLiveEta: false,
      journeyActive: false,
      arrivedMessage: null,
      stageMessage: 'Driver assigned — waiting to start',
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
      stageMessage: 'Driver assigned — waiting to start',
      waitingMessage: null,
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
 * This line is never “Loading” or an arrival stage. Those come only from the job status.
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
