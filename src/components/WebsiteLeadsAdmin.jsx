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
import { computeWebsiteEventAnalytics, eventClickLabel } from '../lib/websiteEventAnalytics'
import { filterLeadsByRecoveryChip } from '../lib/websiteLeadRecovery'
import { formatDateTimeUK } from '../lib/formatDateDisplay'
import WebsiteLeadsRecoveryPanel, { RecoveryBadge } from './admin/WebsiteLeadsRecoveryPanel'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'visitors', label: 'Visitors' },
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

function DetailRow({ label, children }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-3 sm:grid-cols-[140px_1fr]">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900">{children ?? '—'}</dd>
    </div>
  )
}

/**
 * @param {{ row: Record<string, unknown> | null, onClose: () => void }} props
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
  const [allRowsForCities, setAllRowsForCities] = useState([])
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
      await scheduleAbandonedRecoveryForRows(all)
      setRows(filterLeadsByRecoveryChip(list, recoveryChip))
      setAllRowsForCities(all)
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

  const cityOptions = useMemo(() => distinctCityRoutesFromLeads(allRowsForCities), [allRowsForCities])
  const analytics = useMemo(() => computeWebsiteEventAnalytics(events), [events])

  const runSearchNow = useCallback(() => {
    setActiveSearch(searchInput.trim())
  }, [searchInput])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Website Leads / Quote Funnel</h2>
          <p className="mt-1 text-sm text-slate-600">
            Page views, clicks, and quote funnel from website_events. Visitor IP is masked for admin analytics only
            (GDPR). Geo needs migration 032 + edge function get-visitor-context.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="min-h-[48px] rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 sm:min-h-0 sm:px-4 sm:py-2"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiPeriodCard
          label="Page views"
          today={analytics.pageViews.today}
          week={analytics.pageViews.week}
          month={analytics.pageViews.month}
        />
        <KpiPeriodCard
          label="Unique sessions"
          today={analytics.uniqueSessions.today}
          week={analytics.uniqueSessions.week}
          month={analytics.uniqueSessions.month}
        />
        <KpiPeriodCard
          label="Clicks"
          today={analytics.clicks.today}
          week={analytics.clicks.week}
          month={analytics.clicks.month}
        />
        <KpiPeriodCard
          label="Quote starts"
          today={analytics.quoteStarts.today}
          week={analytics.quoteStarts.week}
          month={analytics.quoteStarts.month}
        />
        <KpiPeriodCard
          label="Bookings completed"
          today={analytics.bookings.today}
          week={analytics.bookings.week}
          month={analytics.bookings.month}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-base font-semibold text-slate-900">Most viewed pages (30d)</h3>
          </div>
          {analytics.topPages.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">No page views yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 px-5 py-2">
              {analytics.topPages.map((row) => (
                <li key={row.page_path} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="truncate font-medium text-slate-800">{row.page_path}</span>
                  <span className="shrink-0 tabular-nums font-semibold text-slate-600">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-base font-semibold text-slate-900">Most clicked links (30d)</h3>
          </div>
          {analytics.topClicks.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">No clicks yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 px-5 py-2">
              {analytics.topClicks.map((row) => (
                <li key={row.label} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="truncate font-medium text-slate-800">{row.label}</span>
                  <span className="shrink-0 tabular-nums font-semibold text-slate-600">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">Recent activity</h3>
          <p className="mt-1 text-xs text-slate-500">
            Page views, button clicks, and quote steps — newest first (last 30 days).
          </p>
        </div>
        {events.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">No events yet. Browse the public site, then refresh. If still empty, run migration 032_website_lead_visitor_geo.sql in Supabase.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Click</th>
                  <th className="px-4 py-3">Page</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3">Device</th>
                  <th className="px-4 py-3">Session</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.slice(0, 150).map((ev) => {
                  const click = eventClickLabel(ev)
                  return (
                    <tr key={ev.id} className="hover:bg-slate-50/80">
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                        {formatDateTimeUK(ev.created_at)}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">{ev.event_name}</td>
                      <td className="max-w-[140px] truncate px-4 py-2.5 text-slate-700">{click || '—'}</td>
                      <td className="max-w-[120px] truncate px-4 py-2.5 text-slate-700">{ev.page_path || '—'}</td>
                      <td className="max-w-[140px] truncate px-4 py-2.5 text-xs text-slate-600">
                        {ev.referrer || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">
                        {[ev.city, ev.region, ev.country].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{ev.ip_masked || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">
                        {[ev.device_type, ev.browser_name].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">
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

      <WebsiteLeadsRecoveryPanel
        allRows={allRowsForCities}
        rows={rows}
        recoveryChip={recoveryChip}
        onRecoveryChipChange={setRecoveryChip}
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
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
        <label className="min-w-[200px]">
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

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        {loading ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">No leads match this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Recovery</th>
                  <th className="px-4 py-3">Landing / city</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Step</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Quote ref</th>
                  <th className="px-4 py-3">Last activity</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const eff = row.effective_status || row.status
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <StatusBadge status={eff} />
                      </td>
                      <td className="px-4 py-3">
                        <RecoveryBadge row={row} />
                      </td>
                      <td className="max-w-[140px] px-4 py-3">
                        <div className="font-medium text-slate-900">{row.landing_path || '—'}</div>
                        {row.city_route ? (
                          <div className="text-xs text-slate-500">{row.city_route}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{[row.city, row.region, row.country].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{row.ip_masked || '—'}</td>
                      <td className="px-4 py-3 text-slate-700">{row.service_type || '—'}</td>
                      <td className="max-w-[180px] px-4 py-3">
                        <div className="font-medium text-slate-900">{row.customer_name || '—'}</div>
                        {row.customer_email ? (
                          <div className="truncate text-xs text-slate-500">{row.customer_email}</div>
                        ) : null}
                        {row.customer_phone ? (
                          <div className="text-xs text-slate-500">{row.customer_phone}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.current_step ? `Step ${row.current_step}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{money(row.estimated_total)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-800">{row.quote_ref || '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDateTimeUK(row.last_activity_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDateTimeUK(row.created_at)}
                      </td>
                      <td className="px-4 py-3">
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

      <LeadDetailDrawer row={selected} onClose={() => setSelected(null)} onRefresh={load} />
    </div>
  )
}



