import { formatDateTimeUK } from './formatDateDisplay'
import { formatMarketplaceStatusSummary } from './marketplaceListingStatus'

/**
 * @typedef {{ t: string | null, label: string, detail: string, sortMs: number }} JobOpsTimelineEvent
 */

/**
 * @param {unknown} iso
 */
function toSortMs(iso) {
  if (iso == null || iso === '') return 0
  const n = new Date(String(iso)).getTime()
  return Number.isFinite(n) ? n : 0
}

/**
 * Build chronological ops timeline from quote row + merged admin overrides (no invented events).
 * @param {Record<string, unknown>} q
 * @param {Record<string, unknown>} overrides
 * @returns {JobOpsTimelineEvent[]}
 */
export function buildJobOperationsTimeline(q, overrides = {}) {
  /** @type {JobOpsTimelineEvent[]} */
  const events = []

  const created = q.created_at != null ? String(q.created_at) : ''
  if (created) {
    events.push({
      t: created,
      label: 'Quote created',
      detail: 'Booking entered the system',
      sortMs: toSortMs(created),
    })
  }

  const paidAt = q.paid_at != null ? String(q.paid_at) : ''
  if (paidAt) {
    const ps = String(q.payment_status || '').replace(/_/g, ' ')
    events.push({
      t: paidAt,
      label: 'Payment received',
      detail: ps ? `Status: ${ps}` : 'Card payment recorded',
      sortMs: toSortMs(paidAt),
    })
  }

  const assignedAt = q.assigned_at != null ? String(q.assigned_at) : ''
  const driverName = String(q.assigned_driver_name || overrides.assignedDriver || '').trim()
  const partnerName = String(q.assigned_partner_company || overrides.assignedPartnerCompany || '').trim()
  if (driverName || partnerName) {
    const detail = driverName
      ? `Driver: ${driverName}`
      : partnerName
        ? `Partner: ${partnerName}`
        : ''
    events.push({
      t: assignedAt || null,
      label: driverName ? 'Driver assigned' : 'Partner assigned',
      detail,
      sortMs: assignedAt ? toSortMs(assignedAt) : toSortMs(created) + 1,
    })
  }

  const mv = String(overrides.marketplaceVisibility || q.marketplace_visibility || '')
  if (mv === 'visible_in_marketplace') {
    events.push({
      t: assignedAt || null,
      label: 'Marketplace listed',
      detail: 'Job visible to transport partners',
      sortMs: (assignedAt ? toSortMs(assignedAt) : toSortMs(created)) + 2,
    })
  } else if (mv === 'assigned') {
    events.push({
      t: assignedAt || null,
      label: 'Marketplace accepted',
      detail: formatMarketplaceStatusSummary(q),
      sortMs: (assignedAt ? toSortMs(assignedAt) : toSortMs(created)) + 2,
    })
  }

  const opStatus = String(overrides.operationalStatus || q.operational_status || '').trim()
  if (opStatus) {
    events.push({
      t: q.updated_at != null ? String(q.updated_at) : null,
      label: 'Operational status',
      detail: opStatus,
      sortMs: toSortMs(q.updated_at) || 0,
    })
  }

  const workflowStatus = String(q.status || '').trim()
  if (workflowStatus) {
    events.push({
      t: null,
      label: 'Workflow status',
      detail: workflowStatus,
      sortMs: toSortMs(q.updated_at) || 0,
    })
  }

  const completedAt = String(overrides.workflowCompletedAt || q.completed_at || '').trim()
  if (completedAt) {
    const note = String(overrides.adminCompletionNote || q.admin_completion_note || '').trim()
    events.push({
      t: completedAt,
      label: 'Job completed',
      detail: note || 'Marked complete in admin',
      sortMs: toSortMs(completedAt),
    })
  }

  const cancelledAt = String(overrides.workflowCancelledAt || q.cancelled_at || '').trim()
  if (cancelledAt) {
    const reason = String(overrides.adminCancellationReason || q.admin_cancellation_reason || '').trim()
    events.push({
      t: cancelledAt,
      label: 'Job cancelled',
      detail: reason || 'Cancelled in admin',
      sortMs: toSortMs(cancelledAt),
    })
  }

  const log = String(overrides.adminNotesLog || q.admin_notes_log || '').trim()
  if (log) {
    const lines = log.split('\n').filter((x) => x.trim())
    lines.slice(-8).forEach((line, i) => {
      events.push({
        t: null,
        label: 'Ops log',
        detail: line.trim(),
        sortMs: toSortMs(q.updated_at) + 100 + i,
      })
    })
  }

  events.sort((a, b) => a.sortMs - b.sortMs)
  return events
}

/**
 * @param {JobOpsTimelineEvent} e
 */
export function formatTimelineEventTime(e) {
  return e.t ? formatDateTimeUK(e.t) : '—'
}
