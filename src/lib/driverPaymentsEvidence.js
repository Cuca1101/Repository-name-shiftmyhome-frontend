import { quotePassesActiveStrict } from './adminJobListRules'
import { quoteIsCompleted, quoteIsCancelled, findLinkedJobForQuote } from './adminWorkflowFilters'
import { quoteVisibleInAdminLists } from './adminProductionFilters'
import { resolveDriverPayoutSettlement } from './driverPayoutSettlement'
import {
  computeJobAcceptedDefaultPayout,
  isJobAcceptedManualPayoutOverride,
  resolveJobAcceptedPaymentBreakdown,
} from './jobAcceptedPaymentDisplay'
import { sumDeductibleDriverCharges } from './driverChargeAccounting'
import { formatDateUK, formatDateTimeUK } from './formatDateDisplay'
import { jobAcceptedStatusBadge } from './adminJobAcceptedStatus'

/**
 * @param {Record<string, unknown>} q
 * @param {Record<string, unknown> | null} job
 */
export function quoteEligibleForDriverPaymentsEvidence(q, job = null) {
  if (!quoteVisibleInAdminLists(q)) return false
  if (quoteIsCancelled(q, job)) return false
  const hasDriver =
    (q.assigned_driver_id != null && String(q.assigned_driver_id).trim() !== '') ||
    (q.assigned_driver_name != null && String(q.assigned_driver_name).trim() !== '')
  if (!hasDriver) return false
  return quotePassesActiveStrict(q) || quoteIsCompleted(q, job)
}

/**
 * @param {Record<string, unknown>} q
 * @param {Record<string, unknown> | null} job
 */
function jobStatusLabel(q, job) {
  if (quoteIsCompleted(q, job)) return 'Completed'
  const badge = jobAcceptedStatusBadge(q, job)
  return badge.label
}

/**
 * @param {Record<string, unknown>} q
 * @param {Record<string, unknown> | null} job
 */
function completedDateIso(q, job) {
  return (
    (q.completed_at && String(q.completed_at)) ||
    (job?.updated_at && quoteIsCompleted(q, job) ? String(job.updated_at) : '') ||
    ''
  )
}

/**
 * @param {Record<string, unknown>[]} quotes
 * @param {ReturnType<import('./data/driverChargesRepository.js').mapChargeRow>[]} charges
 * @param {Record<string, unknown>[]} [jobs]
 */
export function buildDriverPaymentsEvidenceRows(quotes, charges, jobs = []) {
  const chargesByQuote = new Map()
  for (const c of charges) {
    if (!c.quoteId) continue
    const qid = String(c.quoteId)
    if (!chargesByQuote.has(qid)) chargesByQuote.set(qid, [])
    chargesByQuote.get(qid).push(c)
  }

  /** @type {Array<Record<string, unknown>>} */
  const rows = []

  for (const q of quotes) {
    const job = findLinkedJobForQuote(q, jobs)
    if (!quoteEligibleForDriverPaymentsEvidence(q, job)) continue

    const qid = String(q.id)
    const qCharges = chargesByQuote.get(qid) || []
    const payment = resolveJobAcceptedPaymentBreakdown(q)
    const settlement = resolveDriverPayoutSettlement(q, qCharges)
    const defaultPayout = computeJobAcceptedDefaultPayout(q)
    const manualOverride = isJobAcceptedManualPayoutOverride(q)

    const driverPayout = payment.driverPayout
    const customerTotal = payment.customerTotal
    const platformProfit =
      customerTotal != null && driverPayout != null
        ? Math.round((Number(customerTotal) - Number(driverPayout)) * 100) / 100
        : payment.platformFee
    const deductions = settlement.driverDeductions ?? sumDeductibleDriverCharges(qCharges)
    const netPayable =
      settlement.driverPayoutNet ??
      (driverPayout != null ? Math.max(0, Number(driverPayout) - deductions) : null)
    const paidToDriver = settlement.payoutPaidAmount ?? 0
    const remainingOwed = settlement.payoutRemainingBalance ?? (netPayable != null ? Math.max(0, netPayable - paidToDriver) : null)

    rows.push({
      quoteId: qid,
      quoteRef: String(q.quote_ref || qid.slice(0, 8)),
      customerName: String(q.full_name || '').trim() || '—',
      driverId: q.assigned_driver_id != null ? String(q.assigned_driver_id) : '',
      driverName: String(q.assigned_driver_name || '').trim() || '—',
      customerTotal,
      platformFee: payment.platformFee,
      platformProfit,
      driverPayout,
      defaultDriverPayout: defaultPayout?.driverPayout ?? payment.defaultDriverPayout,
      manualPayoutOverride: manualOverride,
      payoutOverrideNote: payment.payoutOverrideNote || '',
      driverDeductions: deductions,
      netPayable,
      paidToDriver,
      remainingOwed,
      driverPaidStatus: settlement.payoutSettlementLabel || settlement.payoutSettlementStatus || 'pending',
      driverPaidStatusKey: String(settlement.payoutSettlementStatus || 'pending'),
      driverPaymentDate: settlement.payoutPaidAt || '',
      driverPaymentDateDisplay: settlement.payoutPaidAt ? formatDateTimeUK(settlement.payoutPaidAt) : '—',
      jobStatus: jobStatusLabel(q, job),
      completedDate: completedDateIso(q, job),
      completedDateDisplay: completedDateIso(q, job) ? formatDateUK(completedDateIso(q, job)) : '—',
      moveDate: q.move_date ? String(q.move_date) : '',
      moveDateDisplay: q.move_date ? formatDateUK(q.move_date) : '—',
      quote: q,
      charges: qCharges,
      settlement,
    })
  }

  return rows.sort((a, b) => {
    const da = a.completedDate || a.moveDate || ''
    const db = b.completedDate || b.moveDate || ''
    return db.localeCompare(da)
  })
}

/**
 * @param {ReturnType<typeof buildDriverPaymentsEvidenceRows>} rows
 * @param {{
 *   payFilter?: 'all' | 'unpaid' | 'paid',
 *   driverId?: string,
 *   dateFrom?: string,
 *   dateTo?: string,
 *   refSearch?: string,
 * }} filters
 */
export function filterDriverPaymentsEvidenceRows(rows, filters = {}) {
  const payFilter = filters.payFilter || 'all'
  const driverId = String(filters.driverId || '').trim()
  const dateFrom = String(filters.dateFrom || '').trim()
  const dateTo = String(filters.dateTo || '').trim()
  const refQ = String(filters.refSearch || '')
    .trim()
    .toLowerCase()

  return rows.filter((r) => {
    if (payFilter === 'paid' && r.driverPaidStatusKey !== 'paid') return false
    if (payFilter === 'unpaid' && r.driverPaidStatusKey === 'paid') return false
    if (driverId && r.driverId !== driverId) return false

    const dateKey = (r.completedDate || r.moveDate || '').slice(0, 10)
    if (dateFrom && dateKey && dateKey < dateFrom) return false
    if (dateTo && dateKey && dateKey > dateTo) return false

    if (refQ) {
      const hay = `${r.quoteRef} ${r.driverName}`.toLowerCase()
      if (!hay.includes(refQ)) return false
    }

    return true
  })
}

function csvCell(v) {
  const s = v == null ? '' : String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function moneyCsv(n) {
  if (n == null || !Number.isFinite(Number(n))) return ''
  return Number(n).toFixed(2)
}

/**
 * @param {ReturnType<typeof buildDriverPaymentsEvidenceRows>} rows
 */
export function driverPaymentsEvidenceToCsv(rows) {
  const headers = [
    'Job reference',
    'Driver',
    'Customer total',
    'Platform fee',
    'Driver payout',
    'Default payout',
    'Manual override',
    'Override note',
    'Driver deductions',
    'Net payable',
    'Paid to driver',
    'Remaining owed',
    'Paid status',
    'Payment date',
    'Job status',
    'Move date',
    'Completed date',
  ]

  const lines = [headers.join(',')]
  for (const r of rows) {
    lines.push(
      [
        csvCell(r.quoteRef),
        csvCell(r.driverName),
        moneyCsv(r.customerTotal),
        moneyCsv(r.platformFee),
        moneyCsv(r.driverPayout),
        moneyCsv(r.defaultDriverPayout),
        r.manualPayoutOverride ? 'Yes' : 'No',
        csvCell(r.payoutOverrideNote),
        moneyCsv(r.driverDeductions),
        moneyCsv(r.netPayable),
        moneyCsv(r.paidToDriver),
        moneyCsv(r.remainingOwed),
        csvCell(r.driverPaidStatus),
        csvCell(r.driverPaymentDateDisplay),
        csvCell(r.jobStatus),
        csvCell(r.moveDateDisplay),
        csvCell(r.completedDateDisplay),
      ].join(','),
    )
  }

  return lines.join('\n')
}

export function downloadDriverPaymentsEvidenceCsv(rows, filename = 'driver-payments-evidence.csv') {
  const csv = driverPaymentsEvidenceToCsv(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
