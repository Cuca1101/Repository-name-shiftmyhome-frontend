import { buildStageClocks } from './stageClocks'

export const NOT_RECORDED = 'Not recorded'
const UK_TIME_ZONE = 'Europe/London'

/** Stages shown in order. A missing history row stays Not recorded. */
export const MOVE_MILESTONES = [
  {
    key: 'departed_collection',
    label: 'Left for collection',
    statuses: ['on_way'],
    photoStage: null,
  },
  {
    key: 'arrived_collection',
    label: 'Arrived at collection',
    statuses: ['arrived_pickup'],
    photoStage: null,
    clock: 'atCollection',
  },
  {
    key: 'loading_started',
    label: 'Loading',
    statuses: ['loading_started', 'loading'],
    photoStage: null,
    clock: 'loading',
  },
  {
    key: 'loading_finished',
    label: 'Items collected',
    statuses: ['pickup_completed', 'loaded'],
    photoStage: 'collection',
  },
  {
    key: 'departed_delivery',
    label: 'Left for delivery',
    statuses: ['in_transit'],
    photoStage: null,
  },
  {
    key: 'arrived_delivery',
    label: 'Arrived at delivery',
    statuses: ['arrived_delivery'],
    photoStage: null,
    clock: 'atDelivery',
  },
  {
    key: 'unloading_started',
    label: 'Unloading',
    statuses: ['unloading_started'],
    photoStage: 'delivery',
    clock: 'unloading',
  },
  {
    key: 'job_finished',
    label: 'Completed',
    statuses: ['completed'],
    photoStage: 'proof',
  },
]

const SKIP_STATUSES = new Set([
  'gps',
  'location',
  'available_location',
  'active_job_location',
])

const CONTACT_STATUSES = new Set([
  'customer_not_available',
  'unable_to_contact',
])

/**
 * @param {string | null | undefined} iso
 * @returns {string}
 */
export function formatMoveDateTime(iso) {
  if (iso == null || String(iso).trim() === '') return NOT_RECORDED
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return NOT_RECORDED
  return d.toLocaleString('en-GB', {
    timeZone: UK_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * @param {string | null | undefined} status
 */
function normStatus(status) {
  return String(status || '').trim().toLowerCase().replace(/\s+/g, '_')
}

/**
 * @param {Record<string, unknown>} photo
 * @returns {'collection' | 'delivery' | 'proof' | null}
 */
export function photoMoveStage(photo) {
  const type = normStatus(photo?.photo_type)
  const meta = photo?.metadata && typeof photo.metadata === 'object' ? photo.metadata : {}
  const kind = normStatus(meta.photo_kind || meta.location_type || '')
  const stop = normStatus(meta.stop_type || photo?.stop_type || '')
  if (type === 'proof' || kind === 'pod' || kind === 'signature') return 'proof'
  if (type === 'collection' || kind === 'pickup' || kind === 'collection' || stop === 'pickup') {
    return 'collection'
  }
  if (type === 'delivery' || kind === 'delivery' || kind === 'dropoff' || stop === 'dropoff' || stop === 'delivery') {
    return 'delivery'
  }
  return null
}

/**
 * @param {Record<string, unknown>} row
 */
function eventTime(row) {
  const occurred = String(row?.occurred_at || '').trim()
  const received = String(row?.created_at || row?.received_at || '').trim()
  return {
    occurredAt: occurred || null,
    receivedAt: received || null,
    displayAt: occurred || received || null,
  }
}

/**
 * @param {Record<string, unknown>} row
 */
function sourceLabel(row) {
  const source = normStatus(row?.source)
  if (source === 'manual') return 'Manual action'
  if (source === 'gps') return 'GPS detection'
  return NOT_RECORDED
}

/**
 * @param {Array<Record<string, unknown>>} events
 * @param {Array<Record<string, unknown>>} photos
 * @param {{ completedAt?: string | null }} [opts]
 */
export function buildMoveTimeline(events, photos = [], opts = {}) {
  const rows = [...(events || [])].filter((row) => row && normStatus(row.status) && !SKIP_STATUSES.has(normStatus(row.status)))
  const corrections = rows.filter((row) => row.corrects_event_id)
  const primary = rows.filter((row) => !row.corrects_event_id)
  primary.sort(
    (a, b) =>
      new Date(a.occurred_at || a.created_at || 0).getTime() - new Date(b.occurred_at || b.created_at || 0).getTime(),
  )
  let deliveryPhase = false
  for (const row of primary) {
    const status = normStatus(row.status)
    if (status === 'arrived') row.status = deliveryPhase ? 'arrived_delivery' : 'arrived_pickup'
    const stamped = normStatus(row.status)
    if (['in_transit', 'arrived_delivery', 'unloading_completed', 'completed', 'pickup_completed', 'loaded'].includes(stamped)) {
      deliveryPhase = true
    }
  }
  const used = new Set()
  const firstAt = (statuses) => {
    const match = primary.find((row) => statuses.includes(normStatus(row.status)))
    return match ? eventTime(match).displayAt : null
  }
  const collectionStartedAt = firstAt(['on_way', 'started', 'start', 'left_for_collection'])
  const collectionArrivedAt = (() => {
    const match = primary.find((row) => {
      const at = eventTime(row).displayAt
      return ['arrived_pickup', 'at_collection'].includes(normStatus(row.status))
        && collectionStartedAt
        && at
        && at >= collectionStartedAt
    })
    return match ? eventTime(match).displayAt : null
  })()
  const deliveryStartedAt = firstAt(['in_transit', 'left_for_delivery', 'on_way_to_delivery'])
  const deliveryArrivedAt = (() => {
    const match = primary.find((row) => {
      const at = eventTime(row).displayAt
      return ['arrived_delivery', 'at_delivery'].includes(normStatus(row.status))
        && deliveryStartedAt
        && at
        && at >= deliveryStartedAt
    })
    return match ? eventTime(match).displayAt : null
  })()

  const milestones = MOVE_MILESTONES.map((step) => {
    const match = primary.find((row) => {
      if (used.has(row.id)) return false
      if (!step.statuses.includes(normStatus(row.status))) return false
      const at = eventTime(row).displayAt
      if (step.key === 'loading_started') return Boolean(collectionArrivedAt && at && at >= collectionArrivedAt)
      if (step.key === 'unloading_started') return Boolean(deliveryArrivedAt && at && at >= deliveryArrivedAt)
      if (step.key === 'loading_finished') return Boolean(collectionArrivedAt && at && at >= collectionArrivedAt)
      return true
    })
    if (match?.id) used.add(match.id)
    const times = match ? eventTime(match) : { occurredAt: null, receivedAt: null, displayAt: null }
    let displayAt = times.displayAt
    let fromBooking = false
    if (!match && step.key === 'job_finished' && String(opts.completedAt || '').trim()) {
      displayAt = String(opts.completedAt).trim()
      fromBooking = true
    }
    const stagePhotos = step.photoStage
      ? (photos || []).filter((photo) => photoMoveStage(photo) === step.photoStage)
      : []
    return {
      ...step,
      recorded: Boolean(match) || fromBooking,
      event: match || null,
      whenLabel: displayAt ? formatMoveDateTime(displayAt) : NOT_RECORDED,
      occurredLabel: times.occurredAt ? formatMoveDateTime(times.occurredAt) : NOT_RECORDED,
      receivedLabel: times.receivedAt ? formatMoveDateTime(times.receivedAt) : NOT_RECORDED,
      showReceived: Boolean(times.occurredAt && times.receivedAt && times.occurredAt !== times.receivedAt),
      driverName: String(match?.driver_name || '').trim() || NOT_RECORDED,
      sourceLabel: match ? sourceLabel(match) : NOT_RECORDED,
      latitude: Number.isFinite(Number(match?.latitude)) ? Number(match.latitude) : null,
      longitude: Number.isFinite(Number(match?.longitude)) ? Number(match.longitude) : null,
      accuracyM: Number.isFinite(Number(match?.accuracy_m)) ? Number(match.accuracy_m) : null,
      notes: String(match?.notes || '').trim(),
      fromBooking,
      startedAt: displayAt || '',
      endedAt: '',
      photos: stagePhotos,
      corrections: corrections.filter((row) => String(row.corrects_event_id) === String(match?.id || '')),
    }
  })

  const clocks = buildStageClocks(primary)
  milestones.forEach((step) => {
    if (!step.clock || !clocks[step.clock]) return
    const clock = clocks[step.clock]
    if (clock.startedAt) {
      step.recorded = true
      step.startedAt = clock.startedAt
      step.whenLabel = formatMoveDateTime(clock.startedAt)
    }
    step.endedAt = clock.startedAt ? clock.endedAt : ''
  })

  const other = primary.filter((row) => {
    if (used.has(row.id) || CONTACT_STATUSES.has(normStatus(row.status))) return false
    const status = normStatus(row.status)
    return !MOVE_MILESTONES.some((step) => step.statuses.includes(status))
  })

  const unmatchedPhotos = (photos || []).filter((photo) => !photoMoveStage(photo))

  return { milestones, other, unmatchedPhotos }
}
