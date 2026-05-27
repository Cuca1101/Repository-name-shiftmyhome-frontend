import { formatDateTimeUK } from './formatDateDisplay'
import { mergedAdminWorkflowForQuote } from './quoteAdminWorkflowMerge'
import { resolveJobAcceptedPaymentBreakdown } from './jobAcceptedPaymentDisplay'
import { resolveFinancials } from './quoteJobAdminModel'
import { quoteAdjustmentsSumGbp } from './marketplaceQuoteFinance'
import { findLinkedJobForQuote, quoteIsCancelled } from './adminWorkflowFilters'
import { driverChargeTypeLabel } from './driverChargeConstants'
import { normalizeDriverChargeStatus } from './driverChargeStatus'

export function formatAdminMoney(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return `£${Number(n).toFixed(2)}`
}

/**
 * @param {Record<string, unknown>} q
 * @param {Record<string, unknown> | null} job
 */
export function completedJobDisplayFields(q, job = null) {
  const fin = resolveFinancials(q, quoteAdjustmentsSumGbp(q))
  const payment = resolveJobAcceptedPaymentBreakdown(q)
  const platformProfit =
    payment.customerTotal != null && payment.driverPayout != null
      ? Math.round((Number(payment.customerTotal) - Number(payment.driverPayout)) * 100) / 100
      : payment.platformFee

  const completedAt =
    (q.completed_at && String(q.completed_at)) ||
    (job?.updated_at && String(job.status) === 'Completed' ? String(job.updated_at) : '') ||
    ''

  return {
    quoteRef: String(q.quote_ref || q.id || '').slice(0, 12),
    customer: String(q.full_name || '—'),
    driver:
      String(q.assigned_driver_name || mergedAdminWorkflowForQuote(q).assignedDriver || '').trim() ||
      String(q.assigned_partner_company || mergedAdminWorkflowForQuote(q).assignedPartnerCompany || '').trim() ||
      '—',
    customerTotal: fin.customerTotal,
    driverPayout: payment.driverPayout,
    platformProfit,
    completedAt,
    completedAtDisplay: completedAt ? formatDateTimeUK(completedAt) : '—',
    paymentStatus: String(q.payment_status || '—'),
    manualOverride: payment.manualPayoutOverride,
  }
}

/**
 * @param {Record<string, unknown>} q
 * @param {Record<string, unknown> | null} job
 * @param {ReturnType<import('./data/driverChargesRepository.js').mapChargeRow>[]} [charges]
 */
export function cancelledJobDisplayFields(q, job = null, charges = []) {
  const o = mergedAdminWorkflowForQuote(q)
  const reason =
    String(q.admin_cancellation_reason || '').trim() ||
    String(o.adminCancellationReason || '').trim() ||
    String(o.cancellationReason || '').trim() ||
    '—'
  const cancelledBy = String(o.cancelledBy || '').trim() || '—'
  const cancelledAt =
    String(q.cancelled_at || o.workflowCancelledAt || '').trim() ||
    (job && quoteIsCancelled(q, job) && job.updated_at ? String(job.updated_at) : '')

  const qid = String(q.id || '')
  const related = (charges || []).filter((c) => c.quoteId === qid)
  const activeCharges = related.filter((c) => normalizeDriverChargeStatus(c.status) !== 'removed')
  const chargeSummary =
    activeCharges.length === 0
      ? '—'
      : activeCharges
          .map(
            (c) =>
              `${driverChargeTypeLabel(c.chargeType)} ${formatAdminMoney(c.amount)} (${normalizeDriverChargeStatus(c.status)})`,
          )
          .join('; ')

  return {
    quoteRef: String(q.quote_ref || q.id || '').slice(0, 12),
    customer: String(q.full_name || '—'),
    driver:
      String(q.assigned_driver_name || o.assignedDriver || '').trim() ||
      String(q.assigned_partner_company || o.assignedPartnerCompany || '').trim() ||
      '—',
    reason,
    cancelledBy,
    cancelledAt,
    cancelledAtDisplay: cancelledAt ? formatDateTimeUK(cancelledAt) : '—',
    chargeSummary,
    charges: related,
  }
}
