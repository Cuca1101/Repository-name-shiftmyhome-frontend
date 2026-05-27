import { useCallback, useEffect, useMemo, useState } from 'react'
import { ADMIN_RECORDS_SEARCH_PLACEHOLDER } from '../../lib/adminSearch'
import { fetchQuotesForAdmin } from '../../lib/data/quotesAdminRepository'
import { fetchMarketplaceJourneysForAdmin } from '../../lib/data/journeysRepository'
import { fetchAllJobs } from '../../lib/data/jobsRepository'
import { formatDateTimeUK, formatDateUK } from '../../lib/formatDateDisplay'
import { mergedAdminWorkflowForQuote } from '../../lib/quoteAdminWorkflowMerge'
import {
  filterActiveQuotes,
  filterCancelledQuotes,
  filterCompletedQuotes,
  filterMarketplaceJourneys,
  filterMarketplaceQuotes,
  findLinkedJobForQuote,
} from '../../lib/adminWorkflowFilters'
import { compareMarketplaceJobsAdmin } from '../../lib/adminJobWarningBadges'
import { dispatchWorkflowBadge } from '../../lib/jobDispatchTimeline'
import { loadFleetDriversForAdmin } from '../../lib/adminFleetDrivers'
import JobAcceptedListTable from './JobAcceptedListTable'
import CompletedJobsListTable from './CompletedJobsListTable'
import CancelledJobsListTable from './CancelledJobsListTable'
import { getMarketplaceFinancePresentation } from '../../lib/marketplaceQuoteFinance'
import { PAYOUT_FIXED_FROM_AVAILABLE_LABEL } from '../../lib/marketplacePayoutDisplay'
import MarketplaceJourneyCard from './MarketplaceJourneyCard'
import MarketplaceJobCardActions from './MarketplaceJobCardActions'
import JobCard from './JobCard'
import AdminJobListSections from './AdminJobListSections'
import AdminJobOverrideActions from './AdminJobOverrideActions'
import MarketplaceJobRemoveButton from './MarketplaceJobRemoveButton'
import DriverChargeQuickActions from '../admin-driver-charges/DriverChargeQuickActions'
import { subscribeAdminDataRefresh } from '../../lib/adminDataRefresh'
import { fetchDriverChargesByQuoteIds } from '../../lib/data/driverChargesRepository'
import { partnerAcceptanceLabelForMarketplaceCard } from '../../lib/marketplaceListingStatus'

/** @typedef {'marketplace' | 'active' | 'completed' | 'cancelled'} WorkflowKind */

const PAGE_SIZE = 9

function marketplaceVisibilityLabel(v) {
  switch (v) {
    case 'visible_in_marketplace':
      return 'Visible to partners'
    case 'assigned':
      return 'Partner assigned'
    case 'hidden_from_partners':
      return 'Hidden from partners'
    case 'completed':
      return 'Completed (marketplace)'
    case 'cancelled':
      return 'Cancelled (marketplace)'
    default:
      return v || 'Not sent to marketplace'
  }
}

/** @param {Record<string, unknown>} q */
function completionTimestamp(q, job) {
  const tryIso = (x) => (x ? formatDateUK(x) : null)
  return (
    tryIso(job?.updated_at) ||
    tryIso(q.paid_at) ||
    tryIso(q.updated_at) ||
    tryIso(q.created_at) ||
    'Date not recorded'
  )
}

/**
 * @param {WorkflowKind} kind
 * @param {Record<string, unknown>} q
 * @param {Record<string, unknown> | null} job
 */
function buildWorkflowRows(kind, q, job) {
  const o = mergedAdminWorkflowForQuote(q)
  if (kind === 'marketplace') {
    const pres = getMarketplaceFinancePresentation(q)
    const payout =
      pres.marketplacePayout != null && Number.isFinite(Number(pres.marketplacePayout))
        ? `£${Number(pres.marketplacePayout).toFixed(2)}`
        : 'Not set yet'
    const partner = String(o.partnerAcceptanceStatus ?? '').trim() || 'Not recorded yet'
    const rows = [
      { label: 'Driver payout', value: payout },
      { label: 'Visibility', value: marketplaceVisibilityLabel(o.marketplaceVisibility) },
      { label: 'Partner acceptance', value: partner },
    ]
    if (pres.payoutFixedFromAvailableJobs) {
      rows.push({ label: 'Payout source', value: PAYOUT_FIXED_FROM_AVAILABLE_LABEL })
    } else if (pres.payoutIsEstimated && pres.payoutWarning) {
      rows.push({ label: 'Note', value: pres.payoutWarning })
    }
    return rows
  }
  if (kind === 'active') {
    return []
  }
  if (kind === 'completed') {
    const pod = o.podUploaded ? 'POD on file (local admin)' : 'No POD uploaded yet'
    const pay = (q.payment_status && String(q.payment_status)) || '—'
    const adminNote =
      (q.admin_completion_note && String(q.admin_completion_note).trim()) ||
      (o.adminCompletionNote && String(o.adminCompletionNote).trim()) ||
      '—'
    return [
      { label: 'Completed / closed', value: completionTimestamp(q, job) },
      { label: 'Admin completion note', value: adminNote },
      { label: 'POD / evidence', value: pod },
      { label: 'Payment', value: pay },
    ]
  }
  if (kind === 'cancelled') {
    const reason =
      (q.admin_cancellation_reason && String(q.admin_cancellation_reason).trim()) ||
      (o.adminCancellationReason && String(o.adminCancellationReason).trim()) ||
      (o.cancellationReason || '').trim() ||
      'No cancellation reason yet'
    const by = (o.cancelledBy || '').trim() || 'Not recorded yet'
    const refund = (o.refundStatus || '').trim() || 'Not recorded yet'
    return [
      { label: 'Cancellation reason', value: reason },
      { label: 'Cancelled by', value: by },
      { label: 'Refund status', value: refund },
    ]
  }
  return []
}

/**
 * @param {WorkflowKind} kind
 * @param {Record<string, unknown>} q
 * @param {Record<string, unknown> | null} job
 */
function workflowStatusBadge(kind, q, job) {
  if (kind === 'marketplace') {
    const acceptance = partnerAcceptanceLabelForMarketplaceCard(q)
    if (acceptance === 'Accepted') {
      return { label: 'Partner accepted', tone: 'amber' }
    }
    return { label: 'On marketplace', tone: 'violet' }
  }
  if (kind === 'active') {
    return dispatchWorkflowBadge(q, job)
  }
  if (kind === 'completed') {
    return { label: 'Completed', tone: 'emerald' }
  }
  return { label: 'Cancelled', tone: 'slate' }
}

/**
 * @param {{ workflow: WorkflowKind, title: string, description: string }} props
 */
export default function AdminWorkflowJobList({ workflow, title, description }) {
  const [searchInput, setSearchInput] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [quotes, setQuotes] = useState([])
  const [jobs, setJobs] = useState([])
  const [marketplaceJourneys, setMarketplaceJourneys] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payFilter, setPayFilter] = useState('all')
  const [viewMode, setViewMode] = useState('list')
  const [page, setPage] = useState(0)
  const [cancelledCharges, setCancelledCharges] = useState([])

  useEffect(() => {
    const t = setTimeout(() => setActiveSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [qList, jList] = await Promise.all([
        fetchQuotesForAdmin('all', activeSearch),
        fetchAllJobs(),
      ])
      let jJourneys = []
      if (workflow === 'marketplace') {
        const raw = await fetchMarketplaceJourneysForAdmin(activeSearch)
        jJourneys = filterMarketplaceJourneys(Array.isArray(raw) ? raw : [])
      }
      setMarketplaceJourneys(jJourneys)
      const qSafe = Array.isArray(qList) ? qList : []
      const jSafe = Array.isArray(jList) ? jList : []
      setQuotes(qSafe)
      setJobs(jSafe)
      if (workflow === 'active') void loadFleetDriversForAdmin()
      if (workflow === 'cancelled' && qSafe.length > 0) {
        const ids = qSafe.map((q) => String(q.id || '')).filter(Boolean)
        try {
          const charges = await fetchDriverChargesByQuoteIds(ids)
          setCancelledCharges(Array.isArray(charges) ? charges : [])
        } catch {
          setCancelledCharges([])
        }
      } else {
        setCancelledCharges([])
      }
    } catch (e) {
      console.error('[AdminWorkflowJobList.load]', e)
      setError(e?.message || 'Failed to load data.')
      setQuotes([])
      setJobs([])
      setMarketplaceJourneys([])
    } finally {
      setLoading(false)
    }
  }, [activeSearch, workflow])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => subscribeAdminDataRefresh(load), [load])

  useEffect(() => {
    setPage(0)
  }, [workflow, activeSearch, payFilter, viewMode])

  const filtered = useMemo(() => {
    const qSafe = Array.isArray(quotes) ? quotes : []
    const jSafe = Array.isArray(jobs) ? jobs : []
    let list = qSafe
    if (workflow === 'marketplace') list = filterMarketplaceQuotes(qSafe, jSafe)
    else if (workflow === 'active') list = filterActiveQuotes(qSafe, jSafe)
    else if (workflow === 'completed') list = filterCompletedQuotes(qSafe, jSafe)
    else if (workflow === 'cancelled') list = filterCancelledQuotes(qSafe, jSafe)

    if (payFilter === 'paid') {
      list = list.filter((q) => String(q.payment_status) === 'paid')
    } else if (payFilter === 'not_paid') {
      list = list.filter((q) => String(q.payment_status) !== 'paid')
    }
    if (workflow === 'marketplace') {
      list = [...list].filter((q) => q && typeof q === 'object').sort(compareMarketplaceJobsAdmin)
    }
    return list
  }, [quotes, jobs, workflow, payFilter])

  const pageSlice = useMemo(() => {
    const start = page * PAGE_SIZE
    const safe = filtered.filter((q) => q && typeof q === 'object')
    return safe.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  const emptyMessage = useMemo(() => {
    if (loading) return ''
    const jn = workflow === 'marketplace' ? marketplaceJourneys.length : 0
    if (filtered.length > 0 || jn > 0) return ''
    return activeSearch ? 'No jobs match this search.' : 'No jobs in this workflow yet.'
  }, [loading, filtered.length, activeSearch, workflow, marketplaceJourneys.length])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">{description}</p>
          <p className="mt-2 text-xs text-slate-500">
            Data from live <code className="rounded bg-slate-100 px-1">quotes</code> +{' '}
            <code className="rounded bg-slate-100 px-1">jobs</code> rows. Marketplace/driver fields without DB columns
            use this browser&apos;s admin session until you add an API.
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

      {workflow === 'marketplace' ? (
        <p className="rounded-xl border border-violet-200/80 bg-violet-50/60 px-4 py-3 text-sm text-violet-950">
          Driver payout is set when you send a job from Available Jobs. This list shows saved payout only — it does
          not apply platform deduction again. Change payout on the job in Available Jobs or use Edit payout on a
          card.
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="min-w-0 flex-1 sm:max-w-md">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Search by ref / customer
          </span>
          <input
            type="search"
            enterKeyHint="search"
            placeholder={ADMIN_RECORDS_SEARCH_PLACEHOLDER}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setActiveSearch(searchInput.trim())
            }}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <button
          type="button"
          onClick={() => setActiveSearch(searchInput.trim())}
          className="min-h-[48px] rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 sm:min-h-[46px]"
        >
          Search
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment</span>
        {[
          { key: 'all', label: 'All' },
          { key: 'paid', label: 'Paid (full)' },
          { key: 'not_paid', label: 'Not fully paid' },
        ].map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setPayFilter(f.key)}
            className={`min-h-[36px] rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              payFilter === f.key
                ? 'bg-brand-600 text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-500">
          {workflow === 'marketplace'
            ? `${filtered.length} job${filtered.length === 1 ? '' : 's'} · ${marketplaceJourneys.length} journey${
                marketplaceJourneys.length === 1 ? '' : 's'
              }`
            : `${filtered.length} job${filtered.length === 1 ? '' : 's'}`}
        </span>
        {workflow !== 'active' && workflow !== 'completed' && workflow !== 'cancelled' ? (
          <div
            className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm"
            role="group"
            aria-label="View mode"
          >
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
        ) : null}
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      )}

      {loading ? (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">
          <span
            className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600"
            aria-hidden
          />
          Loading…
        </div>
      ) : emptyMessage ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
          {emptyMessage}
        </p>
      ) : (
        <>
          {workflow === 'marketplace' && marketplaceJourneys.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Journey bundles</h3>
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {marketplaceJourneys.map((j) => (
                  <MarketplaceJourneyCard key={String(j.id)} journey={j} onApplied={load} />
                ))}
              </ul>
            </div>
          ) : null}
          {workflow === 'marketplace' && marketplaceJourneys.length > 0 ? (
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Single marketplace jobs</h3>
          ) : null}
          {workflow === 'active' ? (
            <JobAcceptedListTable quotes={filtered} jobs={jobs} onUpdated={load} />
          ) : workflow === 'completed' ? (
            <CompletedJobsListTable quotes={filtered} jobs={jobs} />
          ) : workflow === 'cancelled' ? (
            <CancelledJobsListTable quotes={filtered} jobs={jobs} charges={cancelledCharges} />
          ) : (
            <AdminJobListSections
              jobs={viewMode === 'list' ? filtered : pageSlice}
              viewMode={viewMode}
              renderJob={(q) => {
                const job = findLinkedJobForQuote(q, jobs)
                const rows = buildWorkflowRows(workflow, q, job)
                const badge = workflowStatusBadge(workflow, q, job)
                const driverId =
                  q.assigned_driver_id != null ? String(q.assigned_driver_id) : ''
                const chargeActions =
                  workflow === 'completed' && driverId ? (
                    <DriverChargeQuickActions
                      driverId={driverId}
                      quoteId={q.id != null ? String(q.id) : null}
                      jobId={job?.id != null ? String(job.id) : null}
                      quoteRef={String(q.quote_ref || '')}
                      onUpdated={load}
                    />
                  ) : null

                const secondarySlot =
                  workflow === 'marketplace' ? (
                    <div className="flex w-full flex-col gap-2">
                      <MarketplaceJobRemoveButton quote={q} onApplied={load} />
                      <MarketplaceJobCardActions quote={q} onApplied={load} />
                    </div>
                  ) : workflow === 'completed' && chargeActions ? (
                    <div className="flex w-full flex-col gap-2">{chargeActions}</div>
                  ) : null

                return (
                  <JobCard
                    q={q}
                    listVariant={workflow}
                    layoutMode={viewMode}
                    statusBadge={badge}
                    workflowRows={rows}
                    secondarySlot={secondarySlot}
                  />
                )
              }}
            />
          )}
          {workflow !== 'active' && viewMode === 'grid' && totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-center gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                disabled={page <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-slate-600">
                Page {page + 1} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
