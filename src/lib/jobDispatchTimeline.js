import { formatDateTimeUK } from './formatDateDisplay'
import { mergedAdminWorkflowForQuote } from './quoteAdminWorkflowMerge'
import { quoteIsCancelled, quoteIsCompleted } from './adminWorkflowFilters'
import { quoteJobIsStarted } from './adminJobAcceptedStatus'
import { buildStageClocks, resolveLiveStageLabel } from './stageClocks'

/** @typedef {{ id: string, label: string, match: RegExp }} DispatchTimelineStepDef */

export const DISPATCH_TIMELINE_STEPS = /** @type {DispatchTimelineStepDef[]} */ ([
  { id: 'accepted', label: 'Accepted', match: /^(assigned|accepted|booked|active)$/i },
  { id: 'on_way', label: 'Left for collection', match: /\b(on[_\s-]?way|on the way|en route|heading)\b/i },
  {
    id: 'arrived_pickup',
    label: 'At collection',
    match: /\b(arrived_pickup|at collection|at pickup)\b/i,
  },
  { id: 'loading', label: 'Loading', match: /\b(loading_started|^loading$)\b/i },
  {
    id: 'in_transit',
    label: 'Left for delivery',
    match: /\b(in[_\s-]?transit)\b/i,
  },
  {
    id: 'arrived_delivery',
    label: 'At delivery',
    match: /\b(arrived_delivery|at delivery|arrived delivery)\b/i,
  },
  { id: 'unloading', label: 'Unloading', match: /\b(unloading_started)\b/i },
  { id: 'completed', label: 'Completed', match: /\b(completed|complete|delivered)\b/i },
])

/** @type {Record<string, number>} */
const WORKFLOW_STEP_BY_STATUS = {
  accepted: 0,
  assigned: 0,
  booked: 0,
  active: 0,
  on_way: 1,
  'on way': 1,
  in_progress: 1,
  'in progress': 1,
  arrived_pickup: 2,
  arrived: 2,
  loading: 3,
  loading_started: 3,
  pickup_completed: 4,
  loaded: 4,
  in_transit: 4,
  'in transit': 4,
  arrived_delivery: 5,
  'arrived delivery': 5,
  unloading_started: 6,
  completed: 7,
  complete: 7,
  delivered: 7,
}

/**
 * @param {string} raw
 */
function normalizeWorkflowStatus(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

const HISTORY_SKIP_STATUSES = new Set([
  'gps',
  'location',
  'available_location',
  'active_job_location',
])

/**
 * Map one job_status_history row to a Status Tracker step id.
 *
 * @param {string} rawStatus
 * @param {{ deliveryPhase?: boolean }} [ctx]
 * @returns {string | null}
 */
export function historyStatusToTimelineStepId(rawStatus, ctx = {}) {
  const n = normalizeWorkflowStatus(rawStatus)
  if (!n || HISTORY_SKIP_STATUSES.has(n)) return null
  if (n === 'started' || n === 'start') return 'on_way'
  if (n === 'arrived_pickup') return 'arrived_pickup'
  if (n === 'arrived_delivery') return 'arrived_delivery'
  if (n === 'arrived') return ctx.deliveryPhase ? 'arrived_delivery' : 'arrived_pickup'
  if (n === 'loading_started' || n === 'loading') return 'loading'
  if (n === 'pickup_completed' || n === 'loaded') return null
  if (n === 'unloading_started') return 'unloading'
  if (n === 'in_transit') return 'in_transit'
  if (n === 'completed' || n === 'complete' || n === 'delivered') return 'completed'

  const idx = matchStepIndex(rawStatus)
  if (idx >= 0 && idx < DISPATCH_TIMELINE_STEPS.length) {
    return DISPATCH_TIMELINE_STEPS[idx].id
  }
  return null
}

/**
 * First timestamp per tracker step from job_status_history (+ accepted/completed fallbacks).
 *
 * @param {Array<{ status: string, created_at: string }>} historyRows
 * @param {{ acceptedAt?: string, completedAt?: string }} [opts]
 * @returns {Record<string, string>}
 */
export function buildStepTimestampsFromHistory(historyRows, opts = {}) {
  /** @type {Record<string, string>} */
  const timestamps = {}
  const acceptedAt = String(opts.acceptedAt || '').trim()
  const completedAt = String(opts.completedAt || '').trim()
  if (acceptedAt) timestamps.accepted = acceptedAt

  const sorted = [...(historyRows || [])].sort(
    (a, b) => new Date(a.occurred_at || a.created_at || 0).getTime() - new Date(b.occurred_at || b.created_at || 0).getTime(),
  )

  let deliveryPhase = false
  for (const row of sorted) {
    const at = String(row.occurred_at || row.created_at || '').trim()
    if (!at) continue
    const stepId = historyStatusToTimelineStepId(row.status, { deliveryPhase })
    if (stepId === 'in_transit' || stepId === 'arrived_delivery' || stepId === 'completed') {
      deliveryPhase = true
    }
    if (stepId && !timestamps[stepId]) {
      timestamps[stepId] = at
    }
  }

  if (completedAt && !timestamps.completed) timestamps.completed = completedAt
  return timestamps
}

/**
 * Loading clock. Starts only when loading_started was recorded.
 * Ends when collection is completed. Arrival time is never copied in.
 *
 * @param {Array<{ status?: string, created_at?: string, occurred_at?: string }>} historyRows
 * @returns {{ startedAt: string, finishedAt: string }}
 */
export function resolveLoadingWindow(historyRows) {
  const clocks = buildStageClocks(historyRows)
  return { startedAt: clocks.loading.startedAt, finishedAt: clocks.loading.endedAt }
}

/**
 * @param {Array<{ status?: string, created_at?: string, occurred_at?: string }>} historyRows
 * @returns {{ startedAt: string, finishedAt: string }}
 */
export function resolveUnloadingWindow(historyRows) {
  const clocks = buildStageClocks(historyRows)
  return { startedAt: clocks.unloading.startedAt, finishedAt: clocks.unloading.endedAt }
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
 * Best label for admin Status Tracker (driver mobile → Supabase).
 *
 * @param {Record<string, unknown>} q
 * @param {{ status?: string, updated_at?: string } | null} [assignment]
 * @param {{ workflow_status?: string, workflow_at?: string } | null} [workflow]
 */
export function resolveDispatchWorkflowLabel(q, assignment = null, workflow = null) {
  const fromHistory = String(workflow?.workflow_status || '').trim()
  if (fromHistory) return fromHistory

  const quoteStatus = String(q?.status || '').trim()
  if (quoteStatus && !/^(new|booked)$/i.test(quoteStatus)) return quoteStatus

  const op = String(q?.operational_status || '').trim()
  if (op) return op

  const assignStatus = String(assignment?.status || '').trim()
  if (assignStatus && !/^(active|accepted|assigned)$/i.test(assignStatus)) return assignStatus

  return op || quoteStatus || assignStatus
}

/**
 * @param {string} op
 */
function matchStepIndex(op) {
  const s = String(op || '').trim()
  if (!s) return -1

  const normalized = normalizeWorkflowStatus(s)
  if (normalized in WORKFLOW_STEP_BY_STATUS) {
    return WORKFLOW_STEP_BY_STATUS[normalized]
  }

  const lower = s.toLowerCase()
  if (lower in WORKFLOW_STEP_BY_STATUS) {
    return WORKFLOW_STEP_BY_STATUS[lower]
  }

  for (let i = DISPATCH_TIMELINE_STEPS.length - 1; i >= 0; i -= 1) {
    if (DISPATCH_TIMELINE_STEPS[i].match.test(s)) return i
  }
  return -1
}

/**
 * @param {Record<string, unknown>} q
 * @param {Record<string, unknown>} overrides
 * @param {Record<string, unknown> | null} [job]
 * @param {{ status?: string, updated_at?: string } | null} [assignment]
 * @param {{ workflow_status?: string, workflow_at?: string } | null} [workflow]
 * @param {Array<{ status: string, created_at: string }>} [statusHistory]
 */
export function buildDispatchTimelineState(
  q,
  overrides = {},
  job = null,
  assignment = null,
  workflow = null,
  statusHistory = [],
) {
  const op =
    resolveDispatchWorkflowLabel(q, assignment, workflow) ||
    String(overrides.operationalStatus || q.operational_status || assignment?.status || '').trim()
  const completed = quoteIsCompleted(q, job)
  const cancelled = quoteIsCancelled(q, job)
  const assigned = Boolean(
    String(q.assigned_driver_name || overrides.assignedDriver || '').trim() ||
      String(q.assigned_driver_id || '').trim() ||
      String(overrides.assignedPartnerCompany || q.assigned_partner_company || '').trim(),
  )

  let currentIndex = matchStepIndex(op)
  if (completed) currentIndex = DISPATCH_TIMELINE_STEPS.length - 1
  else if (cancelled) currentIndex = -1
  else if (currentIndex < 0 && assigned) {
    currentIndex = quoteJobIsStarted(q, job, assignment) ? 4 : 0
  }

  const acceptedAt = q.assigned_at ? String(q.assigned_at) : ''
  const completedAt = String(q.completed_at || overrides.workflowCompletedAt || '').trim()
  const stepTimestamps = buildStepTimestampsFromHistory(statusHistory, { acceptedAt, completedAt })
  const clocks = buildStageClocks(statusHistory)
  const statusNorm = normalizeWorkflowStatus(op)
  const collectionFinished = statusNorm === 'pickup_completed' || statusNorm === 'loaded'

  const steps = DISPATCH_TIMELINE_STEPS.map((step, index) => {
    const clock =
      step.id === 'arrived_pickup' ? clocks.atCollection
      : step.id === 'loading' ? clocks.loading
      : step.id === 'arrived_delivery' ? clocks.atDelivery
      : step.id === 'unloading' ? clocks.unloading
      : null

    let state = 'upcoming'
    if (cancelled) state = 'cancelled'
    else if (step.id === 'loading' || step.id === 'unloading') {
      if (!clock?.startedAt) state = 'unrecorded'
      else if (clock.endedAt || completed) state = 'done'
      else state = 'current'
    } else if (step.id === 'arrived_pickup' && clocks.atCollection.startedAt && !clocks.atCollection.endedAt && !completed) {
      state = 'current'
    } else if (step.id === 'arrived_delivery' && clocks.atDelivery.startedAt && !clocks.atDelivery.endedAt && !completed) {
      state = 'current'
    } else if (step.id === 'in_transit' && collectionFinished && !stepTimestamps.in_transit && !completed) {
      state = 'upcoming'
    } else if (completed && index <= currentIndex) state = 'done'
    else if (index < currentIndex) state = 'done'
    else if (index === currentIndex) state = 'current'

    const rawTs = clock
      ? clock.startedAt
      : step.id === 'accepted'
        ? ''
        : stepTimestamps[step.id] || ''
    const showTime = state === 'done' || state === 'current'
    const endedAt = clock && showTime ? clock.endedAt : ''

    return {
      ...step,
      state,
      timestamp: rawTs && showTime ? formatDateTimeUK(rawTs) : '',
      startedAt: rawTs && showTime ? rawTs : '',
      endedAt,
      loadingStartedAt: step.id === 'loading' ? clocks.loading.startedAt : '',
      loadingFinishedAt: step.id === 'loading' ? clocks.loading.endedAt : '',
    }
  })

  return steps
}

export { resolveLiveStageLabel }

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
