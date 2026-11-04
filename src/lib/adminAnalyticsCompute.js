import { analyticsDateRange, quoteInRange, quoteRevenueTimestampMs } from './adminAnalyticsDateRange'
import { startOfDayUK, ukCalendarYmd } from './formatDateDisplay'
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

/** @param {string} ymd */
function ukDayLabel(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number)
  if (!y || !m || !d) return String(ymd)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  })
}

/** @param {string} ym */
function ukMonthLabel(ym) {
  const [y, m] = String(ym).split('-').map(Number)
  if (!y || !m) return String(ym)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    month: 'short',
    year: 'numeric',
  })
}

/** Monday-based week key from a UK calendar date. */
function ukWeekKey(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/**
 * @param {Array<{ quoteId?: string | null }>} driverCharges
 */
function chargesByQuoteId(driverCharges) {
  const chargesByQuote = new Map()
  for (const c of driverCharges || []) {
    const qid = c.quoteId ? String(c.quoteId) : ''
    if (!qid) continue
    if (!chargesByQuote.has(qid)) chargesByQuote.set(qid, [])
    chargesByQuote.get(qid).push(c)
  }
  return chargesByQuote
}

/**
 * @param {Record<string, unknown>[]} quotes
 * @param {Record<string, unknown>[]} jobs
 * @param {Array<Record<string, unknown>>} [driverCharges]
 */
function chargesForQuotes(quotes, driverCharges) {
  const ids = new Set((quotes || []).map((q) => String(q.id)))
  return (driverCharges || []).filter((c) => c.quoteId && ids.has(String(c.quoteId)))
}

export function buildAdminAnalyticsModel(quotes, jobs, driverCharges = []) {
  const scopedCharges = chargesForQuotes(quotes, driverCharges)
  const chargesByQuote = new Map()
  for (const c of scopedCharges) {
    const qid = String(c.quoteId)
    if (!chargesByQuote.has(qid)) chargesByQuote.set(qid, [])
    chargesByQuote.get(qid).push(c)
  }
  const chargeKpis = aggregateDriverChargeKpis(scopedCharges)
  const settlementKpis = aggregateDriverPayoutSettlementKpis(quotes, scopedCharges)
  const paidQuotes = quotes.filter((q) => {
    const ps = String(q.payment_status || '')
    return ps === 'paid' || ps === 'deposit_paid'
  })

  const today = analyticsDateRange('today')
  const week = analyticsDateRange('7d')
  const month = analyticsDateRange('month')

  let totalRevenue = 0
  let collected = 0
  let revenueToday = 0
  let revenueWeek = 0
  let revenueMonth = 0
  let depositRevenue = 0
  let outstandingBalance = 0

  for (const q of paidQuotes) {
    const fin = resolveFinancials(q, quoteAdjustmentsSumGbp(q))
    const rev = fin.customerTotal != null ? fin.customerTotal : fin.paid
    totalRevenue += rev
    collected += fin.paid
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
  const topDriver = driverRows.find((row) => row.name !== 'Unassigned') || driverRows[0]

  return {
    kpis: {
      totalRevenue,
      collected,
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
      if (analyticsServiceName(q) !== filters.service) return false
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
    const ms = quoteRevenueTimestampMs(q)
    if (!ms) continue
    const key = ukCalendarYmd(new Date(ms))
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
      label: ukDayLabel(date),
      ...v,
      totalPayout: v.driverPayout + v.partnerPayout,
    }))
}

/**
 * One row for every UK day in the range, including days with no bookings.
 * @param {ReturnType<typeof buildTimeSeries>} series
 * @param {{ start: Date, end: Date }} range
 */
export function fillDailySeries(series, range) {
  const byDate = new Map(series.map((row) => [row.date, row]))
  /** @type {typeof series} */
  const out = []
  let cursor = startOfDayUK(range.start)
  const end = range.end.getTime()
  while (cursor.getTime() <= end && out.length < 400) {
    const date = ukCalendarYmd(cursor)
    const existing = byDate.get(date)
    out.push(
      existing || {
        date,
        label: ukDayLabel(date),
        revenue: 0,
        driverPayout: 0,
        partnerPayout: 0,
        profit: 0,
        bookings: 0,
        totalPayout: 0,
      },
    )
    const next = startOfDayUK(new Date(cursor.getTime() + 36 * 3600000))
    if (next.getTime() <= cursor.getTime()) break
    cursor = next
  }
  return out
}

/**
 * @param {ReturnType<typeof buildTimeSeries>} daily
 * @param {'day' | 'week' | 'month'} bucket
 */
export function rollupSeries(daily, bucket) {
  if (bucket !== 'week' && bucket !== 'month') return daily
  /** @type {Map<string, { date: string, label: string, revenue: number, driverPayout: number, partnerPayout: number, profit: number, bookings: number, totalPayout: number }>} */
  const map = new Map()
  for (const row of daily) {
    const key = bucket === 'month' ? row.date.slice(0, 7) : ukWeekKey(row.date)
    if (!map.has(key)) {
      map.set(key, {
        date: key,
        label: bucket === 'month' ? ukMonthLabel(key) : `w/c ${row.label}`,
        revenue: 0,
        driverPayout: 0,
        partnerPayout: 0,
        profit: 0,
        bookings: 0,
        totalPayout: 0,
      })
    }
    const acc = map.get(key)
    acc.revenue += row.revenue
    acc.driverPayout += row.driverPayout
    acc.partnerPayout += row.partnerPayout
    acc.profit += row.profit
    acc.bookings += row.bookings
    acc.totalPayout += row.totalPayout
  }
  return [...map.values()]
}

/**
 * @param {Record<string, unknown>[]} filtered
 * @param {Array<{ quoteId?: string | null }>} [driverCharges]
 */
export function buildServiceBreakdown(filtered, driverCharges = []) {
  const chargesByQuote = chargesByQuoteId(driverCharges)
  /** @type {Map<string, { service: string, jobs: number, revenue: number, profit: number }>} */
  const map = new Map()
  for (const q of filtered) {
    const svc = analyticsServiceName(q)
    if (!map.has(svc)) map.set(svc, { service: svc, jobs: 0, revenue: 0, profit: 0 })
    const row = map.get(svc)
    const p = resolveJobPayoutWithDriverCharges(q, chargesByQuote.get(String(q.id)) || [])
    row.jobs += 1
    row.revenue += n(p.customerTotal)
    row.profit += n(p.platformProfitAdjusted ?? p.platformProfit)
  }
  return [...map.values()]
    .map((r) => ({
      ...r,
      avgValue: r.jobs ? r.revenue / r.jobs : 0,
      marginPct: r.revenue > 0 ? Math.round((r.profit / r.revenue) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

const ROUTE_CITIES = [
  'east kilbride',
  'glasgow',
  'edinburgh',
  'aberdeen',
  'dundee',
  'inverness',
  'stirling',
  'perth',
  'paisley',
  'hamilton',
  'motherwell',
  'livingston',
  'falkirk',
  'kirkcaldy',
  'kilmarnock',
  'ayr',
  'dumfries',
]

/** A postcode district or a known town. Streets are not treated as places. */
function placeFromAddress(address) {
  const s = String(address || '').trim()
  if (!s) return '—'
  const postcode = s.match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s*\d[A-Z]{2}\b/i)
  if (postcode) return postcode[1].toUpperCase()
  const lower = s.toLowerCase()
  for (const city of ROUTE_CITIES) {
    if (lower.includes(city)) {
      return city.replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    }
  }
  return '—'
}

/** @param {Record<string, unknown>} q */
export function analyticsServiceName(q) {
  let raw = q?.service
  if (raw == null || String(raw).trim() === '') raw = q?.service_type
  if (raw && typeof raw === 'object') {
    raw = raw.name || raw.label || raw.title || raw.service || ''
  }
  const name = String(raw ?? '').trim()
  if (!name || name === '[object Object]' || name === 'null' || name === 'undefined') return 'Other'
  if (/^(no|n\/a|na|none|review|reviews|hth|test|other)$/i.test(name)) return 'Other'
  if (!/remov|deliver|van|mov|furniture|clearance|assembl|pack|office|student|piano|house/i.test(name)) {
    return 'Other'
  }
  return name
}

/**
 * @param {Record<string, unknown>[]} filtered
 */
export function buildLocationBreakdown(filtered) {
  /** @type {Map<string, { route: string, jobs: number, revenue: number }>} */
  const map = new Map()
  for (const q of filtered) {
    const from = placeFromAddress(q.pickup_address)
    const to = placeFromAddress(q.delivery_address)
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
        service: analyticsServiceName(q),
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
        href:
          q.completed_at || q.cancelled_at || q.assigned_driver_id || q.assigned_at
            ? `/admin/active-jobs/${q.id}`
            : `/admin/available-jobs/${q.id}`,
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
