import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import {
  fetchQuoteByIdForAdmin,
  updateQuoteWorkflowAssignment,
  updateQuoteWorkflowAssignmentSilent,
  updateQuoteWorkflowStatus,
} from '../lib/data/quotesAdminRepository'
import { HOME_PAGE_QUOTE_SOURCE } from '../lib/data/quotesRepository'
import { fetchAllJobs, fetchJobIdsForQuoteRefs } from '../lib/data/jobsRepository'
import { formatDateTimeUK } from '../lib/formatDateDisplay'
import { stripeDashboardSearchUrl } from '../lib/stripeDashboardUrl'
import {
  loadAvailableJobAdminOverrides,
  saveAvailableJobAdminOverrides,
} from '../lib/availableJobLocalStore'
import { mergedAdminWorkflowForQuote } from '../lib/quoteAdminWorkflowMerge'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  buildPricingBreakdownSections,
  parsePricingText,
  resolveFinancials,
} from '../lib/quoteJobAdminModel'
import GenerateJobSheetButton from './admin-workflow/GenerateJobSheetButton'
import { findLinkedJobForQuote, quoteIsCancelled, quoteIsCompleted } from '../lib/adminWorkflowFilters'
import { quotePassesActiveStrict, quotePassesAvailableJobsStrict } from '../lib/adminJobListRules'
import JobDriverAssignmentPanel from './admin-workflow/JobDriverAssignmentPanel'
import CancelBookingAction from './admin-workflow/CancelBookingAction'
import { publishQuoteToMarketplace } from '../lib/marketplacePublishQuote'
import AutoMarketplaceHoldToggle from './admin-workflow/AutoMarketplaceHoldToggle'
import { formatMarketplaceStatusSummary } from '../lib/marketplaceListingStatus'
import AdminJobOverrideActions from './admin-workflow/AdminJobOverrideActions'
import AdminJobQuoteDetailsPanel from './admin-workflow/AdminJobQuoteDetailsPanel'
import { buildAdminJobQuoteDetailsViewModel } from '../lib/adminJobQuoteDetailsViewModel'
import AdminJobDetailsSidebar from './admin-workflow/AdminJobDetailsSidebar'
import JobDispatchControlPanel from './admin-workflow/JobDispatchControlPanel'
import JobDispatchDetailExtras from './admin-workflow/JobDispatchDetailExtras'
import JobAcceptedPayoutEditor from './admin-workflow/JobAcceptedPayoutEditor'
import { fetchJobAssignmentsByQuoteIds } from '../lib/data/jobAssignmentsRepository'
import { normalizeJobAdjustments, sumJobAdjustmentsGbp } from '../lib/jobAdjustments'

const WORKFLOW_STATUSES = ['New', 'Contacted', 'Quoted', 'Booked', 'Completed', 'Cancelled']

const TABS = [
  { id: 'overview', label: 'Dispatch' },
  { id: 'assignment', label: 'Marketplace' },
  { id: 'details', label: 'Job details' },
  { id: 'pricing', label: 'Pricing & payments' },
  { id: 'notes', label: 'Notes & history' },
]

function money(n) {
  if (n == null || n === '') return '—'
  return `£${Number(n).toFixed(2)}`
}

/**
 * Persist admin workflow snapshots to session storage aligned with the quote row after load (legacy fallback paths).
 */
function syncSessionWorkflowFromQuoteRow(quoteId, row) {
  if (!quoteId || !row || typeof row.marketplace_visibility !== 'string') return
  saveAvailableJobAdminOverrides(quoteId, {
    marketplaceVisibility: row.marketplace_visibility,
    marketplacePayoutGbp:
      row.marketplace_payout_price != null && row.marketplace_payout_price !== ''
        ? Number(row.marketplace_payout_price)
        : null,
    assignedDriver: row.assigned_driver_name != null ? String(row.assigned_driver_name) : '',
    assignedPartnerCompany: row.assigned_partner_company != null ? String(row.assigned_partner_company) : '',
    operationalStatus: row.operational_status != null ? String(row.operational_status) : '',
    adminNotesLog: row.admin_notes_log != null ? String(row.admin_notes_log) : '',
    adminCompletionNote: row.admin_completion_note != null ? String(row.admin_completion_note) : '',
    adminCancellationReason: row.admin_cancellation_reason != null ? String(row.admin_cancellation_reason) : '',
    workflowCompletedAt: row.completed_at != null ? String(row.completed_at) : '',
    workflowCancelledAt: row.cancelled_at != null ? String(row.cancelled_at) : '',
    ...(typeof row.partner_dashboard_hidden === 'boolean'
      ? { partnerDashboardHidden: row.partner_dashboard_hidden }
      : {}),
  })
}

function AdminCard({ title, children, className = '' }) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-6 ${className}`.trim()}
    >
      <h3 className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function DlItem({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{value ?? '—'}</dd>
    </div>
  )
}

export default function AvailableJobDetails() {
  const { id } = useParams()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const isActiveJobDetailRoute = /\/admin\/active-jobs\//.test(location.pathname)
  const [q, setQ] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('overview')
  const [statusDraft, setStatusDraft] = useState('')
  const [statusSaving, setStatusSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState({ type: null, text: '' })
  const [overrides, setOverrides] = useState(() => loadAvailableJobAdminOverrides(''))
  const [toast, setToast] = useState('')
  const [notesDraft, setNotesDraft] = useState('')
  const [assignmentSaving, setAssignmentSaving] = useState(false)
  const [jobsList, setJobsList] = useState([])
  const [resolvedJobId, setResolvedJobId] = useState(null)
  const [jobAssignment, setJobAssignment] = useState(/** @type {{ status: string, updated_at: string } | null} */ (null))

  const moreDetailsRef = useRef(null)
  const debugDetailsRef = useRef(null)
  const overrideActionsRef = useRef(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const row = await fetchQuoteByIdForAdmin(id)
      setQ(row ?? null)
    } catch (e) {
      setError(e?.message || 'Failed to load quote.')
      setQ(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const t = (searchParams.get('tab') || '').trim().toLowerCase()
    if (t === 'assignment') setTab('assignment')
  }, [searchParams])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const j = await fetchAllJobs()
        if (!cancelled) setJobsList(j)
      } catch {
        if (!cancelled) setJobsList([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!id || !q) return
    syncSessionWorkflowFromQuoteRow(id, q)
    const merged = mergedAdminWorkflowForQuote(q)
    setOverrides(merged)
    setNotesDraft(merged.internalNotes || '')
  }, [id, q])

  useEffect(() => {
    if (q?.status != null) setStatusDraft(String(q.status))
  }, [q?.status])

  const linkedJob = useMemo(
    () => (q && jobsList.length ? findLinkedJobForQuote(q, jobsList) : null),
    [q, jobsList],
  )

  const photoQuoteRef = useMemo(() => {
    const fromQuote = q?.quote_ref != null ? String(q.quote_ref).trim() : ''
    if (fromQuote) return fromQuote
    const pi = linkedJob?.price_inputs
    if (pi && typeof pi === 'object' && pi.quoteRef != null) {
      return String(pi.quoteRef).trim()
    }
    return ''
  }, [q, linkedJob])

  const legacyPhotoFileNames = useMemo(() => {
    const pi = linkedJob?.price_inputs
    if (!pi || typeof pi !== 'object' || !Array.isArray(pi.photoFileNames)) return []
    return pi.photoFileNames.map((n) => String(n).trim()).filter(Boolean)
  }, [linkedJob])

  const photoJobId = linkedJob?.id != null ? String(linkedJob.id) : resolvedJobId

  useEffect(() => {
    if (linkedJob?.id) {
      setResolvedJobId(String(linkedJob.id))
      return
    }
    const ref = photoQuoteRef
    if (!ref || !isSupabaseConfigured) {
      setResolvedJobId(null)
      return
    }
    let cancelled = false
    void fetchJobIdsForQuoteRefs([ref])
      .then((map) => {
        if (!cancelled) setResolvedJobId(map[ref] ? String(map[ref]) : null)
      })
      .catch(() => {
        if (!cancelled) setResolvedJobId(null)
      })
    return () => {
      cancelled = true
    }
  }, [linkedJob?.id, photoQuoteRef])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    void fetchJobAssignmentsByQuoteIds([String(id)]).then((map) => {
      if (!cancelled) setJobAssignment(map[String(id)] || null)
    })
    return () => {
      cancelled = true
    }
  }, [id, q?.assigned_driver_id, q?.operational_status, q?.updated_at])

  const terminal = Boolean(q && (quoteIsCompleted(q, linkedJob) || quoteIsCancelled(q, linkedJob)))

  const adjustments = useMemo(
    () => normalizeJobAdjustments(overrides.adjustments),
    [overrides.adjustments],
  )

  const adjSum = useMemo(() => sumJobAdjustmentsGbp(adjustments), [adjustments])

  const fin = useMemo(() => (q ? resolveFinancials(q, adjSum) : null), [q, adjSum])

  useEffect(() => {
    if (tab === 'customer' || tab === 'move' || tab === 'inventory') setTab('details')
  }, [tab])

  const pricingParts = useMemo(() => (q ? buildPricingBreakdownSections(q) : null), [q])
  const pricingLines = useMemo(() => (q ? parsePricingText(q.pricing).lines : []), [q])
  const pricingParsed = useMemo(
    () =>
      q ? parsePricingText(q.pricing) : { lines: [], estimatedTotal: null, volumeM3: null },
    [q],
  )

  const stripeRef = q?.stripe_payment_intent_id || q?.stripe_session_id
  const stripeUrl = stripeRef ? stripeDashboardSearchUrl(String(stripeRef)) : null

  const statusOptions = useMemo(() => {
    if (!q) return WORKFLOW_STATUSES
    return WORKFLOW_STATUSES.includes(String(q.status))
      ? WORKFLOW_STATUSES
      : [String(q.status), ...WORKFLOW_STATUSES]
  }, [q])

  const detailsVm = useMemo(() => {
    if (!q) return null
    try {
      return buildAdminJobQuoteDetailsViewModel(q)
    } catch {
      return null
    }
  }, [q])

  function persistOverrides(next) {
    if (!id) return
    saveAvailableJobAdminOverrides(id, next)
    setOverrides(next)
  }

  function closeMoreMenu() {
    const el = moreDetailsRef.current
    if (el) el.open = false
  }

  async function saveWorkflowStatus() {
    if (!id) return
    setStatusSaving(true)
    setStatusMessage({ type: null, text: '' })
    try {
      await updateQuoteWorkflowStatus(id, statusDraft)
      setQ((prev) => (prev ? { ...prev, status: statusDraft } : prev))
      setStatusMessage({ type: 'success', text: 'Status updated.' })
    } catch (e) {
      setStatusMessage({ type: 'error', text: e?.message || 'Could not update status.' })
    } finally {
      setStatusSaving(false)
    }
  }

  function saveNotes() {
    persistOverrides({ ...overrides, internalNotes: notesDraft })
    setToast('Internal notes saved.')
    window.setTimeout(() => setToast(''), 3000)
  }

  function handleAdjustmentsChange(next) {
    persistOverrides({ ...overrides, adjustments: next })
  }

  function showToast(msg) {
    setToast(msg)
    window.setTimeout(() => setToast(''), 4000)
  }

  async function assignToMarketplace() {
    if (!id || !q) return
    try {
      setAssignmentSaving(true)
      const result = await publishQuoteToMarketplace(id, q)
      if (result.localOnly) {
        persistOverrides({
          ...overrides,
          marketplaceVisibility: 'visible_in_marketplace',
          assignedDriver: '',
          assignedPartnerCompany: '',
          operationalStatus: '',
          partnerDashboardHidden: false,
        })
        setOverrides(loadAvailableJobAdminOverrides(id))
        setToast('Marketplace listing saved locally. Connect the database to sync with the server.')
      } else {
        await load()
        setToast('Job is now visible on the marketplace. Partner payout has been calculated.')
      }
      window.setTimeout(() => setToast(''), 5000)
    } catch (e) {
      setToast(e?.message || 'Could not list job on marketplace.')
      window.setTimeout(() => setToast(''), 6000)
    } finally {
      setAssignmentSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-slate-600">
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600"
          aria-hidden
        />
        Loading job…
      </div>
    )
  }

  if (!q) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-slate-600">{error || 'Job not found.'}</p>
        <Link
          to={isActiveJobDetailRoute ? '/admin/active-jobs' : '/admin/available-jobs'}
          className="mt-4 inline-block font-semibold text-brand-700 hover:underline"
        >
          {isActiveJobDetailRoute ? 'Back to Job Accepted' : 'Back to Available Jobs'}
        </Link>
      </div>
    )
  }

  const inJobAccepted = isActiveJobDetailRoute || quotePassesActiveStrict(q)
  const backHref = q.source === HOME_PAGE_QUOTE_SOURCE
    ? '/admin/quote-requests'
    : inJobAccepted
      ? '/admin/active-jobs'
      : '/admin/available-jobs'
  const backLabel = q.source === HOME_PAGE_QUOTE_SOURCE
    ? 'Quote requests'
    : inJobAccepted
      ? 'Job Accepted'
      : 'Available Jobs'
  const fullPageDispatch = isActiveJobDetailRoute

  const mv = overrides.marketplaceVisibility
  const listedOnMarketplace = mv === 'visible_in_marketplace'

  return (
    <div className="mx-auto max-w-[90rem] space-y-3 px-2 pb-16 sm:px-4 lg:px-5">
      {toast ? (
        <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">{toast}</p>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      {!fullPageDispatch && tab !== 'overview' ? (
        <nav className="flex flex-wrap items-center gap-2 text-sm">
          <Link to={backHref} className="font-semibold text-brand-700 hover:underline">
            ← {backLabel}
          </Link>
          <span className="text-slate-300">/</span>
          <span className="font-mono text-xs text-slate-600">{String(q.quote_ref || q.id)}</span>
        </nav>
      ) : null}

      {!fullPageDispatch ? (
      <div
        role="tablist"
        aria-label="Job sections"
        className="flex flex-wrap gap-0.5 border-b border-slate-200"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`relative -mb-px min-h-[40px] shrink-0 border-b-2 px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm ${
              tab === t.id
                ? 'border-brand-600 text-slate-900'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
            }`}
            data-tab={t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      ) : null}

      {tab === 'overview' && !fullPageDispatch && quotePassesAvailableJobsStrict(q) ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
          {listedOnMarketplace ? (
            <button
              type="button"
              disabled={terminal || assignmentSaving}
              className="rounded-md border border-slate-200 px-2.5 py-1 font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40"
              onClick={() => overrideActionsRef.current?.openReturnToMarketplace?.()}
            >
              Return to marketplace
            </button>
          ) : (
            <button
              type="button"
              disabled={terminal || assignmentSaving}
              onClick={() => void assignToMarketplace()}
              className="rounded-md bg-brand-600 px-2.5 py-1 font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
            >
              {assignmentSaving ? 'Saving…' : 'Send to marketplace'}
            </button>
          )}
          <CancelBookingAction quote={q} className="!min-h-0 !rounded-md !px-2.5 !py-1 !text-xs" onApplied={load} />
          <AutoMarketplaceHoldToggle q={q} onUpdated={load} />
        </div>
      ) : null}

      <div className={`mt-3 ${fullPageDispatch || tab === 'overview' ? '' : 'grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_14rem] xl:items-start'}`}>
        <div className="min-w-0 space-y-4">
      {fullPageDispatch || tab === 'overview' ? (
        <>
          <JobDispatchControlPanel
            q={q}
            vm={detailsVm}
            fin={fin}
            overrides={overrides}
            linkedJob={linkedJob}
            assignment={jobAssignment}
            adjustments={adjustments}
            onAdjustmentsChange={handleAdjustmentsChange}
            adjSum={adjSum}
            terminal={terminal}
            backHref={backHref}
            backLabel={backLabel}
            notesDraft={notesDraft}
            onMarkComplete={() => overrideActionsRef.current?.openMarkComplete?.()}
            onMarkCompleteWithIssues={() => overrideActionsRef.current?.openMarkCompleteWithIssues?.()}
            onCancelJob={() => overrideActionsRef.current?.openMarkCancelled?.()}
            onReload={load}
            onNotify={showToast}
          />
          {!fullPageDispatch && tab === 'overview' ? (
            <AdminCard title="Payment & marketplace payout">
              <JobAcceptedPayoutEditor q={q} onUpdated={load} />
            </AdminCard>
          ) : null}
          {fullPageDispatch ? (
            <JobDispatchDetailExtras
              q={q}
              notesDraft={notesDraft}
              onNotesDraftChange={setNotesDraft}
              onSaveNotes={saveNotes}
              onAddTimelineNote={() => overrideActionsRef.current?.openAddAdminNote?.()}
              photoQuoteRef={photoQuoteRef}
              jobId={photoJobId}
              linkedJob={linkedJob}
              legacyPhotoFileNames={legacyPhotoFileNames}
              overrides={overrides}
              onReload={load}
            />
          ) : null}
        </>
      ) : null}

      {!fullPageDispatch && tab === 'assignment' ? (
        <AdminCard title="Assignment & marketplace">
          <JobDriverAssignmentPanel quote={q} linkedJob={linkedJob} onApplied={load} />
          <dl className="mt-6 grid gap-4 border-t border-slate-100 pt-6 text-sm sm:grid-cols-2">
            <DlItem label="Marketplace status" value={formatMarketplaceStatusSummary(q)} />
            <DlItem
              label="Marketplace payout"
              value={
                overrides.marketplacePayoutGbp != null && Number.isFinite(Number(overrides.marketplacePayoutGbp))
                  ? money(overrides.marketplacePayoutGbp)
                  : '—'
              }
            />
            <DlItem
              label="Partner acceptance"
              value={(overrides.partnerAcceptanceStatus || '').trim() || '—'}
            />
            <DlItem label="Assigned partner" value={(overrides.assignedPartnerCompany || '').trim() || '—'} />
          </dl>
          <p className="mt-4 text-xs text-slate-500">
            Partner listing visibility (visible / hidden for the Partner Dashboard) and payouts are managed from the{' '}
            <Link to="/admin/marketplace" className="font-semibold text-brand-700 hover:underline">
              Marketplace
            </Link>{' '}
            admin page.
          </p>
        </AdminCard>
      ) : null}

      {!fullPageDispatch && tab === 'details' ? (
        <AdminJobQuoteDetailsPanel
          quote={q}
          jobId={photoJobId}
          photoQuoteRef={photoQuoteRef}
          quoteRow={q}
          linkedJob={linkedJob}
          legacyPhotoFileNames={legacyPhotoFileNames}
        />
      ) : null}

      {!fullPageDispatch && tab === 'pricing' ? (
        <AdminCard title="Pricing & payments">
          {!pricingParts || pricingLines.length === 0 ? (
            <p className="text-sm text-slate-600">No saved pricing breakdown for this job.</p>
          ) : (
            <div className="space-y-4 text-sm">
              {[
                ['Base', pricingParts.base],
                ['Distance', pricingParts.distance],
                ['Volume', pricingParts.volume],
                ['Floor / access', pricingParts.floorAccess],
                ['No lift supplement', pricingParts.noLift],
                ['Heavy items', pricingParts.heavy],
                ['Adjustments & other', [...pricingParts.extras, ...pricingParts.other]],
              ].map(([label, rows]) =>
                rows.length ? (
                  <div key={label}>
                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</h4>
                    <ul className="mt-2 space-y-1">
                      {rows.map((row) => (
                        <li key={row.label} className="flex justify-between gap-4 text-slate-800">
                          <span className="min-w-0">{row.label}</span>
                          <span className="shrink-0 tabular-nums font-medium">£{row.amount.toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null,
              )}
              <div className="border-t border-slate-200 pt-3">
                <div className="flex justify-between text-base font-bold text-slate-900">
                  <span>Customer total (from quote)</span>
                  <span className="tabular-nums">
                    {pricingParsed.estimatedTotal != null
                      ? money(pricingParsed.estimatedTotal)
                      : fin?.customerTotal != null
                        ? money(fin.customerTotal - adjSum)
                        : '—'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Admin adjustments ({money(adjSum)}) are applied on top; header shows the live customer total.
                </p>
              </div>
            </div>
          )}

          <div className="mt-8 border-t border-slate-100 pt-6">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Payment record</h4>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <DlItem label="Payment status" value={q.payment_status ?? '—'} />
              <DlItem
                label="Payment type"
                value={q.payment_type === 'deposit' ? 'Deposit' : q.payment_type === 'full' ? 'Full' : q.payment_type ?? '—'}
              />
              <DlItem label="Amount paid" value={money(q.amount_paid)} />
              <DlItem label="Paid date" value={formatDateTimeUK(q.paid_at)} />
              <DlItem label="Stripe payment intent" value={q.stripe_payment_intent_id || '—'} />
              <DlItem label="Stripe checkout session" value={q.stripe_session_id || '—'} />
              <DlItem label="Remaining balance" value={fin?.remaining != null ? money(fin.remaining) : '—'} />
            </dl>
            {stripeUrl ? (
              <a
                href={stripeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Open in Stripe
              </a>
            ) : null}
          </div>

          {adjustments.length > 0 ? (
            <p className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-500">
              {adjustments.length} admin adjustment{adjustments.length === 1 ? '' : 's'} ({money(adjSum)}) — manage on
              the Overview tab.
            </p>
          ) : null}
        </AdminCard>
      ) : null}

      {!fullPageDispatch && tab === 'notes' ? (
        <div className="space-y-6">
          <AdminCard title="Internal notes">
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={6}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
              placeholder="Driver brief, access quirks, risk flags…"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveNotes}
                className="min-h-[44px] rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Save internal notes
              </button>
              <button
                type="button"
                onClick={() => overrideActionsRef.current?.openAddAdminNote?.()}
                className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
              >
                Add timeline entry
              </button>
            </div>
          </AdminCard>

          <AdminCard title="Assignment & override log">
            {(overrides.adminNotesLog || '').trim() ? (
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-100 bg-slate-50/90 p-4 font-mono text-xs text-slate-800">
                {String(overrides.adminNotesLog)}
              </pre>
            ) : (
              <p className="text-sm text-slate-600">No log entries yet.</p>
            )}
          </AdminCard>

          <AdminCard title="Customer email history">
            <p className="text-sm text-slate-600">No outbound email log is stored on this quote yet.</p>
          </AdminCard>

          <details ref={debugDetailsRef} className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-800 marker:content-none [&::-webkit-details-marker]:hidden">
              Raw quote record (debug)
            </summary>
            <div className="border-t border-slate-200 px-4 py-3">
              <pre className="max-h-80 overflow-auto rounded-lg bg-white p-3 font-mono text-[11px] leading-relaxed text-slate-800">
                {JSON.stringify(q, null, 2)}
              </pre>
            </div>
          </details>
        </div>
      ) : null}

        </div>

        {!fullPageDispatch && tab !== 'overview' ? (
          <AdminJobDetailsSidebar
            quote={q}
            overrides={overrides}
            terminal={terminal}
            onOpenReassignDriver={() => overrideActionsRef.current?.openReassignDriver?.()}
            onOpenReassignPartner={() => overrideActionsRef.current?.openReassignPartner?.()}
            onMarkComplete={() => overrideActionsRef.current?.openMarkComplete?.()}
            onCancelJob={() => overrideActionsRef.current?.openMarkCancelled?.()}
          />
        ) : null}
      </div>

      <AdminJobOverrideActions
        ref={overrideActionsRef}
        quote={q}
        jobs={jobsList}
        onApplied={() => void load()}
        showTriggerButtons={false}
      />

    </div>
  )
}
