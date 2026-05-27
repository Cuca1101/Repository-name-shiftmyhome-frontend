import { analyticsDateRange, quoteInRange, quoteRevenueTimestampMs } from './adminAnalyticsDateRange'
import {
  filterActiveQuotes,
  filterCancelledQuotes,
  filterCompletedQuotes,
  quoteIsCancelled,
  quoteIsCompleted,
} from './adminWorkflowFilters'
import { quotePassesAvailableJobsStrict } from './adminJobListRules'
import { quoteVisibleInAdminLists } from './adminProductionFilters'
import { resolveJobPayoutAccounting } from './jobPayoutAccounting'
import { resolveJobPayoutWithDriverCharges } from './driverChargeAccounting'
import { aggregateDriverChargeKpis } from './driverPaymentsModel'
import { aggregateDriverPayoutSettlementKpis } from './driverPayoutSettlement'
import { resolveFinancials } from './quoteJobAdminModel'
import { quoteAdjustmentsSumGbp } from './marketplaceQuoteFinance'

/** @param {unknown} n */
function n(v) {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

/** @param {number} v */
function money(v) {
  return `£${v.toFixed(2)}`
}

/**
 * @param {Record<string, unknown>[]} quotes
 * @param {Record<string, unknown>[]} jobs
 * @param {Array<Record<string, unknown>>} [driverCharges]
 */
export function buildAdminAnalyticsModel(quotes, jobs, driverCharges = []) {
  const chargesByQuote = new Map()
  for (const c of driverCharges || []) {
    const qid = c.quoteId
    if (!qid) continue
    if (!chargesByQuote.has(qid)) chargesByQuote.set(qid, [])
    chargesByQuote.get(qid).push(c)
  }
  const chargeKpis = aggregateDriverChargeKpis(driverCharges)
  const settlementKpis = aggregateDriverPayoutSettlementKpis(quotes, driverCharges)
  const paidQuotes = quotes.filter((q) => {
    const ps = String(q.payment_status || '')
    return ps === 'paid' || ps === 'deposit_paid'
  })

  const today = analyticsDateRange('today')
  const week = analyticsDateRange('7d')
  const month = analyticsDateRange('month')

  let totalRevenue = 0
  let revenueToday = 0
  let revenueWeek = 0
  let revenueMonth = 0
  let depositRevenue = 0
  let outstandingBalance = 0

  for (const q of paidQuotes) {
    const fin = resolveFinancials(q, quoteAdjustmentsSumGbp(q))
    const rev = fin.customerTotal != null ? fin.customerTotal : fin.paid
    totalRevenue += rev
    outstandingBalance += n(fin.remaining)
    if (String(q.payment_status) === 'deposit_paid') depositRevenue += fin.paid
    if (quoteInRange(q, today.start, today.end)) revenueToday += rev
    if (quoteInRange(q, week.start, week.end)) revenueWeek += rev
    if (quoteInRange(q, month.start, month.end)) revenueMonth += rev
  }

  const completed = filterCompletedQuotes(quotes, jobs)
  const active = filterActiveQuotes(quotes, jobs)
  const cancelled = filterCancelledQuotes(quotes, jobs)
  const awaiting = quotes.filter(quotePassesAvailableJobsStrict)

  let totalDriverPayoutsGross = 0
  let totalPartnerPayouts = 0
  let platformGrossProfit = 0
  let platformAdjustedProfit = 0
  let profitJobCount = 0
  let netDriverPayouts = 0

  for (const q of paidQuotes) {
    const qCharges = chargesByQuote.get(String(q.id)) || []
    const p = resolveJobPayoutWithDriverCharges(q, qCharges)
    if (p.driverPayoutGross != null) totalDriverPayoutsGross += p.driverPayoutGross
    if (p.driverPayoutNet != null) netDriverPayouts += p.driverPayoutNet
    if (p.partnerPayout != null) totalPartnerPayouts += p.partnerPayout
    if (p.platformProfitGross != null) platformGrossProfit += p.platformProfitGross
    if (p.platformProfitAdjusted != null) {
      platformAdjustedProfit += p.platformProfitAdjusted
      profitJobCount += 1
    }
  }

  const avgBooking = paidQuotes.length ? totalRevenue / paidQuotes.length : 0
  const avgProfit = profitJobCount ? platformAdjustedProfit / profitJobCount : 0

  /** @type {Map<string, { name: string, jobs: number, revenue: number, payout: number, profit: number, completed: number, active: number }>} */
  const byDriver = new Map()

  for (const q of paidQuotes) {
    const qCharges = chargesByQuote.get(String(q.id)) || []
    const p = resolveJobPayoutWithDriverCharges(q, qCharges)
    const name = p.driverName || p.partnerName || 'Unassigned'
    if (!byDriver.has(name)) {
      byDriver.set(name, { name, jobs: 0, revenue: 0, payout: 0, profit: 0, completed: 0, active: 0 })
    }
    const row = byDriver.get(name)
    row.jobs += 1
    row.revenue += n(p.customerTotal)
    row.payout += n(p.driverPayoutNet ?? p.driverPayout) + n(p.partnerPayout)
    row.profit += n(p.platformProfitAdjusted ?? p.platformProfit)
    const linkedJob = jobs.find((j) => String(j.quote_ref) === String(q.quote_ref))
    if (quoteIsCompleted(q, linkedJob ?? null)) row.completed += 1
    if (active.some((a) => String(a.id) === String(q.id))) row.active += 1
  }

  const driverRows = [...byDriver.values()].sort((a, b) => b.payout - a.payout)
  const topDriver = driverRows[0]

  return {
    kpis: {
      totalRevenue,
      revenueToday,
      revenueWeek,
      revenueMonth,
      totalBookings: paidQuotes.length,
      completedJobs: completed.length,
      activeJobs: active.length,
      avgBookingValue: avgBooking,
      depositRevenue,
      outstandingBalance,
      totalDriverPayouts: totalDriverPayoutsGross,
      totalDriverPayoutsNet: netDriverPayouts,
      totalPartnerPayouts,
      platformGrossProfit,
      platformAdjustedProfit,
      totalDriverCharges: chargeKpis.totalDriverCharges,
      totalDamageCharges: chargeKpis.totalDamageCharges,
      totalDeallocCancelCharges: chargeKpis.totalDeallocCancelCharges,
      driverChargeCount: chargeKpis.chargeCount,
      paidToDrivers: settlementKpis.paidToDrivers,
      pendingDriverPayouts: settlementKpis.pendingDriverPayouts,
      avgProfitPerJob: avgProfit,
      topDriverName: topDriver?.name || '—',
      topDriverEarnings: topDriver?.payout ?? 0,
      awaitingAssignment: awaiting.length,
      cancelledJobs: cancelled.length,
    },
    paidQuotes,
    completed,
    active,
    cancelled,
    driverRows,
  }
}

/**
 * @param {Record<string, unknown>[]} quotes
 * @param {{ start: Date, end: Date }} range
 * @param {{ driver?: string, service?: string, status?: string }} filters
 */
export function filterQuotesForAnalytics(quotes, range, filters = {}) {
  return quotes.filter((q) => {
    if (!quoteVisibleInAdminLists(q)) return false
    if (!quoteInRange(q, range.start, range.end)) return false
    const ps = String(q.payment_status || '')
    if (ps !== 'paid' && ps !== 'deposit_paid') return false
    if (filters.driver) {
      const d = String(q.assigned_driver_name || '').trim()
      const p = String(q.assigned_partner_company || '').trim()
      if (d !== filters.driver && p !== filters.driver) return false
    }
    if (filters.service) {
      const svc = String(q.service || q.service_type || '').trim()
      if (svc !== filters.service) return false
    }
    if (filters.status === 'completed' && !q.completed_at) return false
    if (filters.status === 'cancelled' && !q.cancelled_at) return false
    if (filters.status === 'active' && (q.completed_at || q.cancelled_at)) return false
    return true
  })
}

/**
 * @param {Record<string, unknown>[]} filtered
 * @param {Array<{ quoteId?: string | null }>} [driverCharges]
 */
export function buildTimeSeries(filtered, driverCharges = []) {
  const chargesByQuote = new Map()
  for (const c of driverCharges || []) {
    const qid = c.quoteId
    if (!qid) continue
    if (!chargesByQuote.has(qid)) chargesByQuote.set(qid, [])
    chargesByQuote.get(qid).push(c)
  }

  /** @type {Map<string, { revenue: number, driverPayout: number, partnerPayout: number, profit: number, bookings: number }>} */
  const days = new Map()

  for (const q of filtered) {
    const t = new Date(quoteRevenueTimestampMs(q))
    const key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
    if (!days.has(key)) {
      days.set(key, { revenue: 0, driverPayout: 0, partnerPayout: 0, profit: 0, bookings: 0 })
    }
    const row = days.get(key)
    const qCharges = chargesByQuote.get(String(q.id)) || []
    const p = resolveJobPayoutWithDriverCharges(q, qCharges)
    row.bookings += 1
    row.revenue += n(p.customerTotal)
    if (p.driverPayoutNet != null) row.driverPayout += p.driverPayoutNet
    else if (p.driverPayout != null) row.driverPayout += p.driverPayout
    if (p.partnerPayout != null) row.partnerPayout += p.partnerPayout
    const profit = p.platformProfitAdjusted ?? p.platformProfit
    if (profit != null) row.profit += profit
  }

  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      label: date.slice(5).replace('-', '/'),
      ...v,
      totalPayout: v.driverPayout + v.partnerPayout,
    }))
}

/**
 * @param {Record<string, unknown>[]} filtered
 */
export function buildServiceBreakdown(filtered) {
  /** @type {Map<string, { service: string, jobs: number, revenue: number, profit: number }>} */
  const map = new Map()
  for (const q of filtered) {
    const svc = String(q.service || q.service_type || 'Other').trim() || 'Other'
    if (!map.has(svc)) map.set(svc, { service: svc, jobs: 0, revenue: 0, profit: 0 })
    const row = map.get(svc)
    const p = resolveJobPayoutAccounting(q)
    row.jobs += 1
    row.revenue += n(p.customerTotal)
    row.profit += n(p.platformProfit)
  }
  return [...map.values()]
    .map((r) => ({
      ...r,
      avgValue: r.jobs ? r.revenue / r.jobs : 0,
      marginPct: r.revenue > 0 ? Math.round((r.profit / r.revenue) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

/** @param {unknown} address */
function cityFromAddress(address) {
  const s = String(address || '').trim()
  if (!s) return '—'
  const parts = s.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const candidate = parts[parts.length - 2]
    if (candidate && !/^[A-Z]{1,2}\d/i.test(candidate)) return candidate
  }
  return parts[0] || '—'
}

/**
 * @param {Record<string, unknown>[]} filtered
 */
export function buildLocationBreakdown(filtered) {
  /** @type {Map<string, { route: string, jobs: number, revenue: number }>} */
  const map = new Map()
  for (const q of filtered) {
    const from = cityFromAddress(q.pickup_address)
    const to = cityFromAddress(q.delivery_address)
    if (from === '—' && to === '—') continue
    const route = `${from} → ${to}`
    if (!map.has(route)) map.set(route, { route, jobs: 0, revenue: 0 })
    const row = map.get(route)
    const p = resolveJobPayoutAccounting(q)
    row.jobs += 1
    row.revenue += n(p.customerTotal)
  }
  return [...map.values()]
    .map((r) => ({ ...r, avgValue: r.jobs ? r.revenue / r.jobs : 0 }))
    .sort((a, b) => b.jobs - a.jobs)
    .slice(0, 12)
}

/**
 * @param {Record<string, unknown>[]} quotes
 */
export function buildActivityFeed(quotes) {
  /** @type {{ at: string, ms: number, type: string, title: string, detail: string, quoteId: string }[]} */
  const items = []

  for (const q of quotes) {
    const id = String(q.id)
    const ref = String(q.quote_ref || id.slice(0, 8))
    const name = String(q.full_name || '').trim()

    if (q.paid_at) {
      items.push({
        at: String(q.paid_at),
        ms: new Date(String(q.paid_at)).getTime(),
        type: 'payment',
        title: 'Payment received',
        detail: `${ref}${name ? ` · ${name}` : ''}`,
        quoteId: id,
      })
    }
    if (q.assigned_at) {
      items.push({
        at: String(q.assigned_at),
        ms: new Date(String(q.assigned_at)).getTime(),
        type: 'assigned',
        title: 'Job assigned',
        detail: `${ref} · ${q.assigned_driver_name || q.assigned_partner_company || 'Assignee'}`,
        quoteId: id,
      })
    }
    if (q.completed_at) {
      items.push({
        at: String(q.completed_at),
        ms: new Date(String(q.completed_at)).getTime(),
        type: 'completed',
        title: 'Job completed',
        detail: ref,
        quoteId: id,
      })
    }
    const marketplaceAt =
      (q.payout_updated_at && String(q.payout_updated_at)) ||
      (q.paid_at && String(q.paid_at)) ||
      (q.created_at && String(q.created_at)) ||
      ''
    if (q.marketplace_visibility === 'visible_in_marketplace' && marketplaceAt) {
      items.push({
        at: marketplaceAt,
        ms: new Date(marketplaceAt).getTime(),
        type: 'marketplace',
        title: 'Sent to marketplace',
        detail: ref,
        quoteId: id,
      })
    }
    if (q.payout_updated_at) {
      items.push({
        at: String(q.payout_updated_at),
        ms: new Date(String(q.payout_updated_at)).getTime(),
        type: 'payout',
        title: 'Payout updated',
        detail: `${ref} · ${String(q.payout_status || 'not_set').replace(/_/g, ' ')}`,
        quoteId: id,
      })
    }
  }

  return items.sort((a, b) => b.ms - a.ms).slice(0, 40)
}

/**
 * @param {Record<string, unknown>[]} filtered
 * @param {number} [limit]
 * @param {Array<{ quoteId?: string | null }>} [driverCharges]
 */
export function buildJobProfitabilityRows(filtered, limit = 80, driverCharges = []) {
  const chargesByQuote = new Map()
  for (const c of driverCharges || []) {
    const qid = c.quoteId
    if (!qid) continue
    if (!chargesByQuote.has(qid)) chargesByQuote.set(qid, [])
    chargesByQuote.get(qid).push(c)
  }

  return filtered
    .map((q) => {
      const qCharges = chargesByQuote.get(String(q.id)) || []
      const p = resolveJobPayoutWithDriverCharges(q, qCharges)
      return {
        id: String(q.id),
        quoteRef: String(q.quote_ref || '—'),
        customerName: String(q.full_name || '—'),
        moveDate: q.move_date ? String(q.move_date) : '—',
        service: String(q.service || q.service_type || '—'),
        driverName: p.driverName || '—',
        partnerName: p.partnerName || '',
        customerTotal: p.customerTotal,
        driverPayout: p.driverPayoutNet ?? p.driverPayout,
        driverPayoutGross: p.driverPayoutGross,
        driverDeductions: p.driverDeductions,
        partnerPayout: p.partnerPayout,
        platformProfit: p.platformProfitAdjusted ?? p.platformProfit,
        platformProfitGross: p.platformProfitGross,
        marginPct: p.marginPct,
        payoutStatus: p.payoutStatus,
        payoutMissing: p.payoutMissing,
        payoutIsEstimate: p.payoutIsEstimate === true,
        jobStatus: String(q.operational_status || q.status || '—'),
      }
    })
    .sort((a, b) => n(b.customerTotal) - n(a.customerTotal))
    .slice(0, limit)
}

/**
 * @param {typeof buildAdminAnalyticsModel extends (...args: any) => infer R ? R['driverRows'] : never} driverRows
 */
export function enrichDriverEarningsRows(driverRows) {
  return driverRows.map((d) => ({
    ...d,
    avgPayout: d.jobs ? d.payout / d.jobs : 0,
    completionRate: d.jobs ? Math.round((d.completed / d.jobs) * 100) : 0,
  }))
}

export { money, n }
