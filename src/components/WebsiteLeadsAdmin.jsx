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
import {
  computeFunnelKpisFromEvents,
  computeVisitorAnalytics,
  eventBadgeTone,
  filterQuoteLeadRows,
  filterVisitorAnalyticsEvents,
  groupVisitorActivityForDisplay,
} from '../lib/websiteLeadAdminDisplay'
import { filterLeadsByRecoveryChip } from '../lib/websiteLeadRecovery'
import { formatDateTimeUK } from '../lib/formatDateDisplay'
import WebsiteLeadsRecoveryPanel, { RecoveryBadge } from './admin/WebsiteLeadsRecoveryPanel'
import WebsiteFunnelCleanupModal from './admin/WebsiteFunnelCleanupModal'

const LEAD_FILTERS = [
  { id: 'all', label: 'All leads' },
  { id: 'started', label: 'Started Quote' },
  { id: 'abandoned', label: 'Abandoned' },
  { id: 'completed', label: 'Completed Quote' },
  { id: 'payment_started', label: 'Payment Started' },
  { id: 'payment_completed', label: 'Payment Completed' },
]

const BADGE_TONES = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200/80',
  blue: 'bg-blue-50 text-blue-800 ring-blue-200/80',
  amber: 'bg-amber-50 text-amber-900 ring-amber-200/80',
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
  orange: 'bg-orange-50 text-orange-900 ring-orange-200/80',
  violet: 'bg-violet-50 text-violet-800 ring-violet-200/80',
  teal: 'bg-teal-50 text-teal-800 ring-teal-200/80',
}

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

/** @param {{ eventName: string }} props */
function EventBadge({ eventName }) {
  const tone = BADGE_TONES[eventBadgeTone(eventName)] || BADGE_TONES.slate
  const label = String(eventName || '').replace(/_/g, ' ')
  return (
    <span className={`inline-flex max-w-full truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${tone}`}>
      {label}
    </span>
  )
}

function StatusBadge({ status }) {
  const toneKey =
    status === 'payment_completed'
      ? 'green'
      : status === 'quote_completed'
        ? 'teal'
        : status === 'payment_started'
          ? 'violet'
          : status === 'quote_abandoned'
            ? 'orange'
            : status === 'quote_started' || status === 'step_completed'
              ? 'amber'
              : 'slate'
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${BADGE_TONES[toneKey]}`}
    >
      {statusLabel(status)}
    </span>
  )
}

function money(n) {
  if (n == null || n === '') return '—'
  return `£${Number(n).toFixed(2)}`
}

/**
 * @param {{ value: string, max?: number, className?: string, mono?: boolean }} props
 */
function TruncateCell({ value, max = 32, className = '', mono = false }) {
  const text = String(value || '').trim() || '—'
  const short = text.length > max ? `${text.slice(0, max)}…` : text
  return (
    <span
      className={`block min-w-0 max-w-full truncate ${mono ? 'font-mono' : ''} ${className}`}
      title={text !== '—' ? text : undefined}
    >
      {short}
    </span>
  )
}

/**
 * @param {{ label: string, today: number, week: number, month: number }} props
 */
function KpiPeriodCard({ label, today, week, month }) {
  return (
    <div className="flex h-full min-h-[108px] flex-col justify-between rounded-xl border border-slate-200/90 bg-white px-4 py-3.5 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold leading-none tabular-nums tracking-tight text-slate-900">{today}</p>
      <p className="mt-2 text-[10px] text-slate-500">
        <span className="text-slate-600">7d</span> {week}
        <span className="mx-1 text-slate-300">·</span>
        <span className="text-slate-600">30d</span> {month}
      </p>
    </div>
  )
}

/**
 * @param {{ title: string, description?: string, children: import('react').ReactNode }} props
 */
function AdminSection({ title, description, children }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
      <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur-sm sm:px-5">
        <h3 className="text-base font-bold text-slate-900 sm:text-lg">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{description}</p> : null}
      </div>
      <div className="space-y-4 p-4 sm:p-5">{children}</div>
    </section>
  )
}

/** @param {{ children: import('react').ReactNode, maxHeight?: string }} props */
function TableScroll({ children, maxHeight = 'max-h-[min(420px,55vh)]' }) {
  return (
    <div className={`min-w-0 overflow-x-auto overscroll-x-contain ${maxHeight} overflow-y-auto`}>
      {children}
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

/** @param {{ items: Array<{ label: string, count: number }>, empty: string }} props */
function CompactRankList({ items, empty }) {
  if (!items.length) {
    return <p className="px-3 py-5 text-xs text-slate-500">{empty}</p>
  }
  return (
    <ul className="divide-y divide-slate-100/80">
      {items.map((row) => (
        <li key={row.label} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
          <TruncateCell value={row.label} max={40} className="font-medium text-slate-800" />
          <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-700">
            {row.count}
          </span>
        </li>
      ))}
    </ul>
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
  const [cleanupOpen, setCleanupOpen] = useState(false)

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
  const groupedVisitorRows = useMemo(
    () => groupVisitorActivityForDisplay(visitorEvents, { limit: 80 }),
    [visitorEvents],
  )
  const visitorAnalytics = useMemo(() => computeVisitorAnalytics(events), [events])
  const funnelKpis = useMemo(() => computeFunnelKpisFromEvents(events), [events])

  const runSearchNow = useCallback(() => {
    setActiveSearch(searchInput.trim())
  }, [searchInput])

  return (
    <div className="min-w-0 max-w-full space-y-6 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200/90 bg-gradient-to-br from-slate-50 to-white px-4 py-4 sm:px-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Website Leads / Quote Funnel
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-600 sm:text-sm">
            Visitor analytics are separated from quote leads so simple page views are not counted as
            abandoned quotes.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCleanupOpen(true)}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
          >
            Cleanup
          </button>
          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <WebsiteFunnelCleanupModal
        open={cleanupOpen}
        onClose={() => setCleanupOpen(false)}
        onCleaned={load}
      />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-5">
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
        description="Browsing and clicks — grouped to reduce noise (e.g. repeated footer admin taps)."
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="min-w-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-50/40">
            <p className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-800">
              Most viewed pages (30d)
            </p>
            <CompactRankList
              items={visitorAnalytics.topPages.map((r) => ({ label: r.page_path, count: r.count }))}
              empty="No page views yet."
            />
          </div>
          <div className="min-w-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-50/40">
            <p className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-800">
              Most clicked links (30d)
            </p>
            <CompactRankList
              items={visitorAnalytics.topClicks.map((r) => ({ label: r.label, count: r.count }))}
              empty="No clicks yet."
            />
          </div>
        </div>

        <div className="min-w-0 overflow-hidden rounded-lg border border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-3 py-2">
            <div>
              <p className="text-xs font-semibold text-slate-900">Recent visitor activity</p>
              <p className="text-[10px] text-slate-500">Newest first · identical actions grouped</p>
            </div>
            <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200/80">
              {groupedVisitorRows.length} groups
            </span>
          </div>

          {groupedVisitorRows.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-slate-500">
              No visitor events yet. Browse the public site, then refresh.
            </p>
          ) : (
            <TableScroll maxHeight="max-h-[min(380px,50vh)]">
              <table className="w-full min-w-[320px] table-fixed text-left text-[11px]">
                <thead className="sticky top-0 z-[1] bg-slate-100/95 text-[10px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur-sm">
                  <tr>
                    <th className="w-[88px] px-2 py-1.5">Time</th>
                    <th className="w-[88px] px-2 py-1.5">Event</th>
                    <th className="hidden w-[100px] px-2 py-1.5 lg:table-cell">Click</th>
                    <th className="px-2 py-1.5">Page</th>
                    <th className="hidden w-[72px] px-2 py-1.5 md:table-cell">Device</th>
                    <th className="hidden w-[100px] px-2 py-1.5 xl:table-cell">Source</th>
                    <th className="hidden w-[88px] px-2 py-1.5 2xl:table-cell">IP</th>
                    <th className="hidden w-[72px] px-2 py-1.5 2xl:table-cell">Session</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedVisitorRows.map((grp, idx) => {
                    const ev = grp.event
                    const device = [ev.device_type, ev.browser_name].filter(Boolean).join(' · ')
                    const location = [ev.city, ev.region, ev.country].filter(Boolean).join(', ')
                    const clickDisplay =
                      grp.count > 1 && grp.clickLabel
                        ? `${grp.clickLabel} · ${grp.count}×`
                        : grp.clickLabel || '—'
                    return (
                      <tr
                        key={grp.id}
                        className={`border-t border-slate-100/80 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-sky-50/40`}
                      >
                        <td className="whitespace-nowrap px-2 py-1 text-slate-600">
                          {formatDateTimeUK(ev.created_at)}
                        </td>
                        <td className="px-2 py-1">
                          <EventBadge eventName={String(ev.event_name || '')} />
                          <span className="mt-0.5 block truncate text-[10px] text-slate-500 lg:hidden">
                            {clickDisplay !== '—' ? clickDisplay : null}
                          </span>
                        </td>
                        <td className="hidden px-2 py-1 lg:table-cell">
                          <TruncateCell value={clickDisplay} max={28} className="text-slate-700" />
                        </td>
                        <td className="px-2 py-1">
                          <TruncateCell value={String(ev.page_path || '/')} max={36} className="text-slate-800" />
                          {location ? (
                            <span className="mt-0.5 block truncate text-[10px] text-slate-500 xl:hidden" title={location}>
                              {location}
                            </span>
                          ) : null}
                        </td>
                        <td className="hidden px-2 py-1 md:table-cell">
                          <TruncateCell value={device || '—'} max={18} className="text-slate-600" />
                        </td>
                        <td className="hidden px-2 py-1 xl:table-cell">
                          <TruncateCell value={String(ev.referrer || '—')} max={36} className="text-slate-500" />
                        </td>
                        <td className="hidden px-2 py-1 2xl:table-cell">
                          <TruncateCell value={String(ev.ip_masked || '—')} max={14} mono className="text-slate-500" />
                        </td>
                        <td className="hidden px-2 py-1 2xl:table-cell">
                          <TruncateCell
                            value={String(ev.session_id || '').slice(0, 8)}
                            max={10}
                            mono
                            className="text-slate-500"
                            title={String(ev.session_id || '')}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </TableScroll>
          )}
        </div>
      </AdminSection>

      <AdminSection
        title="Quote leads / funnel"
        description="Real quote progress only — excludes page views and generic clicks."
      >
        <div className="sticky top-0 z-20 -mx-4 space-y-3 border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur-sm sm:-mx-5 sm:px-5">
          <WebsiteLeadsRecoveryPanel
            allRows={allQuoteLeads}
            rows={rows}
            recoveryChip={recoveryChip}
            onRecoveryChipChange={setRecoveryChip}
          />

          <div className="flex flex-wrap gap-1.5">
            {LEAD_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset transition ${
                  filter === f.id
                    ? 'bg-slate-900 text-white ring-slate-900'
                    : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1 sm:max-w-[200px]">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                City / route
              </span>
              <select
                value={cityRoute}
                onChange={(e) => setCityRoute(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
              >
                <option value="">All routes</option>
                {cityOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <div className="min-w-0 flex-1">
              <AdminRecordsSearchRow
                searchInput={searchInput}
                onSearchInputChange={(e) => setSearchInput(e.target.value)}
                onSearchSubmit={runSearchNow}
                placeholder="Search name, email, phone, quote ref…"
              />
            </div>
          </div>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>
          ) : null}
        </div>

        <div className="min-w-0 overflow-hidden rounded-lg border border-slate-100">
          {loading ? (
            <p className="px-4 py-10 text-center text-xs text-slate-500">Loading quote leads…</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-xs text-slate-500">
              No quote leads match this filter.
            </p>
          ) : (
            <TableScroll maxHeight="max-h-[min(480px,60vh)]">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="sticky top-0 z-[1] bg-slate-100/95 text-[10px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur-sm">
                  <tr>
                    <th className="px-2 py-2">Status</th>
                    <th className="hidden px-2 py-2 sm:table-cell">Recovery</th>
                    <th className="px-2 py-2">Customer</th>
                    <th className="hidden px-2 py-2 md:table-cell">Service</th>
                    <th className="px-2 py-2">Step</th>
                    <th className="hidden px-2 py-2 lg:table-cell">Total</th>
                    <th className="px-2 py-2">Quote ref</th>
                    <th className="hidden px-2 py-2 xl:table-cell">Last</th>
                    <th className="w-14 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const eff = row.effective_status || row.status
                    const rowTone =
                      eff === 'payment_completed'
                        ? 'bg-emerald-50/70 hover:bg-emerald-50'
                        : eff === 'quote_abandoned'
                          ? 'bg-orange-50/50 hover:bg-orange-50/70'
                          : idx % 2 === 0
                            ? 'bg-white hover:bg-slate-50/80'
                            : 'bg-slate-50/40 hover:bg-slate-50/80'
                    return (
                      <tr key={row.id} className={`border-t border-slate-100/80 ${rowTone}`}>
                        <td className="px-2 py-2 align-top">
                          <StatusBadge status={eff} />
                        </td>
                        <td className="hidden px-2 py-2 align-top sm:table-cell">
                          <RecoveryBadge row={row} />
                        </td>
                        <td className="max-w-[140px] px-2 py-2 align-top sm:max-w-[180px]">
                          <TruncateCell
                            value={String(row.customer_name || '—')}
                            max={24}
                            className="font-medium text-slate-900"
                          />
                          {row.customer_email ? (
                            <TruncateCell
                              value={String(row.customer_email)}
                              max={28}
                              className="mt-0.5 text-[10px] text-slate-500"
                            />
                          ) : null}
                          <TruncateCell
                            value={String(row.landing_path || '')}
                            max={22}
                            className="mt-0.5 text-[10px] text-slate-400"
                          />
                        </td>
                        <td className="hidden px-2 py-2 align-top text-slate-700 md:table-cell">
                          <TruncateCell value={String(row.service_type || '—')} max={20} />
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 align-top text-slate-700">
                          {row.current_step ? `Step ${row.current_step}` : '—'}
                        </td>
                        <td className="hidden whitespace-nowrap px-2 py-2 align-top tabular-nums text-slate-700 lg:table-cell">
                          {money(row.estimated_total)}
                        </td>
                        <td className="px-2 py-2 align-top">
                          {row.quote_ref ? (
                            row.quote_id ? (
                              <Link
                                to={`/admin/available-jobs/${row.quote_id}`}
                                className="font-mono text-[11px] font-semibold text-brand-700 hover:text-brand-800"
                                title={String(row.quote_ref)}
                              >
                                <TruncateCell value={String(row.quote_ref)} max={14} />
                              </Link>
                            ) : (
                              <TruncateCell
                                value={String(row.quote_ref)}
                                max={14}
                                mono
                                className="font-semibold text-slate-800"
                              />
                            )
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="hidden whitespace-nowrap px-2 py-2 align-top text-slate-500 xl:table-cell">
                          {formatDateTimeUK(row.last_activity_at)}
                        </td>
                        <td className="px-2 py-2 align-top">
                          <button
                            type="button"
                            onClick={() => setSelected(row)}
                            className="text-[11px] font-semibold text-brand-700 hover:text-brand-800"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </TableScroll>
          )}
        </div>
      </AdminSection>

      <LeadDetailDrawer row={selected} onClose={() => setSelected(null)} onRefresh={load} />
    </div>
  )
}
