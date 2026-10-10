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
  },
  {
    key: 'loading_started',
    label: 'Collection started',
    statuses: ['loading_started'],
    photoStage: null,
  },
  {
    key: 'loading_finished',
    label: 'Collection finished',
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
  },
  {
    key: 'unloading_finished',
    label: 'Delivery finished',
    statuses: ['unloading_completed'],
    photoStage: 'delivery',
  },
  {
    key: 'job_finished',
    label: 'Job finished',
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
  const used = new Set()

  const milestones = MOVE_MILESTONES.map((step) => {
    const match = primary.find((row) => {
      if (used.has(row.id)) return false
      return step.statuses.includes(normStatus(row.status))
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
      photos: stagePhotos,
      corrections: corrections.filter((row) => String(row.corrects_event_id) === String(match?.id || '')),
    }
  })

  const contacts = primary
    .filter((row) => CONTACT_STATUSES.has(normStatus(row.status)))
    .map((row) => {
      const times = eventTime(row)
      const stop = normStatus(row.stop_type)
      return {
        id: row.id,
        label: normStatus(row.status) === 'unable_to_contact'
          ? 'Unable to contact customer'
          : 'Customer not available',
        stage: stop === 'pickup' || stop === 'collection'
          ? 'Collection'
          : stop === 'dropoff' || stop === 'delivery'
            ? 'Delivery'
            : NOT_RECORDED,
        whenLabel: times.displayAt ? formatMoveDateTime(times.displayAt) : NOT_RECORDED,
        occurredLabel: times.occurredAt ? formatMoveDateTime(times.occurredAt) : NOT_RECORDED,
        receivedLabel: times.receivedAt ? formatMoveDateTime(times.receivedAt) : NOT_RECORDED,
        showReceived: Boolean(times.occurredAt && times.receivedAt && times.occurredAt !== times.receivedAt),
        driverName: String(row.driver_name || '').trim() || NOT_RECORDED,
        sourceLabel: sourceLabel(row),
        latitude: Number.isFinite(Number(row.latitude)) ? Number(row.latitude) : null,
        longitude: Number.isFinite(Number(row.longitude)) ? Number(row.longitude) : null,
        accuracyM: Number.isFinite(Number(row.accuracy_m)) ? Number(row.accuracy_m) : null,
        notes: String(row.notes || '').trim(),
        corrections: corrections.filter((item) => String(item.corrects_event_id) === String(row.id)),
      }
    })

  const other = primary.filter((row) => {
    if (used.has(row.id) || CONTACT_STATUSES.has(normStatus(row.status))) return false
    const status = normStatus(row.status)
    return !MOVE_MILESTONES.some((step) => step.statuses.includes(status))
  })

  const unmatchedPhotos = (photos || []).filter((photo) => !photoMoveStage(photo))

  return { milestones, contacts, other, unmatchedPhotos }
}
