import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchQuotesForAdmin } from '../lib/data/quotesAdminRepository'
import { quotePassesAvailableJobsStrict } from '../lib/adminJobListRules'
import {
  availableJobIdSet,
  findNewAvailableJobIds,
  formatNewJobToastMessage,
  pickJobsByIds,
} from '../lib/availableJobsNewJobNotify'
import {
  playAvailableJobsAlertSound,
  readAvailableJobsSoundEnabled,
  readAvailableJobsSoundUnlocked,
  unlockAvailableJobsSound,
  writeAvailableJobsSoundEnabled,
} from '../lib/availableJobsSoundAlerts'
import JobCard from './admin-workflow/JobCard'
import JobQuickAssignDriver from './admin-workflow/JobQuickAssignDriver'
import { countAcceptedJobsByDriverId } from '../lib/adminDriverJobCounts'
import AdminJobListSections from './admin-workflow/AdminJobListSections'
import AdminRecordsSearchRow from './admin/AdminRecordsSearchRow'
import MarketplacePricingSettingsPanel from './admin-workflow/MarketplacePricingSettingsPanel'
import AutoMarketplaceHoldToggle from './admin-workflow/AutoMarketplaceHoldToggle'
import { runAutoMarketplaceTick } from '../lib/autoMarketplacePublish'
import { loadMarketplacePricingDefaults } from '../lib/marketplacePricingDefaultsStore'
import { subscribeAdminDataRefresh } from '../lib/adminDataRefresh'
import { sendAdminAvailableJobTestEmail } from '../lib/adminAvailableJobTestEmail'
import AdminSettingsAccordion from './admin/AdminSettingsAccordion'

const POLL_MS = 12_000
const AUTO_MARKETPLACE_MS = 60_000
const HIGHLIGHT_MS = 4_000
const NOTIFY_DEBOUNCE_MS = 450

const FILTERS = [
  { key: 'all_paid', label: 'All paid' },
  { key: 'deposit_paid', label: 'Deposit paid' },
  { key: 'paid', label: 'Fully paid' },
]

const SORT_OPTIONS = [
  { key: 'paid_newest', label: 'Newest paid first' },
  { key: 'paid_oldest', label: 'Oldest paid first' },
  { key: 'move_soonest', label: 'Move date soonest' },
  { key: 'move_latest', label: 'Move date latest' },
]

/** @param {Record<string, unknown>} q */
function paidAtMs(q) {
  const t = q.paid_at ? new Date(String(q.paid_at)).getTime() : 0
  return Number.isFinite(t) && t > 0 ? t : 0
}

/** @param {Record<string, unknown>} q */
function createdAtMs(q) {
  const t = q.created_at ? new Date(String(q.created_at)).getTime() : 0
  return Number.isFinite(t) && t > 0 ? t : 0
}

/** @param {Record<string, unknown>} q */
function bookingSortMs(q) {
  return paidAtMs(q) || createdAtMs(q)
}

/** @param {Record<string, unknown>} q */
function moveDateMs(q) {
  if (q.move_date == null || q.move_date === '') return 0
  const t = new Date(String(q.move_date)).getTime()
  return Number.isFinite(t) && t > 0 ? t : 0
}

/**
 * @param {Record<string, unknown>} a
 * @param {Record<string, unknown>} b
 * @param {string} sortKey
 */
function compareAvailableJobsSort(a, b, sortKey) {
  switch (sortKey) {
    case 'paid_oldest':
      return bookingSortMs(a) - bookingSortMs(b)
    case 'move_soonest': {
      const ma = moveDateMs(a)
      const mb = moveDateMs(b)
      if (ma && mb) return ma - mb
      if (ma) return -1
      if (mb) return 1
      return bookingSortMs(b) - bookingSortMs(a)
    }
    case 'move_latest': {
      const ma = moveDateMs(a)
      const mb = moveDateMs(b)
      if (ma && mb) return mb - ma
      if (ma) return -1
      if (mb) return 1
      return bookingSortMs(b) - bookingSortMs(a)
    }
    case 'paid_newest':
    default:
      return bookingSortMs(b) - bookingSortMs(a)
  }
}

export default function AvailableJobsAdmin() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const extendJourneyId = (searchParams.get('extendJourney') || '').trim()
  const [filterKey, setFilterKey] = useState('all_paid')
  const [sortKey, setSortKey] = useState('paid_newest')
  const [viewMode, setViewMode] = useState('list')
  const [searchInput, setSearchInput] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [highlightIds, setHighlightIds] = useState(() => new Set())
  const [toast, setToast] = useState('')
  const [testEmailBusy, setTestEmailBusy] = useState(false)
  const [testEmailToast, setTestEmailToast] = useState(null)
  const [soundEnabled, setSoundEnabled] = useState(() => readAvailableJobsSoundEnabled())
  const [soundUnlocked, setSoundUnlocked] = useState(() => readAvailableJobsSoundUnlocked())

  const knownIdsRef = useRef(new Set())
  const notifyReadyRef = useRef(false)
  const refreshInFlightRef = useRef(false)
  const notifyDebounceRef = useRef(null)
  const pendingNotifyIdsRef = useRef([])
  const latestRowsRef = useRef([])

  useEffect(() => {
    const t = setTimeout(() => setActiveSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const fetchFilteredRows = useCallback(async () => {
    const list = await fetchQuotesForAdmin(filterKey, activeSearch)
    return list.filter(quotePassesAvailableJobsStrict)
  }, [filterKey, activeSearch])

  const jobCountsByDriverId = useMemo(() => countAcceptedJobsByDriverId(rows), [rows])

  const applySelectionFilter = useCallback((filtered) => {
    setSelectedIds((prev) => new Set([...prev].filter((id) => filtered.some((r) => String(r.id) === id))))
  }, [])

  const flushNewJobNotifications = useCallback(() => {
    const ids = [...new Set(pendingNotifyIdsRef.current)]
    pendingNotifyIdsRef.current = []
    if (!ids.length || !notifyReadyRef.current) return

    const jobs = pickJobsByIds(latestRowsRef.current, ids)
    setToast(formatNewJobToastMessage(jobs))
    window.setTimeout(() => setToast(''), 6000)

    setHighlightIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.add(id)
      return next
    })
    window.setTimeout(() => {
      setHighlightIds((prev) => {
        const next = new Set(prev)
        for (const id of ids) next.delete(id)
        return next
      })
    }, HIGHLIGHT_MS)

    if (soundEnabled && soundUnlocked) {
      void playAvailableJobsAlertSound()
    }
  }, [soundEnabled, soundUnlocked])

  const queueNewJobNotifications = useCallback(
    (filtered, newIds) => {
      if (!newIds.length) return
      latestRowsRef.current = filtered
      pendingNotifyIdsRef.current = [...pendingNotifyIdsRef.current, ...newIds]
      if (notifyDebounceRef.current) window.clearTimeout(notifyDebounceRef.current)
      notifyDebounceRef.current = window.setTimeout(() => {
        notifyDebounceRef.current = null
        flushNewJobNotifications()
      }, NOTIFY_DEBOUNCE_MS)
    },
    [flushNewJobNotifications],
  )

  const mergeRows = useCallback(
    (filtered, { notify }) => {
      latestRowsRef.current = filtered
      if (notify) {
        const newIds = findNewAvailableJobIds(knownIdsRef.current, filtered)
        if (newIds.length > 0) queueNewJobNotifications(filtered, newIds)
      }
      knownIdsRef.current = availableJobIdSet(filtered)
      setRows(filtered)
      applySelectionFilter(filtered)
    },
    [applySelectionFilter, queueNewJobNotifications],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    notifyReadyRef.current = false
    if (notifyDebounceRef.current) {
      window.clearTimeout(notifyDebounceRef.current)
      notifyDebounceRef.current = null
    }
    pendingNotifyIdsRef.current = []
    try {
      const filtered = await fetchFilteredRows()
      knownIdsRef.current = availableJobIdSet(filtered)
      latestRowsRef.current = filtered
      setRows(filtered)
      applySelectionFilter(filtered)
      notifyReadyRef.current = true
    } catch (e) {
      setError(e?.message || 'Failed to load quotes.')
    } finally {
      setLoading(false)
    }
  }, [applySelectionFilter, fetchFilteredRows])

  const silentRefresh = useCallback(async () => {
    if (refreshInFlightRef.current || loading) return
    refreshInFlightRef.current = true
    setIsRefreshing(true)
    try {
      const filtered = await fetchFilteredRows()
      mergeRows(filtered, { notify: true })
    } catch {
      /* keep current list on background failure */
    } finally {
      refreshInFlightRef.current = false
      setIsRefreshing(false)
    }
  }, [fetchFilteredRows, loading, mergeRows])

  const runAutoMarketplace = useCallback(async () => {
    const defs = loadMarketplacePricingDefaults()
    if (!defs.autoMarketplace.enabled || rows.length === 0) return
    try {
      const { published } = await runAutoMarketplaceTick(rows)
      if (published > 0) {
        const filtered = await fetchFilteredRows()
        mergeRows(filtered, { notify: false })
      }
    } catch {
      /* non-fatal */
    }
  }, [rows, fetchFilteredRows, mergeRows])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => subscribeAdminDataRefresh(load), [load])

  useEffect(() => {
    const defs = loadMarketplacePricingDefaults()
    if (!defs.autoMarketplace.enabled) return undefined
    void runAutoMarketplace()
    const id = window.setInterval(() => void runAutoMarketplace(), AUTO_MARKETPLACE_MS)
    return () => window.clearInterval(id)
  }, [runAutoMarketplace])

  useEffect(() => {
    if (!notifyReadyRef.current) return undefined
    const tick = () => {
      if (document.visibilityState === 'visible') void silentRefresh()
    }
    const id = window.setInterval(tick, POLL_MS)
    return () => window.clearInterval(id)
  }, [silentRefresh, filterKey, activeSearch])

  useEffect(
    () => () => {
      if (notifyDebounceRef.current) window.clearTimeout(notifyDebounceRef.current)
    },
    [],
  )

  const sortedRows = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => compareAvailableJobsSort(a, b, sortKey))
    return copy
  }, [rows, sortKey])

  const runSearchNow = useCallback(() => {
    setActiveSearch(searchInput.trim())
  }, [searchInput])

  const emptyMessage = useMemo(() => {
    if (loading) return ''
    if (sortedRows.length > 0) return ''
    return activeSearch ? 'No jobs found.' : 'No Available Jobs yet.'
  }, [loading, sortedRows.length, activeSearch])

  async function enableSoundAlerts() {
    const ok = await unlockAvailableJobsSound()
    if (ok) {
      setSoundUnlocked(true)
      setSoundEnabled(true)
    }
  }

  function toggleSoundAlerts() {
    const next = !soundEnabled
    writeAvailableJobsSoundEnabled(next)
    setSoundEnabled(next)
  }

  function toggleSelected(id) {
    const sid = String(id)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(sid)) next.delete(sid)
      else next.add(sid)
      return next
    })
  }

  const showTestEmailToast = useCallback((message, variant) => {
    setTestEmailToast({ message, variant })
    window.setTimeout(() => setTestEmailToast(null), variant === 'error' ? 8000 : 5000)
  }, [])

  async function handleSendTestAdminEmail() {
    if (testEmailBusy) return
    setTestEmailBusy(true)
    setTestEmailToast(null)
    try {
      const result = await sendAdminAvailableJobTestEmail()
      if (result.ok) {
        showTestEmailToast(result.message || 'Test email sent', 'success')
      } else {
        showTestEmailToast(result.message || 'Could not send test email.', 'error')
      }
    } catch (e) {
      showTestEmailToast(e?.message || 'Could not send test email.', 'error')
    } finally {
      setTestEmailBusy(false)
    }
  }

  function addToJourney() {
    if (selectedIds.size === 0) return
    const quoteIds = sortedRows.filter((q) => selectedIds.has(String(q.id))).map((q) => String(q.id))
    if (quoteIds.length === 0) return
    if (extendJourneyId) {
      const add = quoteIds.map((id) => encodeURIComponent(id)).join(',')
      navigate(`/admin/journey-planner?journey=${encodeURIComponent(extendJourneyId)}&add=${add}`)
      return
    }
    navigate('/admin/journey-planner', { state: { quoteIds } })
  }

  return (
    <div className="space-y-5">
      {toast ? (
        <div
          className="fixed bottom-4 right-4 z-[80] max-w-sm rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-950 shadow-lg"
          role="status"
          aria-live="polite"
        >
          {toast}
        </div>
      ) : null}

      {testEmailToast ? (
        <div
          className={`fixed bottom-4 left-4 z-[80] max-w-sm rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg sm:left-auto sm:right-4 ${
            testEmailToast.variant === 'error'
              ? 'border-red-200 bg-red-50 text-red-950'
              : 'border-emerald-200 bg-emerald-50 text-emerald-950'
          }`}
          role="status"
          aria-live="polite"
        >
          {testEmailToast.message}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Available Jobs</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Only card-paid bookings waiting for assignment appear here. Open a job for marketplace controls,
            assignment, and payment history. Unpaid leads stay in Website Leads / Quote Funnel.
            <span className="mt-1 block text-xs text-slate-500">
              List updates automatically every {Math.round(POLL_MS / 1000)} seconds.
              {isRefreshing ? ' · Updating…' : null}
            </span>
            {extendJourneyId ? (
              <span className="mt-2 block font-semibold text-indigo-800">
                Adding to saved journey — selections merge into that journey when you open the planner.
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={selectedIds.size === 0}
            onClick={addToJourney}
            className="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Add to Journey{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
          </button>
          <button
            type="button"
            onClick={() => void silentRefresh()}
            disabled={loading || isRefreshing}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            type="button"
            onClick={() => void handleSendTestAdminEmail()}
            disabled={testEmailBusy || loading}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            title="Send sample admin job notification to admin@shiftmyhome.co.uk"
          >
            {testEmailBusy ? 'Sending test…' : 'Send test email'}
          </button>
        </div>
      </div>

      <AdminSettingsAccordion
        storageKey="available-jobs"
        items={[
          {
            id: 'email',
            title: 'Email notifications',
            content: (
              <p className="text-xs leading-relaxed text-slate-600">
                Sends a sample message via Resend to verify delivery (use &ldquo;Send test email&rdquo; above). Does
                not create jobs or mark bookings as notified.
              </p>
            ),
          },
          {
            id: 'sound',
            title: 'Sound alerts',
            content: !soundUnlocked ? (
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-relaxed text-amber-950 sm:text-sm">
                  Hear a short alert when a new paid job appears on this board. Your browser requires one click to
                  allow sound.
                </p>
                <button
                  type="button"
                  onClick={() => void enableSoundAlerts()}
                  className="shrink-0 rounded-lg bg-amber-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-800"
                >
                  Enable job sound alerts
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-slate-700 sm:text-sm">Play a sound when new paid jobs appear</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={soundEnabled}
                  onClick={toggleSoundAlerts}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold shadow-sm ${
                    soundEnabled
                      ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                      : 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  Sound alerts: {soundEnabled ? 'On' : 'Off'}
                </button>
              </div>
            ),
          },
          {
            id: 'marketplace',
            title: 'Marketplace pricing settings',
            content: (
              <MarketplacePricingSettingsPanel
                marketplaceQuotes={[]}
                onApplied={load}
                compact
                embedded
              />
            ),
          },
        ]}
      />

      <AdminRecordsSearchRow
        searchInput={searchInput}
        onSearchInputChange={(e) => setSearchInput(e.target.value)}
        onSearchSubmit={runSearchNow}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilterKey(f.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                filterKey === f.key
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span className="sr-only">Sort by</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white py-1.5 pl-2.5 pr-8 text-sm font-medium text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm" role="group" aria-label="View mode">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${
                viewMode === 'list' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
              aria-pressed={viewMode === 'list'}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${
                viewMode === 'grid' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
              aria-pressed={viewMode === 'grid'}
            >
              Grid
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      )}

      {loading ? (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-6 text-slate-500 shadow-sm">
          <span
            className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600"
            aria-hidden
          />
          Loading…
        </div>
      ) : emptyMessage ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-600 shadow-sm">
          {emptyMessage}
        </p>
      ) : (
        <AdminJobListSections
          jobs={sortedRows}
          viewMode={viewMode}
          renderJob={(q) => (
            <JobCard
              q={q}
              listVariant="available"
              layoutMode={viewMode}
              highlight={highlightIds.has(String(q.id))}
              secondarySlot={
                <div className="flex w-full flex-col gap-2">
                  <JobQuickAssignDriver
                    quote={q}
                    jobCountsByDriverId={jobCountsByDriverId}
                    onApplied={async () => {
                      const filtered = await fetchFilteredRows()
                      mergeRows(filtered, { notify: false })
                    }}
                  />
                  <AutoMarketplaceHoldToggle
                    q={q}
                    onUpdated={async () => {
                      const filtered = await fetchFilteredRows()
                      mergeRows(filtered, { notify: false })
                    }}
                  />
                </div>
              }
              selectionCheckbox={
                <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-slate-600">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={selectedIds.has(String(q.id))}
                    onChange={() => toggleSelected(q.id)}
                  />
                  Journey
                </label>
              }
            />
          )}
        />
      )}
    </div>
  )
}
