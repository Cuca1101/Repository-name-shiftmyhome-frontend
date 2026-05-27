import { formatDateTimeUK } from './formatDateDisplay'
import { mergedAdminWorkflowForQuote } from './quoteAdminWorkflowMerge'
import { quoteIsCancelled, quoteIsCompleted } from './adminWorkflowFilters'
import { quoteJobIsStarted } from './adminJobAcceptedStatus'

/** @typedef {{ id: string, label: string, match: RegExp }} DispatchTimelineStepDef */

export const DISPATCH_TIMELINE_STEPS = /** @type {DispatchTimelineStepDef[]} */ ([
  { id: 'accepted', label: 'Accepted', match: /^(assigned|accepted)$/i },
  { id: 'on_way', label: 'On way', match: /\b(on the way|en route|heading)\b/i },
  { id: 'arrived_pickup', label: 'Arrived', match: /\b(arrived|at collection|at pickup)\b/i },
  { id: 'loading', label: 'Loading', match: /\b(loading|loaded)\b/i },
  { id: 'in_transit', label: 'In transit', match: /\b(in transit|in progress|active|started)\b/i },
  { id: 'arrived_delivery', label: 'Arrived delivery', match: /\b(at delivery|arrived delivery|unloading)\b/i },
  { id: 'completed', label: 'Completed', match: /\b(completed|complete|delivered)\b/i },
])

/**
 * @param {string} op
 */
function matchStepIndex(op) {
  const s = String(op || '').trim()
  if (!s) return -1
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
 */
export function buildDispatchTimelineState(q, overrides = {}, job = null, assignment = null) {
  const op = String(overrides.operationalStatus || q.operational_status || assignment?.status || '').trim()
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
  const cancelledAt = String(q.cancelled_at || overrides.workflowCancelledAt || '').trim()
  const updatedAt =
    (assignment?.updated_at && String(assignment.updated_at)) ||
    (q.updated_at && String(q.updated_at)) ||
    ''

  return DISPATCH_TIMELINE_STEPS.map((step, index) => {
    let state = 'upcoming'
    if (cancelled) state = 'cancelled'
    else if (completed && index <= currentIndex) state = 'done'
    else if (index < currentIndex) state = 'done'
    else if (index === currentIndex) state = 'current'

    let timestamp = ''
    if (step.id === 'accepted' && acceptedAt) timestamp = acceptedAt
    else if (step.id === 'completed' && completedAt) timestamp = completedAt
    else if (state === 'current' && updatedAt) timestamp = updatedAt

    return {
      ...step,
      state,
      timestamp: timestamp ? formatDateTimeUK(timestamp) : '',
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
