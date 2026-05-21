import { sumDeductibleDriverCharges, quotePayrollTimestamp, isoWeekKey, roundMoney } from './driverChargeAccounting'
import { isDriverChargeDeductible, driverChargeTypeLabel } from './driverChargeConstants'
import { resolveDriverPayoutSettlement } from './driverPayoutSettlement'
import { findLinkedJobForQuote } from './adminWorkflowFilters'

/**
 * @param {Record<string, unknown>[]} quotes
 * @param {ReturnType<import('./data/driverChargesRepository.js').mapChargeRow>[]} charges
 * @param {ReturnType<import('./data/driversRepository.js').fleetDriverToAdminRecord>[]} drivers
 */
export function buildDriverPaymentsOverview(quotes, charges, drivers) {
  /** @type {Map<string, ReturnType<typeof import('./data/driverChargesRepository.js').mapChargeRow>[]>} */
  const chargesByDriver = new Map()
  /** @type {Map<string, ReturnType<typeof import('./data/driverChargesRepository.js').mapChargeRow>[]>} */
  const chargesByQuote = new Map()

  for (const c of charges) {
    const did = c.driverId
    if (!chargesByDriver.has(did)) chargesByDriver.set(did, [])
    chargesByDriver.get(did).push(c)
    if (c.quoteId) {
      if (!chargesByQuote.has(c.quoteId)) chargesByQuote.set(c.quoteId, [])
      chargesByQuote.get(c.quoteId).push(c)
    }
  }

  /** @type {Map<string, { driverId: string, driverName: string, gross: number, deductions: number, net: number, paid: number, pending: number, jobs: number, chargeCount: number }>} */
  const byDriverId = new Map()

  for (const d of drivers) {
    byDriverId.set(String(d.id), {
      driverId: String(d.id),
      driverName: d.name || 'Driver',
      gross: 0,
      deductions: 0,
      net: 0,
      paid: 0,
      pending: 0,
      jobs: 0,
      chargeCount: 0,
    })
  }

  /** @type {Array<Record<string, unknown>>} */
  const jobRows = []

  for (const q of quotes) {
    const ps = String(q.payment_status || '')
    if (ps !== 'paid' && ps !== 'deposit_paid') continue

    const driverId = q.assigned_driver_id != null ? String(q.assigned_driver_id) : ''
    const driverName = String(q.assigned_driver_name || '').trim()
    if (!driverId && !driverName) continue

    const qCharges = chargesByQuote.get(String(q.id)) || []
    const p = resolveDriverPayoutSettlement(q, qCharges)
    const gross = p.driverPayoutGross ?? p.driverPayout
    if (gross == null) continue

    const ded = p.driverDeductions ?? sumDeductibleDriverCharges(qCharges)
    const net = p.driverPayoutNet ?? roundMoney(Math.max(0, gross - ded))
    const paid = p.payoutPaidAmount ?? 0
    const remaining = p.payoutRemainingBalance ?? roundMoney(Math.max(0, net - paid))

    jobRows.push({
      quote: q,
      payout: p,
      charges: qCharges,
      gross,
      deductions: ded,
      net,
      paid,
      remaining,
      settlementStatus: p.payoutSettlementStatus,
    })

    let bucket = driverId ? byDriverId.get(driverId) : null
    if (!bucket && driverName) {
      for (const [, row] of byDriverId) {
        if (row.driverName.toLowerCase() === driverName.toLowerCase()) {
          bucket = row
          break
        }
      }
    }
    if (!bucket) {
      bucket = {
        driverId: driverId || `name:${driverName}`,
        driverName: driverName || 'Driver',
        gross: 0,
        deductions: 0,
        net: 0,
        paid: 0,
        pending: 0,
        jobs: 0,
        chargeCount: 0,
      }
      byDriverId.set(bucket.driverId, bucket)
    }
    bucket.gross += gross
    bucket.deductions += ded
    bucket.net += net
    bucket.paid += paid
    bucket.pending += remaining
    bucket.jobs += 1
    bucket.chargeCount += qCharges.filter((c) => isDriverChargeDeductible(c.status)).length
  }

  for (const [did, list] of chargesByDriver) {
    const row = byDriverId.get(did)
    if (!row) continue
    const orphanDed = sumDeductibleDriverCharges(
      list.filter((c) => !c.quoteId || !quotes.some((q) => String(q.id) === c.quoteId)),
    )
    if (orphanDed > 0) {
      row.deductions += orphanDed
      row.net = roundMoney(Math.max(0, row.gross - row.deductions))
      row.pending = roundMoney(Math.max(0, row.net - row.paid))
    }
  }

  const driverSummaries = [...byDriverId.values()]
    .filter((r) => r.gross > 0 || r.deductions > 0)
    .sort((a, b) => b.net - a.net)

  return { driverSummaries, jobRows, chargesByQuote, chargesByDriver }
}

/**
 * @param {Record<string, unknown>[]} quotes
 * @param {ReturnType<import('./data/driverChargesRepository.js').mapChargeRow>[]} charges
 * @param {string} driverId
 */
export function buildDriverWeeklyEarnings(quotes, charges, driverId) {
  const did = String(driverId || '')
  /** @type {Map<string, { weekKey: string, gross: number, deductions: number, net: number, paid: number, pending: number, jobs: unknown[] }>} */
  const weeks = new Map()

  const driverQuotes = quotes.filter((q) => String(q.assigned_driver_id || '') === did)
  const chargesByQuote = new Map()
  for (const c of charges.filter((ch) => ch.driverId === did)) {
    if (c.quoteId) {
      if (!chargesByQuote.has(c.quoteId)) chargesByQuote.set(c.quoteId, [])
      chargesByQuote.get(c.quoteId).push(c)
    }
  }

  for (const q of driverQuotes) {
    const ps = String(q.payment_status || '')
    if (ps !== 'paid' && ps !== 'deposit_paid') continue
    const qCharges = chargesByQuote.get(String(q.id)) || []
    const p = resolveDriverPayoutSettlement(q, qCharges)
    const gross = p.driverPayoutGross ?? p.driverPayout
    if (gross == null) continue

    const ts = quotePayrollTimestamp(q)
    const wk = isoWeekKey(new Date(ts))
    if (!weeks.has(wk)) {
      weeks.set(wk, { weekKey: wk, gross: 0, deductions: 0, net: 0, paid: 0, pending: 0, jobs: [] })
    }
    const row = weeks.get(wk)
    const ded = p.driverDeductions ?? sumDeductibleDriverCharges(qCharges)
    const net = p.driverPayoutNet ?? roundMoney(Math.max(0, gross - ded))
    const paid = p.payoutPaidAmount ?? 0
    const remaining = p.payoutRemainingBalance ?? roundMoney(Math.max(0, net - paid))
    row.gross += gross
    row.deductions += ded
    row.net += net
    row.paid += paid
    row.pending += remaining
    row.jobs.push({
      quoteId: String(q.id),
      quoteRef: String(q.quote_ref || '—'),
      quote: q,
      gross,
      deductions: ded,
      net,
      paid,
      remaining,
      settlementStatus: p.payoutSettlementStatus,
      charges: qCharges,
    })
  }

  return [...weeks.values()].sort((a, b) => b.weekKey.localeCompare(a.weekKey))
}

/**
 * Analytics aggregates from charges.
 * @param {ReturnType<import('./data/driverChargesRepository.js').mapChargeRow>[]} charges
 */
export function aggregateDriverChargeKpis(charges) {
  let total = 0
  let damage = 0
  let deallocCancel = 0
  let deductibleCount = 0

  for (const c of charges) {
    if (!isDriverChargeDeductible(c.status)) continue
    const a = Number(c.amount) || 0
    total += a
    deductibleCount += 1
    const t = String(c.chargeType)
    if (t === 'damage') damage += a
    if (t === 'deallocation' || t === 'cancellation' || t === 'no_show') deallocCancel += a
  }

  return {
    totalDriverCharges: roundMoney(total),
    totalDamageCharges: roundMoney(damage),
    totalDeallocCancelCharges: roundMoney(deallocCancel),
    chargeCount: deductibleCount,
  }
}

export { driverChargeTypeLabel }
