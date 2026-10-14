const SKIP_STATUSES = new Set([
  'gps',
  'location',
  'available_location',
  'active_job_location',
  'correction',
  'customer_not_available',
  'unable_to_contact',
])

function normStatus(status) {
  return String(status || '').trim().toLowerCase().replace(/\s+/g, '_')
}

function eventAt(row) {
  return String(row?.occurred_at || row?.created_at || '').trim()
}

/**
 * Separate clocks for time at the address and time spent loading or unloading.
 * Arrived keeps running through Loading/Unloading and stops at Complete on that card.
 * Loading/Unloading start only from their own first stamp. A missing stamp stays blank.
 *
 * @param {Array<Record<string, unknown>>} events
 */
export function buildStageClocks(events) {
  const clocks = {
    atCollection: { startedAt: '', endedAt: '' },
    loading: { startedAt: '', endedAt: '' },
    atDelivery: { startedAt: '', endedAt: '' },
    unloading: { startedAt: '', endedAt: '' },
  }
  const sorted = [...(events || [])]
    .filter((row) => row && !row.corrects_event_id)
    .sort((a, b) => new Date(eventAt(a) || 0).getTime() - new Date(eventAt(b) || 0).getTime())

  let deliveryPhase = false
  let collectionEnd = ''
  let jobEnd = ''

  for (const row of sorted) {
    const status = normStatus(row.status)
    if (!status || SKIP_STATUSES.has(status)) continue
    const at = eventAt(row)
    if (!at) continue

    if (status === 'arrived_pickup' && !clocks.atCollection.startedAt) {
      clocks.atCollection.startedAt = at
    } else if (status === 'arrived' && !deliveryPhase && !clocks.atCollection.startedAt) {
      clocks.atCollection.startedAt = at
    } else if (status === 'arrived_delivery' && !clocks.atDelivery.startedAt) {
      clocks.atDelivery.startedAt = at
    } else if (status === 'arrived' && deliveryPhase && !clocks.atDelivery.startedAt) {
      clocks.atDelivery.startedAt = at
    }

    if ((status === 'loading_started' || status === 'loading') && !clocks.loading.startedAt) {
      clocks.loading.startedAt = at
    }
    if ((status === 'unloading_started') && !clocks.unloading.startedAt) {
      clocks.unloading.startedAt = at
    }
    if ((status === 'pickup_completed' || status === 'loaded') && !collectionEnd) {
      collectionEnd = at
    }
    if ((status === 'completed' || status === 'complete' || status === 'delivered') && !jobEnd) {
      jobEnd = at
    }

    if (
      status === 'in_transit'
      || status === 'arrived_delivery'
      || status === 'unloading_started'
      || status === 'unloading_completed'
      || status === 'completed'
      || status === 'complete'
      || status === 'delivered'
      || status === 'pickup_completed'
      || status === 'loaded'
    ) {
      deliveryPhase = true
    }
  }

  if (clocks.atCollection.startedAt && collectionEnd) clocks.atCollection.endedAt = collectionEnd
  if (clocks.loading.startedAt && collectionEnd) clocks.loading.endedAt = collectionEnd
  if (clocks.atDelivery.startedAt && jobEnd) clocks.atDelivery.endedAt = jobEnd
  if (clocks.unloading.startedAt && jobEnd) clocks.unloading.endedAt = jobEnd
  return clocks
}

/**
 * @param {string} workflowStatus
 * @param {ReturnType<typeof buildStageClocks>} clocks
 * @param {boolean} completed
 */
export function resolveLiveStageLabel(workflowStatus, clocks, completed) {
  if (completed) return 'Completed'
  const status = normStatus(workflowStatus)
  if (status === 'completed' || status === 'complete' || status === 'delivered') return 'Completed'
  if (status === 'unloading_started' || (clocks.unloading.startedAt && !clocks.unloading.endedAt)) {
    return 'Unloading'
  }
  if (status === 'arrived_delivery') return 'At delivery'
  if (status === 'in_transit') return 'Left for delivery'
  if (status === 'pickup_completed' || status === 'loaded') return 'Items collected'
  if (
    status === 'loading_started'
    || status === 'loading'
    || (clocks.loading.startedAt && !clocks.loading.endedAt)
  ) {
    return 'Loading'
  }
  if (status === 'arrived_pickup' || status === 'arrived') return 'At collection'
  if (status === 'on_way' || status === 'started' || status === 'start' || status === 'in_progress') {
    return 'Left for collection'
  }
  return ''
}
