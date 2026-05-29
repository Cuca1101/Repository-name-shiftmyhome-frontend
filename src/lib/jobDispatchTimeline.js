import { formatDateTimeUK } from './formatDateDisplay'
import { mergedAdminWorkflowForQuote } from './quoteAdminWorkflowMerge'
import { quoteIsCancelled, quoteIsCompleted } from './adminWorkflowFilters'
import { quoteJobIsStarted } from './adminJobAcceptedStatus'

/** @typedef {{ id: string, label: string, match: RegExp }} DispatchTimelineStepDef */

export const DISPATCH_TIMELINE_STEPS = /** @type {DispatchTimelineStepDef[]} */ ([
  { id: 'accepted', label: 'Accepted', match: /^(assigned|accepted|booked|active)$/i },
  { id: 'on_way', label: 'On way', match: /\b(on[_\s-]?way|on the way|en route|heading)\b/i },
  {
    id: 'arrived_pickup',
    label: 'Arrived',
    match: /\b(arrived_pickup|at collection|at pickup)\b/i,
  },
  { id: 'loading', label: 'Loading', match: /\b(loading|loaded|pickup_completed)\b/i },
  {
    id: 'in_transit',
    label: 'In transit',
    match: /\b(in[_\s-]?transit)\b/i,
  },
  {
    id: 'arrived_delivery',
    label: 'Arrived delivery',
    match: /\b(arrived_delivery|at delivery|arrived delivery|unloading)\b/i,
  },
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
  pickup_completed: 3,
  loaded: 3,
  loading: 3,
  in_transit: 4,
  'in transit': 4,
  arrived_delivery: 5,
  'arrived delivery': 5,
  completed: 6,
  complete: 6,
  delivered: 6,
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
  if (n === 'pickup_completed' || n === 'loaded' || n === 'loading') return 'loading'
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
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )

  let deliveryPhase = false
  for (const row of sorted) {
    const at = String(row.created_at || '').trim()
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

  return DISPATCH_TIMELINE_STEPS.map((step, index) => {
    let state = 'upcoming'
    if (cancelled) state = 'cancelled'
    else if (completed && index <= currentIndex) state = 'done'
    else if (index < currentIndex) state = 'done'
    else if (index === currentIndex) state = 'current'

    const rawTs = stepTimestamps[step.id] || ''
    const timestamp =
      rawTs && (state === 'done' || state === 'current') ? formatDateTimeUK(rawTs) : ''

    return {
      ...step,
      state,
      timestamp,
    }
  })
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
