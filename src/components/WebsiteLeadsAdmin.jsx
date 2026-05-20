import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminRecordsSearchRow from './admin/AdminRecordsSearchRow'
import {
  distinctCityRoutesFromLeads,
  fetchWebsiteLeadsForAdmin,
  markRecoveryEmailSent,
  scheduleAbandonedRecoveryForRows,
} from '../lib/data/websiteLeadsRepository'
import { fetchWebsiteEventsForAdmin } from '../lib/data/websiteEventsRepository'
import { eventClickLabel } from '../lib/websiteEventAnalytics'
import {
  computeFunnelKpisFromEvents,
  computeVisitorAnalytics,
  filterQuoteLeadRows,
  filterVisitorAnalyticsEvents,
} from '../lib/websiteLeadAdminDisplay'
import { filterLeadsByRecoveryChip } from '../lib/websiteLeadRecovery'
import { formatDateTimeUK } from '../lib/formatDateDisplay'
import WebsiteLeadsRecoveryPanel, { RecoveryBadge } from './admin/WebsiteLeadsRecoveryPanel'

const LEAD_FILTERS = [
  { id: 'all', label: 'All leads' },
  { id: 'started', label: 'Started Quote' },
  { id: 'abandoned', label: 'Abandoned' },
  { id: 'completed', label: 'Completed Quote' },
  { id: 'payment_started', label: 'Payment Started' },
  { id: 'payment_completed', label: 'Payment Completed' },
]

function statusLabel(status) {
  const map = {
    visited: 'Visitor',
    quote_started: 'Started quote',
    step_completed: 'In progress',
    quote_abandoned: 'Abandoned',
    quote_completed: 'Quote completed',
    payment_started: 'Payment started',
    payment_completed: 'Payment completed',
  }
  return map[status] || status
}

function StatusBadge({ status }) {
  const tone =
    status === 'payment_completed'
      ? 'bg-emerald-100 text-emerald-900 ring-emerald-200'
      : status === 'quote_completed'
        ? 'bg-teal-100 text-teal-900 ring-teal-200'
        : status === 'payment_started'
          ? 'bg-violet-100 text-violet-900 ring-violet-200'
          : status === 'quote_abandoned'
            ? 'bg-amber-100 text-amber-950 ring-amber-200'
            : status === 'quote_started' || status === 'step_completed'
              ? 'bg-sky-100 text-sky-900 ring-sky-200'
              : 'bg-slate-100 text-slate-800 ring-slate-200'
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${tone}`}>
      {statusLabel(status)}
    </span>
  )
}

function money(n) {
  if (n == null || n === '') return '—'
  return `£${Number(n).toFixed(2)}`
}

/**
 * @param {{ label: string, today: number, week: number, month: number }} props
 */
function KpiPeriodCard({ label, today, week, month }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{today}</p>
      <p className="mt-1 text-xs text-slate-600">
        7d: <span className="font-semibold text-slate-800">{week}</span>
        <span className="mx-1 text-slate-300">·</span>
        30d: <span className="font-semibold text-slate-800">{month}</span>
      </p>
    </div>
  )
}

/**
 * @param {{ title: string, description?: string, children: import('react').ReactNode }} props
 */
function AdminSection({ title, description, children }) {
  return (
    <section className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-6">
      <div className="min-w-0 border-b border-slate-200/80 pb-3">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        {description ? <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

function DetailRow({ label, children }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-3 sm:grid-cols-[140px_1fr]">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900">{children ?? '—'}</dd>
    </div>
  )
}

/**
 * @param {{ row: Record<string, unknown> | null, onClose: () => void, onRefresh: () => void }} props
 */
function LeadDetailDrawer({ row, onClose, onRefresh }) {
  const [busy, setBusy] = useState(false)
  if (!row) return null
  const eff = row.effective_status || row.status

  async function sendRecovery() {
    if (!row.id || busy) return
    setBusy(true)
    try {
      await markRecoveryEmailSent(row.id)
      onRefresh()
    } catch (e) {
      window.alert(e?.message || 'Could not mark recovery email sent.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Lead details</h3>
            <p className="mt-0.5 text-xs text-slate-500">Session {String(row.session_id || '').slice(0, 8)}…</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-2">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <StatusBadge status={eff} />
            <RecoveryBadge row={row} />
          </div>
          <div className="mb-4">
            <button
              type="button"
              disabled={busy || row.recovery_email_sent}
              onClick={sendRecovery}
              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              Send recovery email
            </button>
          </div>
          <dl>
            <DetailRow label="Landing page">{row.landing_path}</DetailRow>
            <DetailRow label="Route / city">{row.city_route || '—'}</DetailRow>
            <DetailRow label="Visitor location">
              {[row.city, row.region, row.country].filter(Boolean).join(', ') || '—'}
            </DetailRow>
            <DetailRow label="IP (masked)">{row.ip_masked || '—'}</DetailRow>
            <DetailRow label="Device">
              {[row.device_type, row.browser_name].filter(Boolean).join(' · ') || '—'}
            </DetailRow>
            <DetailRow label="Service">{row.service_type || '—'}</DetailRow>
            <DetailRow label="Step reached">{row.current_step ? `Step ${row.current_step}` : '—'}</DetailRow>
            <DetailRow label="Quote ref">{row.quote_ref || '—'}</DetailRow>
            <DetailRow label="Estimated total">{money(row.estimated_total)}</DetailRow>
            <DetailRow label="Customer name">{row.customer_name}</DetailRow>
            <DetailRow label="Email">{row.customer_email}</DetailRow>
            <DetailRow label="Phone">{row.customer_phone}</DetailRow>
            <DetailRow label="Pickup">{row.pickup_address || row.pickup_postcode}</DetailRow>
            <DetailRow label="Dropoff">{row.delivery_address || row.delivery_postcode}</DetailRow>
            <DetailRow label="Feedback">{row.feedback_reason || row.feedback_notes || '—'}</DetailRow>
            <DetailRow label="Last activity">{formatDateTimeUK(row.last_activity_at)}</DetailRow>
            <DetailRow label="Created">{formatDateTimeUK(row.created_at)}</DetailRow>
            <DetailRow label="Updated">{formatDateTimeUK(row.updated_at)}</DetailRow>
            <DetailRow label="Referrer">
              {row.referrer ? (
                <span className="break-all text-slate-700">{row.referrer}</span>
              ) : (
                '—'
              )}
            </DetailRow>
          </dl>
          {row.quote_id ? (
            <p className="mt-4">
              <Link
                to={`/admin/available-jobs/${row.quote_id}`}
                className="text-sm font-semibold text-brand-700 hover:text-brand-800"
              >
                Open quote in admin →
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function WebsiteLeadsAdmin() {
  const [searchInput, setSearchInput] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [recoveryChip, setRecoveryChip] = useState('')
  const [cityRoute, setCityRoute] = useState('')
  const [rows, setRows] = useState([])
  const [events, setEvents] = useState([])
  const [allQuoteLeads, setAllQuoteLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setActiveSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [list, all, recentEvents] = await Promise.all([
        fetchWebsiteLeadsForAdmin({
          filter,
          cityRoute,
          search: activeSearch,
        }),
        fetchWebsiteLeadsForAdmin({ filter: 'all' }),
        fetchWebsiteEventsForAdmin({
          limit: 2000,
          since: new Date(Date.now() - 30 * 86400000).toISOString(),
        }),
      ])
      const quoteOnly = filterQuoteLeadRows(all)
      await scheduleAbandonedRecoveryForRows(quoteOnly)
      setRows(filterLeadsByRecoveryChip(filterQuoteLeadRows(list), recoveryChip))
      setAllQuoteLeads(quoteOnly)
      setEvents(recentEvents)
    } catch (e) {
      setError(e?.message || 'Failed to load website leads.')
    } finally {
      setLoading(false)
    }
  }, [filter, cityRoute, activeSearch, recoveryChip])

  useEffect(() => {
    load()
  }, [load])

  const cityOptions = useMemo(() => distinctCityRoutesFromLeads(allQuoteLeads), [allQuoteLeads])
  const visitorEvents = useMemo(() => filterVisitorAnalyticsEvents(events), [events])
  const visitorAnalytics = useMemo(() => computeVisitorAnalytics(events), [events])
  const funnelKpis = useMemo(() => computeFunnelKpisFromEvents(events), [events])

  const runSearchNow = useCallback(() => {
    setActiveSearch(searchInput.trim())
  }, [searchInput])

  return (
    <div className="min-w-0 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-slate-900">Website Leads / Quote Funnel</h2>
          <p className="mt-1 text-sm text-slate-600">
            Visitor analytics are separated from quote leads so simple page views are not counted as abandoned quotes.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="min-h-[48px] shrink-0 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 sm:min-h-0 sm:px-4 sm:py-2"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiPeriodCard
          label="Page views"
          today={visitorAnalytics.pageViews.today}
          week={visitorAnalytics.pageViews.week}
          month={visitorAnalytics.pageViews.month}
        />
        <KpiPeriodCard
          label="Unique visitors"
          today={visitorAnalytics.uniqueVisitors.today}
          week={visitorAnalytics.uniqueVisitors.week}
          month={visitorAnalytics.uniqueVisitors.month}
        />
        <KpiPeriodCard
          label="Clicks"
          today={visitorAnalytics.clicks.today}
          week={visitorAnalytics.clicks.week}
          month={visitorAnalytics.clicks.month}
        />
        <KpiPeriodCard
          label="Quote starts"
          today={funnelKpis.quoteStarts.today}
          week={funnelKpis.quoteStarts.week}
          month={funnelKpis.quoteStarts.month}
        />
        <KpiPeriodCard
          label="Completed bookings"
          today={funnelKpis.bookings.today}
          week={funnelKpis.bookings.week}
          month={funnelKpis.bookings.month}
        />
      </div>

      <AdminSection
        title="Visitor analytics"
        description="Browsing and click activity from website_events — not quote leads."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
            <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
              <h4 className="text-sm font-semibold text-slate-900">Most viewed pages (30d)</h4>
            </div>
            {visitorAnalytics.topPages.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500 sm:px-5">No page views yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 px-4 py-1 sm:px-5">
                {visitorAnalytics.topPages.map((row) => (
                  <li key={row.page_path} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0 truncate font-medium text-slate-800">{row.page_path}</span>
                    <span className="shrink-0 tabular-nums font-semibold text-slate-600">{row.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
            <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
              <h4 className="text-sm font-semibold text-slate-900">Most clicked links (30d)</h4>
            </div>
            {visitorAnalytics.topClicks.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500 sm:px-5">No clicks yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 px-4 py-1 sm:px-5">
                {visitorAnalytics.topClicks.map((row) => (
                  <li key={row.label} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0 truncate font-medium text-slate-800">{row.label}</span>
                    <span className="shrink-0 tabular-nums font-semibold text-slate-600">{row.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
          <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
            <h4 className="text-sm font-semibold text-slate-900">Recent visitor activity</h4>
            <p className="mt-0.5 text-xs text-slate-500">Page views, button clicks, and service-card taps only.</p>
          </div>
          {visitorEvents.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500 sm:px-5">
              No visitor events yet. Browse the public site, then refresh.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5 sm:px-4">Time</th>
                    <th className="px-3 py-2.5 sm:px-4">Event</th>
                    <th className="px-3 py-2.5 sm:px-4">Click</th>
                    <th className="px-3 py-2.5 sm:px-4">Page</th>
                    <th className="hidden px-3 py-2.5 md:table-cell sm:px-4">Source</th>
                    <th className="hidden px-3 py-2.5 lg:table-cell sm:px-4">Location</th>
                    <th className="hidden px-3 py-2.5 sm:table-cell sm:px-4">IP</th>
                    <th className="hidden px-3 py-2.5 md:table-cell sm:px-4">Device</th>
                    <th className="px-3 py-2.5 sm:px-4">Session</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visitorEvents.slice(0, 100).map((ev) => {
                    const click = eventClickLabel(ev)
                    return (
                      <tr key={ev.id} className="hover:bg-slate-50/80">
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600 sm:px-4">
                          {formatDateTimeUK(ev.created_at)}
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-900 sm:px-4">{ev.event_name}</td>
                        <td className="max-w-[120px] truncate px-3 py-2 text-slate-700 sm:max-w-[140px] sm:px-4">
                          {click || '—'}
                        </td>
                        <td className="max-w-[100px] truncate px-3 py-2 text-slate-700 sm:max-w-[120px] sm:px-4">
                          {ev.page_path || '—'}
                        </td>
                        <td className="hidden max-w-[120px] truncate px-3 py-2 text-xs text-slate-600 md:table-cell sm:px-4">
                          {ev.referrer || '—'}
                        </td>
                        <td className="hidden px-3 py-2 text-slate-700 lg:table-cell sm:px-4">
                          {[ev.city, ev.region, ev.country].filter(Boolean).join(', ') || '—'}
                        </td>
                        <td className="hidden px-3 py-2 font-mono text-xs text-slate-600 sm:table-cell sm:px-4">
                          {ev.ip_masked || '—'}
                        </td>
                        <td className="hidden px-3 py-2 text-xs text-slate-600 md:table-cell sm:px-4">
                          {[ev.device_type, ev.browser_name].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-500 sm:px-4">
                          {String(ev.session_id || '').slice(0, 8)}…
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </AdminSection>

      <AdminSection
        title="Quote leads / funnel"
        description="Real quote progress from website_leads — excludes page views and generic clicks."
      >
        <WebsiteLeadsRecoveryPanel
          allRows={allQuoteLeads}
          rows={rows}
          recoveryChip={recoveryChip}
          onRecoveryChipChange={setRecoveryChip}
        />

        <div className="flex flex-wrap gap-2">
          {LEAD_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition ${
                filter === f.id
                  ? 'bg-slate-900 text-white ring-slate-900'
                  : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="min-w-0 flex-1 sm:max-w-xs">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              City / route
            </span>
            <select
              value={cityRoute}
              onChange={(e) => setCityRoute(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
            >
              <option value="">All routes</option>
              {cityOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>

        <AdminRecordsSearchRow
          searchInput={searchInput}
          onSearchInputChange={(e) => setSearchInput(e.target.value)}
          onSearchSubmit={runSearchNow}
          placeholder="Search name, email, phone, quote ref, path…"
        />

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
          {loading ? (
            <p className="px-6 py-12 text-center text-sm text-slate-500">Loading quote leads…</p>
          ) : rows.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-slate-500">
              No quote leads match this filter. Visitor browsing is listed above.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-3 sm:px-4">Status</th>
                    <th className="px-3 py-3 sm:px-4">Recovery</th>
                    <th className="px-3 py-3 sm:px-4">Landing</th>
                    <th className="hidden px-3 py-3 lg:table-cell sm:px-4">Location</th>
                    <th className="px-3 py-3 sm:px-4">Service</th>
                    <th className="px-3 py-3 sm:px-4">Customer</th>
                    <th className="px-3 py-3 sm:px-4">Step</th>
                    <th className="hidden px-3 py-3 sm:table-cell sm:px-4">Total</th>
                    <th className="px-3 py-3 sm:px-4">Quote ref</th>
                    <th className="hidden px-3 py-3 md:table-cell sm:px-4">Last activity</th>
                    <th className="px-3 py-3 sm:px-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const eff = row.effective_status || row.status
                    return (
                      <tr key={row.id} className="hover:bg-slate-50/80">
                        <td className="px-3 py-3 sm:px-4">
                          <StatusBadge status={eff} />
                        </td>
                        <td className="px-3 py-3 sm:px-4">
                          <RecoveryBadge row={row} />
                        </td>
                        <td className="max-w-[120px] px-3 py-3 sm:max-w-[140px] sm:px-4">
                          <div className="truncate font-medium text-slate-900">{row.landing_path || '—'}</div>
                          {row.city_route ? (
                            <div className="truncate text-xs text-slate-500">{row.city_route}</div>
                          ) : null}
                        </td>
                        <td className="hidden px-3 py-3 text-slate-700 lg:table-cell sm:px-4">
                          {[row.city, row.region, row.country].filter(Boolean).join(', ') || '—'}
                        </td>
                        <td className="px-3 py-3 text-slate-700 sm:px-4">{row.service_type || '—'}</td>
                        <td className="max-w-[160px] px-3 py-3 sm:max-w-[180px] sm:px-4">
                          <div className="truncate font-medium text-slate-900">{row.customer_name || '—'}</div>
                          {row.customer_email ? (
                            <div className="truncate text-xs text-slate-500">{row.customer_email}</div>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-700 sm:px-4">
                          {row.current_step ? `Step ${row.current_step}` : '—'}
                        </td>
                        <td className="hidden whitespace-nowrap px-3 py-3 text-slate-700 sm:table-cell sm:px-4">
                          {money(row.estimated_total)}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-slate-800 sm:px-4">
                          {row.quote_ref || '—'}
                        </td>
                        <td className="hidden whitespace-nowrap px-3 py-3 text-slate-600 md:table-cell sm:px-4">
                          {formatDateTimeUK(row.last_activity_at)}
                        </td>
                        <td className="px-3 py-3 sm:px-4">
                          <button
                            type="button"
                            onClick={() => setSelected(row)}
                            className="text-sm font-semibold text-brand-700 hover:text-brand-800"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </AdminSection>

      <LeadDetailDrawer row={selected} onClose={() => setSelected(null)} onRefresh={load} />
    </div>
  )
}
