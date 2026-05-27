import { roundMoney } from './driverChargeAccounting'
import { isDriverChargeDeductible } from './driverChargeConstants'
import { buildDriverPaymentsEvidenceRows } from './driverPaymentsEvidence'
import { recordDriverPayoutPayment } from './driverPayoutSettlement'
import { buildLatestManualPayoutAuditByQuoteId } from './data/driverPayoutAuditRepository'

function n(v) {
  return Number(v) || 0
}

/**
 * @param {ReturnType<typeof buildDriverPaymentsEvidenceRows>} jobRows
 * @param {ReturnType<import('./data/driverChargesRepository.js').mapChargeRow>[]} charges
 */
export function computeDriverPaymentsPlatformTotals(jobRows, charges = []) {
  let totalCustomerRevenue = 0
  let totalDriverPayouts = 0
  let totalPlatformProfit = 0
  let paidToDrivers = 0
  let pendingDriverPayouts = 0

  for (const r of jobRows) {
    if (r.customerTotal != null) totalCustomerRevenue += n(r.customerTotal)
    if (r.driverPayout != null) totalDriverPayouts += n(r.driverPayout)
    if (r.platformProfit != null) totalPlatformProfit += n(r.platformProfit)
    paidToDrivers += n(r.paidToDriver)
    if (r.remainingOwed != null) pendingDriverPayouts += n(r.remainingOwed)
  }

  let activeCharges = 0
  let activeChargeCount = 0
  for (const c of charges) {
    if (!isDriverChargeDeductible(c.status)) continue
    activeCharges += n(c.amount)
    activeChargeCount += 1
  }

  return {
    totalCustomerRevenue: roundMoney(totalCustomerRevenue),
    totalDriverPayouts: roundMoney(totalDriverPayouts),
    totalPlatformProfit: roundMoney(totalPlatformProfit),
    paidToDrivers: roundMoney(paidToDrivers),
    pendingDriverPayouts: roundMoney(pendingDriverPayouts),
    activeCharges: roundMoney(activeCharges),
    activeChargeCount,
    jobCount: jobRows.length,
  }
}

/**
 * @param {{
 *   drivers: Array<{ id: string, name?: string, phone?: string, email?: string }>,
 *   jobRows: ReturnType<typeof buildDriverPaymentsEvidenceRows>,
 *   auditLogs?: ReturnType<import('./data/driverPayoutAuditRepository.js').mapAuditRow extends Function ? never : unknown>[],
 * }} input
 */
export function buildDriverPaymentsLedger({ drivers, jobRows, auditLogs = [] }) {
  const safeDrivers = Array.isArray(drivers) ? drivers : []
  const safeJobRows = Array.isArray(jobRows) ? jobRows : []
  const safeAuditLogs = Array.isArray(auditLogs) ? auditLogs : []
  const auditsByQuoteId = buildLatestManualPayoutAuditByQuoteId(safeAuditLogs)

  function enrichJobsWithAudit(jobs) {
    if (!Array.isArray(jobs)) return []
    return jobs.map((j) => ({
      ...j,
      latestPayoutAudit: j?.quoteId ? auditsByQuoteId.get(String(j.quoteId)) || null : null,
    }))
  }

  /** @type {Map<string, ReturnType<typeof buildDriverPaymentsEvidenceRows>>} */
  const jobsByDriverKey = new Map()

  for (const row of safeJobRows) {
    const key = row.driverId || `name:${String(row.driverName).toLowerCase()}`
    if (!jobsByDriverKey.has(key)) jobsByDriverKey.set(key, [])
    jobsByDriverKey.get(key).push(row)
  }

  /** @type {Map<string, typeof safeAuditLogs>} */
  const auditsByDriver = new Map()
  for (const a of safeAuditLogs) {
    if (!a || typeof a !== 'object') continue
    const key = a.driverId || `name:${String(a.driverName || '').toLowerCase()}`
    if (!auditsByDriver.has(key)) auditsByDriver.set(key, [])
    auditsByDriver.get(key).push(a)
  }

  /** @type {Set<string>} */
  const seenKeys = new Set()

  function aggregateJobs(jobs) {
    let customerRevenue = 0
    let grossDriverPayout = 0
    let deductions = 0
    let netPayable = 0
    let paid = 0
    let remaining = 0
    let platformProfit = 0
    for (const j of jobs) {
      customerRevenue += n(j.customerTotal)
      grossDriverPayout += n(j.driverPayout)
      deductions += n(j.driverDeductions)
      netPayable += n(j.netPayable)
      paid += n(j.paidToDriver)
      remaining += n(j.remainingOwed)
      platformProfit += n(j.platformProfit)
    }
    return {
      customerRevenue: roundMoney(customerRevenue),
      grossDriverPayout: roundMoney(grossDriverPayout),
      deductions: roundMoney(deductions),
      netPayable: roundMoney(netPayable),
      paid: roundMoney(paid),
      remaining: roundMoney(remaining),
      platformProfit: roundMoney(platformProfit),
    }
  }

  /** @type {Array<Record<string, unknown>>} */
  const driverLedgers = []

  for (const d of drivers) {
    const key = String(d.id)
    seenKeys.add(key)
    const jobs = enrichJobsWithAudit(jobsByDriverKey.get(key) || [])
    const stats = aggregateJobs(jobs)
    driverLedgers.push({
      driverId: key,
      driverName: d.name || 'Driver',
      phone: d.phone ? String(d.phone) : '',
      email: d.email ? String(d.email) : '',
      jobCount: jobs.length,
      ...stats,
      jobs,
      auditLogs: auditsByDriver.get(key) || [],
    })
  }

  for (const [key, rawJobs] of jobsByDriverKey) {
    if (seenKeys.has(key)) continue
    const jobs = enrichJobsWithAudit(rawJobs)
    const first = jobs[0]
    if (!first) continue
    const stats = aggregateJobs(jobs)
    driverLedgers.push({
      driverId: first.driverId || key,
      driverName: first.driverName || 'Driver',
      phone: '',
      email: '',
      jobCount: jobs.length,
      ...stats,
      jobs,
      auditLogs:
        auditsByDriver.get(key) ||
        (first.driverId ? auditsByDriver.get(String(first.driverId)) : []) ||
        auditsByDriver.get(`name:${String(first.driverName).toLowerCase()}`) ||
        [],
    })
    seenKeys.add(key)
  }

  driverLedgers.sort((a, b) => {
    if (b.remaining !== a.remaining) return b.remaining - a.remaining
    return String(a.driverName).localeCompare(String(b.driverName))
  })

  return { drivers: driverLedgers }
}

/**
 * @param {ReturnType<typeof buildDriverPaymentsEvidenceRows>[number][]} jobs
 */
export async function markDriverJobsPaid(jobs, note = 'Bulk driver settlement') {
  for (const j of jobs) {
    if (!j.remainingOwed || j.remainingOwed <= 0.005) continue
    if (j.driverPaidStatusKey === 'paid') continue
    await recordDriverPayoutPayment(j.quoteId, j.quote, j.charges || [], {
      mode: 'full',
      notes: note,
    })
  }
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
 * @param {ReturnType<typeof buildDriverPaymentsLedger>['drivers'][number]} driverLedger
 */
export function driverLedgerJobsToCsv(driverLedger) {
  const headers = [
    'Job reference',
    'Customer',
    'Job date',
    'Status',
    'Customer total',
    'Platform profit',
    'Driver payout',
    'Manual override',
    'Override note',
    'Deductions',
    'Net payable',
    'Paid to driver',
    'Remaining owed',
    'Paid status',
    'Payment date',
  ]
  const lines = [headers.join(',')]
  for (const j of driverLedger.jobs || []) {
    lines.push(
      [
        csvCell(j.quoteRef),
        csvCell(j.customerName),
        csvCell(j.moveDateDisplay),
        csvCell(j.jobStatus),
        moneyCsv(j.customerTotal),
        moneyCsv(j.platformProfit),
        moneyCsv(j.driverPayout),
        j.manualPayoutOverride ? 'Yes' : 'No',
        csvCell(j.payoutOverrideNote),
        moneyCsv(j.driverDeductions),
        moneyCsv(j.netPayable),
        moneyCsv(j.paidToDriver),
        moneyCsv(j.remainingOwed),
        csvCell(j.driverPaidStatus),
        csvCell(j.driverPaymentDateDisplay),
      ].join(','),
    )
  }
  return lines.join('\n')
}

export function downloadCsv(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
