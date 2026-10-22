import { mergedAdminWorkflowForQuote } from './quoteAdminWorkflowMerge'
import { quoteIsCancelled, quoteIsCompleted } from './adminWorkflowFilters'
import { quoteJobIsStarted } from './adminJobAcceptedStatus'
import { formatTimeUK } from './formatDateDisplay'

const SKIP_STATUSES = new Set([
  'gps',
  'location',
  'available_location',
  'active_job_location',
  'correction',
  'customer_not_available',
  'unable_to_contact',
])

const COLLECTION_START = new Set(['on_way', 'started', 'start', 'in_progress', 'on_the_way', 'left_for_collection'])
const COLLECTION_ARRIVED = new Set(['arrived_pickup', 'at_collection'])
const COLLECTION_COMPLETE = new Set(['pickup_completed', 'loaded', 'collection_finished', 'items_collected'])
const DELIVERY_START = new Set(['in_transit', 'left_for_delivery', 'on_way_to_delivery'])
const DELIVERY_ARRIVED = new Set(['arrived_delivery', 'at_delivery'])
const DELIVERY_COMPLETE = new Set(['completed', 'complete', 'delivered'])

/**
 * @param {string | null | undefined} raw
 */
function normStatus(raw) {
  return String(raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
}

/**
 * @param {Record<string, unknown>} row
 */
function eventAt(row) {
  return String(row?.occurred_at || row?.created_at || '').trim()
}

/**
 * @param {Array<Record<string, unknown>>} rows
 */
function earliestRow(rows) {
  if (!rows.length) return null
  return [...rows].sort(
    (a, b) => new Date(eventAt(a) || 0).getTime() - new Date(eventAt(b) || 0).getTime(),
  )[0]
}

function arrivalStamp(rows) {
  const row = earliestRow(rows)
  return row ? eventAt(row) : ''
}

/** @param {Record<string, unknown> | null | undefined} row */
function arrivalMethod(row) {
  return normStatus(row?.source) === 'gps' ? 'Automatic (GPS)' : 'Manual'
}

/**
 * @param {'collection' | 'delivery'} place
 * @param {Record<string, unknown> | null | undefined} row
 * @param {string} at
 */
function arrivalPhrase(place, row, at) {
  const clock = formatTimeUK(at)
  const method = arrivalMethod(row)
  return clock
    ? `Arrived at ${place} · ${method} · ${clock}`
    : `Arrived at ${place} · ${method}`
}

/** @param {string} label @param {string} at */
function stageClockPhrase(label, at) {
  const clock = formatTimeUK(at)
  return clock ? `${label} · ${clock}` : label
}

const CONFIRMED_JOURNEY_LABELS = new Set([
  'Left for collection',
  'Arrived at collection',
  'Arrived at collection · Loading',
  'Collection complete',
  'Collection finished',
  'Left for delivery',
  'Arrived at delivery',
  'Arrived at delivery · Unloading',
  'Loading',
  'Unloading',
  'Completed',
  'At collection',
  'At delivery',
])

/**
 * The stored operational status is the confirmed stage. Older rows used a
 * shorter label for the same stage.
 * @param {unknown} raw
 */
export function confirmedJourneyLabel(raw) {
  const text = String(raw || '').trim()
  if (!CONFIRMED_JOURNEY_LABELS.has(text)) return ''
  if (text === 'At collection') return 'Arrived at collection'
  if (text === 'At delivery') return 'Arrived at delivery'
  if (text === 'Collection finished') return 'Collection complete'
  if (text === 'Loading') return 'Arrived at collection · Loading'
  if (text === 'Unloading') return 'Arrived at delivery · Unloading'
  return text
}

const LIVE_LABELS = {
  accepted: 'Accepted',
  'collection-start': 'Left for collection',
  'collection-arrived': 'Arrived at collection',
  'collection-complete': 'Collection complete',
  'delivery-start': 'Left for delivery',
  'delivery-arrived': 'Arrived at delivery',
  'delivery-complete': 'Completed',
}

/**
 * Admin Job Details live stage.
 * Accepted is the admin assignment. Collection and delivery Start, Arrived and
 * Complete are the driver app events already stored on the booking.
 * Arrived uses the first saved arrival after Start, manual or GPS.
 * Time on site runs from that arrival until Complete at the same address.
 *
 * @param {Record<string, unknown> | null | undefined} quote
 * @param {Array<Record<string, unknown>>} [historyRows]
 * @param {Record<string, unknown> | null} [job]
 * @param {{ status?: string, completed_at?: string } | null} [assignment]
 */
export function buildAdminLiveStage(quote, historyRows = [], job = null, assignment = null) {
  const q = quote || {}
  const completed = quoteIsCompleted(q, job, assignment)
  const cancelled = quoteIsCancelled(q, job)
  const sorted = [...(historyRows || [])]
    .filter((row) => row && !row.corrects_event_id)
    .sort((a, b) => new Date(eventAt(a) || 0).getTime() - new Date(eventAt(b) || 0).getTime())

  let collectionStart = ''
  let collectionComplete = ''
  let collectionLoading = ''
  let deliveryStart = ''
  let deliveryComplete = ''
  let deliveryUnloading = ''
  let deliveryPhase = false
  let firstCollectionArrival = ''
  let firstDeliveryArrival = ''
  /** @type {Array<Record<string, unknown>>} */
  const collectionArrivals = []
  /** @type {Array<Record<string, unknown>>} */
  const deliveryArrivals = []

  for (const row of sorted) {
    const status = normStatus(row.status)
    if (!status || SKIP_STATUSES.has(status)) continue
    const at = eventAt(row)
    if (!at) continue
    const stop = normStatus(row.stop_type)
    const deliveryStop = stop === 'delivery' || stop === 'dropoff'

    if (!deliveryPhase && COLLECTION_START.has(status) && !collectionStart) collectionStart = at

    if (COLLECTION_ARRIVED.has(status) || (status === 'arrived' && !deliveryPhase && !deliveryStop)) {
      if (collectionStart && at >= collectionStart) {
        collectionArrivals.push(row)
        if (!firstCollectionArrival) firstCollectionArrival = at
      }
    } else if (DELIVERY_ARRIVED.has(status) || (status === 'arrived' && (deliveryPhase || deliveryStop))) {
      if (deliveryStart && at >= deliveryStart) {
        deliveryArrivals.push(row)
        if (!firstDeliveryArrival) firstDeliveryArrival = at
        deliveryPhase = true
      }
    }

    if (
      (status === 'loading' || status === 'loading_started')
      && firstCollectionArrival
      && at >= firstCollectionArrival
      && !collectionLoading
    ) {
      collectionLoading = at
    }
    if (
      (status === 'unloading' || status === 'unloading_started')
      && firstDeliveryArrival
      && at >= firstDeliveryArrival
      && !deliveryUnloading
    ) {
      deliveryUnloading = at
    }

    if (COLLECTION_COMPLETE.has(status) && firstCollectionArrival && at >= firstCollectionArrival && !collectionComplete) {
      collectionComplete = at
      deliveryPhase = true
    }
    if (DELIVERY_START.has(status) && !deliveryStart) {
      deliveryStart = at
      deliveryPhase = true
    }
    if ((status === 'unloading' || status === 'unloading_started' || status === 'unloading_completed') && !deliveryPhase) {
      deliveryPhase = true
    }
    if (DELIVERY_COMPLETE.has(status) && !deliveryComplete) {
      deliveryComplete = at
      deliveryPhase = true
    }
  }

  if (!deliveryComplete && completed) {
    deliveryComplete = String(q.completed_at || assignment?.completed_at || '').trim()
  }

  const collectionArrival = earliestRow(collectionArrivals)
  const deliveryArrival = earliestRow(deliveryArrivals)
  const collectionArrived = collectionArrival ? eventAt(collectionArrival) : ''
  const deliveryArrived = deliveryArrival ? eventAt(deliveryArrival) : ''
  const acceptedAt = String(q.assigned_at || '').trim()
  const terminal = completed || cancelled || Boolean(deliveryComplete)

  const collectionTimer = {
    startedAt: collectionArrived,
    endedAt: collectionArrived && collectionComplete ? collectionComplete : '',
    running: Boolean(
      collectionArrived
      && !collectionComplete
      && !deliveryStart
      && !deliveryArrived
      && !deliveryComplete
      && !completed
      && !cancelled,
    ),
  }
  const deliveryTimer = {
    startedAt: deliveryArrived,
    endedAt: deliveryArrived && deliveryComplete ? deliveryComplete : '',
    running: Boolean(deliveryArrived && !deliveryComplete && !completed && !cancelled),
  }

  const ordered = [
    { id: 'accepted', label: 'Accepted', at: acceptedAt },
    { id: 'collection-start', label: 'Start', at: collectionStart },
    { id: 'collection-arrived', label: collectionArrival ? `Arrived · ${arrivalMethod(collectionArrival)}` : 'Arrived', at: collectionArrived },
    { id: 'collection-complete', label: 'Complete', at: collectionComplete },
    { id: 'delivery-start', label: 'Start', at: deliveryStart },
    { id: 'delivery-arrived', label: deliveryArrival ? `Arrived · ${arrivalMethod(deliveryArrival)}` : 'Arrived', at: deliveryArrived },
    { id: 'delivery-complete', label: 'Complete', at: deliveryComplete },
  ]

  let activeId = ''
  if (!terminal) {
    for (const row of ordered) {
      if (row.at) activeId = row.id
    }
  }

  const events = ordered.map((row) => ({
    ...row,
    state: !row.at ? 'upcoming' : !terminal && row.id === activeId ? 'current' : 'done',
  }))

  const byId = Object.fromEntries(events.map((row) => [row.id, row]))
  let currentLabel = cancelled
    ? 'Cancelled'
    : terminal
      ? 'Completed'
      : (LIVE_LABELS[activeId] || 'Not started')
  if (!cancelled && !terminal && activeId === 'collection-start' && collectionStart) {
    currentLabel = stageClockPhrase('Left for collection', collectionStart)
  }
  if (!cancelled && !terminal && activeId === 'delivery-start' && deliveryStart) {
    currentLabel = stageClockPhrase('Left for delivery', deliveryStart)
  }
  if (!cancelled && !terminal && activeId === 'collection-arrived' && collectionArrival) {
    currentLabel = arrivalPhrase('collection', collectionArrival, collectionArrived)
  }
  if (!cancelled && !terminal && activeId === 'delivery-arrived' && deliveryArrival) {
    currentLabel = arrivalPhrase('delivery', deliveryArrival, deliveryArrived)
  }

  return {
    currentLabel,
    accepted: byId.accepted,
    collection: {
      start: byId['collection-start'],
      arrived: byId['collection-arrived'],
      loadingAt: collectionLoading,
      complete: byId['collection-complete'],
      timer: collectionTimer,
    },
    delivery: {
      start: byId['delivery-start'],
      arrived: byId['delivery-arrived'],
      unloadingAt: deliveryUnloading,
      complete: byId['delivery-complete'],
      timer: deliveryTimer,
    },
  }
}

/**
 * Customer portal booking details use the same stage as admin Job Details.
 * The booking payload carries the assignment time and completion stamps.
 * History rows are the driver events already returned for that booking.
 *
 * @param {Record<string, unknown> | null | undefined} booking
 * @param {Array<Record<string, unknown>>} [historyRows]
 */
export function liveStageFromPortalBooking(booking, historyRows = []) {
  const row = booking || {}
  return buildAdminLiveStage(
    {
      assigned_at: row.assigned_at || '',
      status: row.status || '',
      operational_status: row.operational_status || '',
      completed_at: row.completed_at || '',
      cancelled_at: row.cancelled_at || '',
    },
    historyRows,
    null,
    {
      status: row.assignment_status || '',
      completed_at: row.assignment_completed_at || '',
    },
  )
}

/**
 * @param {string} startedAt
 * @param {string} finishedAt
 * @param {number} [nowMs]
 */
export function formatLoadDuration(startedAt, finishedAt, nowMs = Date.now()) {
  const start = new Date(startedAt).getTime()
  if (!Number.isFinite(start)) return ''
  const end = finishedAt ? new Date(finishedAt).getTime() : nowMs
  if (!Number.isFinite(end) || end < start) return ''
  const totalSec = Math.floor((end - start) / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (!finishedAt) {
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`
  }
  if (h > 0) return `${h} hr ${m} min`
  if (m > 0) return `${m} min`
  return `${s} sec`
}

/**
 * @param {Record<string, unknown>} q
 * @param {Record<string, unknown> | null} [job]
 */
export function dispatchWorkflowBadge(q, job = null) {
  if (quoteIsCancelled(q, job)) return { label: 'Cancelled', tone: 'slate' }
  if (quoteIsCompleted(q, job)) return { label: 'Completed', tone: 'sky' }
  if (quoteJobIsStarted(q, job)) return { label: 'Active', tone: 'emerald' }
  if (
    String(q.assigned_driver_name || '').trim() ||
    String(q.assigned_driver_id || '').trim() ||
    mergedAdminWorkflowForQuote(q).marketplaceVisibility === 'assigned'
  ) {
    return { label: 'Accepted', tone: 'amber' }
  }
  return { label: String(q.status || 'New'), tone: 'slate' }
}
