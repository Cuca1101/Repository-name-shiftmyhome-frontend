import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart3,
  PoundSterling,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Activity,
  PieChart,
} from 'lucide-react'
import { analyticsDateRange } from '../../lib/adminAnalyticsDateRange'
import {
  buildActivityFeed,
  buildAdminAnalyticsModel,
  buildJobProfitabilityRows,
  buildLocationBreakdown,
  buildServiceBreakdown,
  buildTimeSeries,
  enrichDriverEarningsRows,
  filterQuotesForAnalytics,
  money,
} from '../../lib/adminAnalyticsCompute'
import { filterProductionAdminQuotes } from '../../lib/adminProductionFilters'
import { subscribeAdminDataRefresh } from '../../lib/adminDataRefresh'
import { fetchQuotesForAdminAnalytics } from '../../lib/data/adminAnalyticsRepository'
import { fetchAllJobs } from '../../lib/data/jobsRepository'
import { fetchAllDriverCharges } from '../../lib/data/driverChargesRepository'
import { formatDateTimeUK, formatDateUK } from '../../lib/formatDateDisplay'
import { payoutStatusLabel } from '../../lib/jobPayoutAccounting'
import AdminMiniBarChart from './AdminMiniBarChart'

const RANGE_PRESETS = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
  { id: 'month', label: 'This month' },
  { id: 'year', label: 'This year' },
]

const card =
  'rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-5'

/**
 * @param {{ label: string, value: string, sub?: string, icon?: import('react').ReactNode, tone?: string }} props
 */
function KpiCard({ label, value, sub, icon, tone = 'slate' }) {
  const tones = {
    slate: 'text-slate-900',
    emerald: 'text-emerald-800',
    brand: 'text-brand-700',
    violet: 'text-violet-900',
    amber: 'text-amber-900',
  }
  return (
    <div className={card}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
        {icon ? <span className="text-slate-400">{icon}</span> : null}
      </div>
      <p className={`mt-2 text-2xl font-bold tabular-nums tracking-tight ${tones[tone] || tones.slate}`}>
        {value}
      </p>
      {sub ? <p className="mt-1 text-xs text-slate-600">{sub}</p> : null}
    </div>
  )
}

export default function AdminAnalyticsDashboard() {
  const [quotes, setQuotes] = useState([])
  const [jobs, setJobs] = useState([])
  const [driverCharges, setDriverCharges] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rangePreset, setRangePreset] = useState('30d')
  const [driverFilter, setDriverFilter] = useState('')
  const [serviceFilter, setServiceFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [qList, jList, cList] = await Promise.all([
        fetchQuotesForAdminAnalytics(),
        fetchAllJobs(),
        fetchAllDriverCharges(),
      ])
      setQuotes(filterProductionAdminQuotes(qList))
      setJobs(jList)
      setDriverCharges(cList)
    } catch (e) {
      setError(e?.message || 'Failed to load analytics.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => subscribeAdminDataRefresh(load), [load])

  const baseModel = useMemo(
    () => buildAdminAnalyticsModel(quotes, jobs, driverCharges),
    [quotes, jobs, driverCharges],
  )

  const range = useMemo(() => analyticsDateRange(rangePreset), [rangePreset])

  const filtered = useMemo(
    () =>
      filterQuotesForAnalytics(quotes, range, {
        driver: driverFilter || undefined,
        service: serviceFilter || undefined,
        status: statusFilter || undefined,
      }),
    [quotes, range, driverFilter, serviceFilter, statusFilter],
  )

  const series = useMemo(() => buildTimeSeries(filtered, driverCharges), [filtered, driverCharges])
  const serviceRows = useMemo(() => buildServiceBreakdown(filtered), [filtered])
  const locationRows = useMemo(() => buildLocationBreakdown(filtered), [filtered])
  const jobRows = useMemo(
    () => buildJobProfitabilityRows(filtered, 80, driverCharges),
    [filtered, driverCharges],
  )
  const driverRows = useMemo(() => enrichDriverEarningsRows(baseModel.driverRows), [baseModel.driverRows])
  const activity = useMemo(() => buildActivityFeed(quotes), [quotes])

  const driverOptions = useMemo(() => {
    const set = new Set()
    for (const q of quotes) {
      const d = String(q.assigned_driver_name || '').trim()
      const p = String(q.assigned_partner_company || '').trim()
      if (d) set.add(d)
      if (p) set.add(p)
    }
    return [...set].sort()
  }, [quotes])

  const serviceOptions = useMemo(() => {
    const set = new Set()
    for (const q of quotes) {
      const s = String(q.service || q.service_type || '').trim()
      if (s) set.add(s)
    }
    return [...set].sort()
  }, [quotes])

  const chartSlice = useMemo(() => {
    const max = rangePreset === 'today' || rangePreset === '7d' ? 14 : 21
    return series.slice(-max)
  }, [series, rangePreset])

  const bookingStats = useMemo(() => {
    let paid = 0
    let deposit = 0
    let full = 0
    let unpaid = 0
    for (const q of quotes) {
      const ps = String(q.payment_status || '')
      if (ps === 'paid') {
        paid += 1
        full += 1
      } else if (ps === 'deposit_paid') {
        paid += 1
        deposit += 1
      } else unpaid += 1
    }
    return { paid, deposit, full, unpaid, cancelled: baseModel.cancelled.length }
  }, [quotes, baseModel.cancelled.length])

  const { kpis } = baseModel

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-slate-500">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
        Loading analytics…
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-6 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50 to-white px-4 py-4 sm:px-5">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
            <BarChart3 className="h-6 w-6 text-brand-600" aria-hidden />
            Analytics
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Revenue, driver payouts, platform profit, and operations performance. Internal accounting fields
            only — Stripe and customer totals are unchanged.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      <div className={`${card} flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end`}>
        <div className="flex flex-wrap gap-2">
          {RANGE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setRangePreset(p.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                rangePreset === p.id
                  ? 'bg-brand-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <label className="text-sm">
          <span className="text-xs font-semibold uppercase text-slate-500">Driver</span>
          <select
            value={driverFilter}
            onChange={(e) => setDriverFilter(e.target.value)}
            className="mt-1 block min-w-[10rem] rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            {driverOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-xs font-semibold uppercase text-slate-500">Service</span>
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="mt-1 block min-w-[10rem] rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            {serviceOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-xs font-semibold uppercase text-slate-500">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          >
            <option value="">All paid</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total customer revenue"
          value={money(kpis.totalRevenue)}
          icon={<PoundSterling className="h-4 w-4" />}
          tone="brand"
        />
        <KpiCard label="Revenue today" value={money(kpis.revenueToday)} sub="Paid bookings" />
        <KpiCard label="Revenue this week" value={money(kpis.revenueWeek)} />
        <KpiCard label="Revenue this month" value={money(kpis.revenueMonth)} />
        <KpiCard label="Total bookings" value={String(kpis.totalBookings)} icon={<TrendingUp className="h-4 w-4" />} />
        <KpiCard label="Completed jobs" value={String(kpis.completedJobs)} tone="emerald" />
        <KpiCard label="Active jobs" value={String(kpis.activeJobs)} icon={<Truck className="h-4 w-4" />} />
        <KpiCard label="Avg booking value" value={money(kpis.avgBookingValue)} />
        <KpiCard label="Deposit revenue" value={money(kpis.depositRevenue)} tone="amber" />
        <KpiCard label="Outstanding balance" value={money(kpis.outstandingBalance)} tone="amber" />
        <KpiCard
          label="Driver payouts (gross)"
          value={money(kpis.totalDriverPayouts)}
          icon={<Users className="h-4 w-4" />}
        />
        <KpiCard
          label="Net driver payout"
          value={money(kpis.totalDriverPayoutsNet)}
          sub="After deductions"
          tone="emerald"
        />
        <KpiCard
          label="Paid to drivers"
          value={money(kpis.paidToDrivers)}
          sub="Settlement recorded"
          tone="brand"
        />
        <KpiCard
          label="Pending driver payouts"
          value={money(kpis.pendingDriverPayouts)}
          sub="Net minus paid"
          tone="amber"
        />
        <KpiCard label="Partner payouts" value={money(kpis.totalPartnerPayouts)} tone="violet" />
        <KpiCard
          label="Driver charges"
          value={money(kpis.totalDriverCharges)}
          sub={`${kpis.driverChargeCount ?? 0} records · damage ${money(kpis.totalDamageCharges)}`}
          tone="amber"
        />
        <KpiCard
          label="Dealloc / cancel charges"
          value={money(kpis.totalDeallocCancelCharges)}
          tone="amber"
        />
        <KpiCard
          label="Platform gross profit"
          value={money(kpis.platformGrossProfit)}
          icon={<Wallet className="h-4 w-4" />}
        />
        <KpiCard
          label="Adjusted platform profit"
          value={money(kpis.platformAdjustedProfit)}
          sub="Includes recovered driver charges"
          icon={<Wallet className="h-4 w-4" />}
          tone="emerald"
        />
        <KpiCard label="Avg profit / job" value={money(kpis.avgProfitPerJob)} />
        <KpiCard
          label="Top earning driver"
          value={kpis.topDriverName}
          sub={money(kpis.topDriverEarnings)}
          icon={<Users className="h-4 w-4" />}
        />
        <KpiCard label="Awaiting assignment" value={String(kpis.awaitingAssignment)} tone="amber" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={card}>
          <h3 className="text-sm font-bold text-slate-900">Revenue by day</h3>
          <p className="mt-0.5 text-xs text-slate-500">{range.label} · {filtered.length} bookings</p>
          <div className="mt-4">
            <AdminMiniBarChart
              data={chartSlice.map((d) => ({ label: d.label, value: d.revenue }))}
              valueLabel="Revenue"
            />
          </div>
        </div>
        <div className={card}>
          <h3 className="text-sm font-bold text-slate-900">Revenue vs payouts</h3>
          <div className="mt-4">
            <AdminMiniBarChart
              data={chartSlice.map((d) => ({
                label: d.label,
                value: d.revenue,
                secondary: d.totalPayout,
              }))}
              valueLabel="Revenue"
              secondaryLabel="Payouts"
            />
          </div>
        </div>
        <div className={card}>
          <h3 className="text-sm font-bold text-slate-900">Profit by day</h3>
          <div className="mt-4">
            <AdminMiniBarChart
              data={chartSlice.map((d) => ({ label: d.label, value: Math.max(0, d.profit) }))}
              valueLabel="Profit"
            />
          </div>
        </div>
        <div className={card}>
          <h3 className="text-sm font-bold text-slate-900">Earnings by driver</h3>
          <div className="mt-4">
            <AdminMiniBarChart
              data={driverRows.slice(0, 8).map((d) => ({ label: d.name.slice(0, 12), value: d.payout }))}
              valueLabel="Paid out"
            />
          </div>
        </div>
      </div>

      <div className={card}>
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <PieChart className="h-4 w-4 text-brand-600" />
          Profit by service
        </h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Service</th>
                <th className="py-2 pr-4">Jobs</th>
                <th className="py-2 pr-4">Revenue</th>
                <th className="py-2 pr-4">Avg value</th>
                <th className="py-2 pr-4">Profit</th>
                <th className="py-2">Margin</th>
              </tr>
            </thead>
            <tbody>
              {serviceRows.map((r) => (
                <tr key={r.service} className="border-b border-slate-50">
                  <td className="py-2 pr-4 font-medium text-slate-900">{r.service}</td>
                  <td className="py-2 pr-4 tabular-nums">{r.jobs}</td>
                  <td className="py-2 pr-4 tabular-nums">{money(r.revenue)}</td>
                  <td className="py-2 pr-4 tabular-nums">{money(r.avgValue)}</td>
                  <td className="py-2 pr-4 tabular-nums text-emerald-800">{money(r.profit)}</td>
                  <td className="py-2 tabular-nums">{r.marginPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={card}>
          <h3 className="text-sm font-bold text-slate-900">Booking analytics</h3>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">Paid bookings</dt>
              <dd className="font-bold text-slate-900">{bookingStats.paid}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Unpaid quotes</dt>
              <dd className="font-bold text-slate-900">{bookingStats.unpaid}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Deposit paid</dt>
              <dd className="font-bold text-slate-900">{bookingStats.deposit}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Fully paid</dt>
              <dd className="font-bold text-slate-900">{bookingStats.full}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Cancelled</dt>
              <dd className="font-bold text-slate-900">{bookingStats.cancelled}</dd>
            </div>
            <div>
              <dt className="text-slate-500">In selected range</dt>
              <dd className="font-bold text-slate-900">{filtered.length}</dd>
            </div>
          </dl>
        </div>
        {locationRows.length > 0 ? (
          <div className={card}>
            <h3 className="text-sm font-bold text-slate-900">Top routes</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {locationRows.map((r) => (
                <li key={r.route} className="flex justify-between gap-2 border-b border-slate-50 pb-2">
                  <span className="min-w-0 truncate font-medium text-slate-800">{r.route}</span>
                  <span className="shrink-0 tabular-nums text-slate-600">
                    {r.jobs} · {money(r.avgValue)} avg
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className={card}>
        <h3 className="text-sm font-bold text-slate-900">Driver earnings</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Driver / partner</th>
                <th className="py-2 pr-3">Completed</th>
                <th className="py-2 pr-3">Active</th>
                <th className="py-2 pr-3">Jobs</th>
                <th className="py-2 pr-3">Revenue</th>
                <th className="py-2 pr-3">Paid out</th>
                <th className="py-2 pr-3">Avg payout</th>
                <th className="py-2 pr-3">Platform profit</th>
                <th className="py-2">Completion</th>
              </tr>
            </thead>
            <tbody>
              {driverRows.map((d) => (
                <tr key={d.name} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="py-2 pr-3 font-semibold text-slate-900">{d.name}</td>
                  <td className="py-2 pr-3 tabular-nums">{d.completed}</td>
                  <td className="py-2 pr-3 tabular-nums">{d.active}</td>
                  <td className="py-2 pr-3 tabular-nums">{d.jobs}</td>
                  <td className="py-2 pr-3 tabular-nums">{money(d.revenue)}</td>
                  <td className="py-2 pr-3 tabular-nums">{money(d.payout)}</td>
                  <td className="py-2 pr-3 tabular-nums">{money(d.avgPayout)}</td>
                  <td className="py-2 pr-3 tabular-nums text-emerald-800">{money(d.profit)}</td>
                  <td className="py-2 tabular-nums">{d.completionRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={card}>
        <h3 className="text-sm font-bold text-slate-900">Job profitability</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-2">Ref</th>
                <th className="py-2 pr-2">Customer</th>
                <th className="py-2 pr-2">Move</th>
                <th className="py-2 pr-2">Service</th>
                <th className="py-2 pr-2">Driver</th>
                <th className="py-2 pr-2">Total</th>
                <th className="py-2 pr-2">Driver £</th>
                <th className="py-2 pr-2">Partner £</th>
                <th className="py-2 pr-2">Profit</th>
                <th className="py-2 pr-2">Margin</th>
                <th className="py-2 pr-2">Payout</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {jobRows.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="py-2 pr-2">
                    <Link
                      to={`/admin/available-jobs/${r.id}`}
                      className="font-mono text-xs font-semibold text-brand-700 hover:underline"
                    >
                      {r.quoteRef}
                    </Link>
                  </td>
                  <td className="max-w-[8rem] truncate py-2 pr-2">{r.customerName}</td>
                  <td className="whitespace-nowrap py-2 pr-2 text-xs">
                    {r.moveDate !== '—' ? formatDateUK(r.moveDate) : '—'}
                  </td>
                  <td className="max-w-[6rem] truncate py-2 pr-2 text-xs">{r.service}</td>
                  <td className="max-w-[7rem] truncate py-2 pr-2 text-xs">
                    {r.driverName}
                    {r.partnerName ? ` / ${r.partnerName}` : ''}
                  </td>
                  <td className="py-2 pr-2 tabular-nums font-medium">
                    {r.customerTotal != null ? money(r.customerTotal) : '—'}
                  </td>
                  <td className="py-2 pr-2 tabular-nums">
                    {r.driverPayout != null ? money(r.driverPayout) : '—'}
                  </td>
                  <td className="py-2 pr-2 tabular-nums">
                    {r.partnerPayout != null ? money(r.partnerPayout) : '—'}
                  </td>
                  <td className="py-2 pr-2 tabular-nums text-emerald-800">
                    {r.platformProfit != null ? money(r.platformProfit) : '—'}
                    {r.payoutMissing ? (
                      <span className="ml-1 text-[10px] text-amber-700">!</span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-2 tabular-nums">
                    {r.marginPct != null ? `${r.marginPct}%` : '—'}
                  </td>
                  <td className="py-2 pr-2 text-xs">{payoutStatusLabel(r.payoutStatus)}</td>
                  <td className="py-2 text-xs text-slate-600">{r.jobStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={card}>
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <Activity className="h-4 w-4 text-brand-600" />
          Live activity
        </h3>
        <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">
          {activity.map((ev) => (
            <li
              key={`${ev.type}-${ev.at}-${ev.quoteId}`}
              className="flex gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{ev.title}</p>
                <p className="truncate text-xs text-slate-600">{ev.detail}</p>
              </div>
              <time className="shrink-0 text-[10px] text-slate-500">
                {formatDateTimeUK(ev.at).replace(', ', ' ')}
              </time>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
