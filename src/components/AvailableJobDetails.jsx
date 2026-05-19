import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  fetchAssignedByActor,
  fetchQuoteByIdForAdmin,
  updateQuoteWorkflowAssignment,
  updateQuoteWorkflowAssignmentSilent,
  updateQuoteWorkflowStatus,
} from '../lib/data/quotesAdminRepository'
import { HOME_PAGE_QUOTE_SOURCE } from '../lib/data/quotesRepository'
import { fetchAllJobs } from '../lib/data/jobsRepository'
import { removeJobAssignmentForQuote } from '../lib/data/driverAssignmentSync'
import { formatDateTimeUK, formatDateUK } from '../lib/formatDateDisplay'
import { stripeDashboardSearchUrl } from '../lib/stripeDashboardUrl'
import {
  loadAvailableJobAdminOverrides,
  saveAvailableJobAdminOverrides,
} from '../lib/availableJobLocalStore'
import { mergedAdminWorkflowForQuote } from '../lib/quoteAdminWorkflowMerge'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  buildPricingBreakdownSections,
  deriveCardStatusBadge,
  parsePricingText,
  resolveFinancials,
} from '../lib/quoteJobAdminModel'
import GenerateJobSheetButton from './admin-workflow/GenerateJobSheetButton'
import { findLinkedJobForQuote, quoteIsCancelled, quoteIsCompleted } from '../lib/adminWorkflowFilters'
import { quotePassesAvailableJobsStrict } from '../lib/adminJobListRules'
import { isQuoteDemoOrTest } from '../lib/cancelDemoBooking'
import CancelDemoBookingAction from './admin-workflow/CancelDemoBookingAction'
import { applyDefaultMarketplacePayoutToQuote } from '../lib/marketplacePayoutApply'
import { formatMarketplaceStatusSummary } from '../lib/marketplaceListingStatus'
import AdminJobOverrideActions from './admin-workflow/AdminJobOverrideActions'
import AdminJobQuoteDetailsPanel from './admin-workflow/AdminJobQuoteDetailsPanel'
import JobStatusBadge from './admin-workflow/JobStatusBadge'
import { buildAdminJobQuoteDetailsViewModel, liftReadable } from '../lib/adminJobQuoteDetailsViewModel'
import AdminJobDetailsSidebar from './admin-workflow/AdminJobDetailsSidebar'
import { AdminChip } from './admin-workflow/AdminJobUiPrimitives'

const WORKFLOW_STATUSES = ['New', 'Contacted', 'Quoted', 'Booked', 'Completed', 'Cancelled']

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'assignment', label: 'Assignment & marketplace' },
  { id: 'details', label: 'Job details' },
  { id: 'pricing', label: 'Pricing & payments' },
  { id: 'notes', label: 'Notes & history' },
]

function money(n) {
  if (n == null || n === '') return '—'
  return `£${Number(n).toFixed(2)}`
}

function paymentTone(ps) {
  const p = String(ps || '').toLowerCase()
  if (p === 'paid') return 'emerald'
  if (p === 'deposit_paid') return 'sky'
  return 'slate'
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

function PinMini({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0Z" />
    </svg>
  )
}

/** @param {{ vm: Record<string, unknown>, q: Record<string, unknown> }} props */
function JobDetailsInsightsStrip({ vm, q }) {
  const paidTone = paymentTone(q.payment_status)
  const chipPaidTone = paidTone === 'emerald' ? 'emerald' : paidTone === 'sky' ? 'sky' : 'slate'
  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="flex gap-3 rounded-xl border border-violet-100 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.03]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white shadow-sm">
            <PinMini className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-violet-800">Pickup route</p>
            <p className="mt-1 text-sm font-semibold leading-snug text-slate-900">{q.pickup_address || '—'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-900 ring-1 ring-violet-100">
                {vm.distanceDisplay}
              </span>
              <span className="rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200/80">
                {vm.arrivalLine}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-3 rounded-xl border border-emerald-100 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.03]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
            <PinMini className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">Dropoff route</p>
            <p className="mt-1 text-sm font-semibold leading-snug text-slate-900">{q.delivery_address || '—'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-900 ring-1 ring-emerald-100">
                {vm.distanceDisplay}
              </span>
              <span className="rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200/80">
                {vm.arrivalLine}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <AdminChip label="Lift (P/U)" value={liftReadable(vm.pickupLiftRaw)} tone="slate" />
        <AdminChip label="Lift (D/O)" value={liftReadable(vm.deliveryLiftRaw)} tone="slate" />
        <AdminChip
          label="Parking"
          value={String(vm.parking).length > 36 ? `${String(vm.parking).slice(0, 34)}…` : String(vm.parking)}
          tone="amber"
        />
        <AdminChip
          label="Walking"
          value={String(vm.walking).length > 24 ? `${String(vm.walking).slice(0, 22)}…` : String(vm.walking)}
          tone="sky"
        />
        <AdminChip label="Crew size" value={vm.crewDisplay} tone="slate" />
        <AdminChip label="Paid status" value={vm.paidLabel} tone={chipPaidTone} />
      </div>
    </div>
  )
}

export default function AvailableJobDetails() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
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
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustDesc, setAdjustDesc] = useState('')
  const [adjustAmount, setAdjustAmount] = useState('')
  const [assignmentSaving, setAssignmentSaving] = useState(false)
  const [jobsList, setJobsList] = useState([])

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

  const terminal = Boolean(q && (quoteIsCompleted(q, linkedJob) || quoteIsCancelled(q, linkedJob)))

  const adjSum = useMemo(
    () => (overrides.adjustments || []).reduce((s, a) => s + (Number(a.amountGbp) || 0), 0),
    [overrides.adjustments],
  )

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

  function addAdjustment() {
    const amt = parseFloat(String(adjustAmount).replace(/,/g, ''))
    if (!adjustDesc.trim() || !Number.isFinite(amt) || amt === 0) {
      setToast('Enter a description and non-zero amount.')
      window.setTimeout(() => setToast(''), 4000)
      return
    }
    const row = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      description: adjustDesc.trim(),
      amountGbp: amt,
      createdAt: new Date().toISOString(),
      status: 'pending',
    }
    persistOverrides({ ...overrides, adjustments: [...(overrides.adjustments || []), row] })
    setAdjustOpen(false)
    setAdjustDesc('')
    setAdjustAmount('')
    setToast(`Adjustment ${money(amt)} recorded.`)
    window.setTimeout(() => setToast(''), 4000)
  }

  async function assignToMarketplace() {
    if (!id || !q) return
    const ts = new Date().toISOString()
    const mergedQuote = {
      ...q,
      marketplace_visibility: 'visible_in_marketplace',
      assigned_driver_id: null,
      assigned_driver_name: null,
      assigned_partner_id: null,
      assigned_partner_company: null,
      operational_status: null,
    }
    try {
      setAssignmentSaving(true)
      if (!isSupabaseConfigured) {
        persistOverrides({
          ...overrides,
          marketplaceVisibility: 'visible_in_marketplace',
          assignedDriver: '',
          assignedPartnerCompany: '',
          operationalStatus: '',
          partnerDashboardHidden: false,
        })
        await applyDefaultMarketplacePayoutToQuote(mergedQuote)
        setOverrides(loadAvailableJobAdminOverrides(id))
        setToast('Marketplace listing saved locally. Connect the database to sync with the server.')
        window.setTimeout(() => setToast(''), 5000)
        return
      }
      const by = await fetchAssignedByActor()
      await updateQuoteWorkflowAssignment(id, {
        marketplace_visibility: 'visible_in_marketplace',
        assigned_driver_id: null,
        assigned_driver_name: null,
        assigned_partner_id: null,
        assigned_partner_company: null,
        operational_status: null,
        assigned_at: ts,
        assigned_by: by,
      })
      await updateQuoteWorkflowAssignmentSilent(id, { partner_dashboard_hidden: false })
      await removeJobAssignmentForQuote(id)
      await applyDefaultMarketplacePayoutToQuote(mergedQuote)
      await load()
      setToast('Job is now visible on the marketplace. Partner payout has been calculated.')
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
        <Link to="/admin/available-jobs" className="mt-4 inline-block font-semibold text-brand-700 hover:underline">
          Back to Available Jobs
        </Link>
      </div>
    )
  }

  const backHref = q.source === HOME_PAGE_QUOTE_SOURCE ? '/admin/quote-requests' : '/admin/available-jobs'
  const backLabel = q.source === HOME_PAGE_QUOTE_SOURCE ? 'Quote requests' : 'Available Jobs'

  const workflowBadge = deriveCardStatusBadge(q)
  const mv = overrides.marketplaceVisibility
  const listedOnMarketplace = mv === 'visible_in_marketplace'

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-2 pb-20 sm:px-4 lg:px-6">
      {toast ? (
        <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">{toast}</p>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      <header className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_4px_24px_-8px_rgba(15,23,42,0.1)]">
        <nav className="border-b border-slate-100 bg-slate-50/60 px-4 py-2.5 sm:px-6" aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
            <li>
              <Link to={backHref} className="text-brand-700 transition hover:text-brand-800 hover:underline">
                {backLabel}
              </Link>
            </li>
            <li className="text-slate-300" aria-hidden>
              /
            </li>
            <li className="font-semibold text-slate-800">Job details</li>
          </ol>
        </nav>

        <div className="p-5 sm:p-6 lg:p-8">
          <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1 space-y-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Job reference</p>
              <p className="font-mono text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {String(q.quote_ref || q.id)}
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{q.full_name || 'Customer'}</h1>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600">
                <span>
                  <span className="font-semibold text-slate-400">Move date</span>{' '}
                  <span className="font-semibold text-slate-900">{q.move_date ? formatDateUK(q.move_date) : '—'}</span>
                </span>
                <span className="hidden h-4 w-px bg-slate-200 sm:inline" aria-hidden />
                <span>
                  <span className="font-semibold text-slate-400">Created</span>{' '}
                  <span className="text-slate-800">{formatDateTimeUK(q.created_at)}</span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <JobStatusBadge label={workflowBadge.label} tone={workflowBadge.tone} />
                <JobStatusBadge
                  label={String(q.payment_status || 'unpaid').replace(/_/g, ' ')}
                  tone={paymentTone(q.payment_status)}
                />
                {String(q.status || '').trim() ? (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-800">
                    Workflow · {String(q.status)}
                  </span>
                ) : null}
                {isQuoteDemoOrTest(q) ? <JobStatusBadge label="Demo/Test" tone="slate" /> : null}
              </div>
            </div>

            <div className="flex w-full flex-col gap-4 xl:w-auto xl:max-w-md xl:items-end">
              <div className="grid w-full grid-cols-3 gap-2 rounded-2xl border border-slate-100 bg-slate-50/90 p-3 sm:max-w-md">
                <div className="text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Total</p>
                  <p className="mt-1 text-sm font-bold tabular-nums text-slate-900">
                    {fin?.customerTotal != null ? money(fin.customerTotal) : '—'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Paid</p>
                  <p className="mt-1 text-sm font-bold tabular-nums text-emerald-700">{money(fin?.paid)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Balance</p>
                  <p className="mt-1 text-sm font-bold tabular-nums text-amber-800">
                    {fin?.remaining != null ? money(fin.remaining) : '—'}
                  </p>
                </div>
              </div>

              <div className="flex w-full flex-wrap items-center justify-end gap-2">
                <GenerateJobSheetButton
                  quote={q}
                  internalNotes={notesDraft}
                  variant="secondary"
                  className="order-0 w-full sm:w-auto"
                  onSuccess={(msg) => {
                    setToast(msg)
                    window.setTimeout(() => setToast(''), 3000)
                  }}
                  onError={(msg) => {
                    setToast(msg)
                    window.setTimeout(() => setToast(''), 5000)
                  }}
                />
                {quotePassesAvailableJobsStrict(q) && !terminal ? (
                  <CancelDemoBookingAction
                    quote={q}
                    className="order-0 w-full sm:w-auto"
                    onApplied={async () => {
                      await load()
                    }}
                  />
                ) : null}
                <details ref={moreDetailsRef} className="group relative order-1">
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                    More actions
                    <span className="ml-1 text-slate-400" aria-hidden>
                      ▾
                    </span>
                  </summary>
                  <div className="absolute right-0 top-full z-30 mt-1 min-w-[14rem] rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                    <button
                      type="button"
                      className="block w-full px-4 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50"
                      onClick={() => {
                        closeMoreMenu()
                        setAdjustOpen(true)
                      }}
                    >
                      Add adjustment
                    </button>
                    <button
                      type="button"
                      disabled
                      title="Additional inventory editing is not available yet. Use job notes or pricing adjustments."
                      className="block w-full cursor-not-allowed px-4 py-2.5 text-left text-sm text-slate-500 opacity-65"
                    >
                      Add more items
                    </button>
                    <button
                      type="button"
                      disabled
                      title="Access-based repricing from this menu is not available yet."
                      className="block w-full cursor-not-allowed px-4 py-2.5 text-left text-sm text-slate-500 opacity-65"
                    >
                      Add stairs / access charge
                    </button>
                    <GenerateJobSheetButton
                      quote={q}
                      internalNotes={notesDraft}
                      variant="menu"
                      onSuccess={(msg) => {
                        closeMoreMenu()
                        setToast(msg)
                        window.setTimeout(() => setToast(''), 3000)
                      }}
                      onError={(msg) => {
                        closeMoreMenu()
                        setToast(msg)
                        window.setTimeout(() => setToast(''), 5000)
                      }}
                    />
                    <button
                      type="button"
                      className="block w-full px-4 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50"
                      onClick={() => {
                        closeMoreMenu()
                        const subj = encodeURIComponent(`Job ${q.quote_ref || ''}`)
                        const em = String(q.email || '').trim()
                        if (!em) {
                          setToast('No customer email on file.')
                          window.setTimeout(() => setToast(''), 3000)
                          return
                        }
                        window.location.href = `mailto:${em}?subject=${subj}`
                      }}
                    >
                      Send customer email
                    </button>
                    <button
                      type="button"
                      className="block w-full px-4 py-2.5 text-left text-sm text-red-800 hover:bg-red-50"
                      onClick={() => {
                        closeMoreMenu()
                        overrideActionsRef.current?.openMarkCancelled?.()
                      }}
                    >
                      Cancel job
                    </button>
                    <button
                      type="button"
                      className="block w-full px-4 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50"
                      onClick={() => {
                        closeMoreMenu()
                        setTab('notes')
                        requestAnimationFrame(() => {
                          const el = debugDetailsRef.current
                          if (el) {
                            el.open = true
                            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                          }
                        })
                      }}
                    >
                      Open raw debug data
                    </button>
                  </div>
                </details>
                <button
                  type="button"
                  disabled={terminal}
                  onClick={() => overrideActionsRef.current?.openMarkComplete?.()}
                  className="order-2 min-h-[44px] rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Mark completed
                </button>
                {listedOnMarketplace ? (
                  <button
                    type="button"
                    disabled={terminal || assignmentSaving}
                    className="order-3 min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => {
                      overrideActionsRef.current?.openReturnToMarketplace?.()
                    }}
                  >
                    Return to marketplace…
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={terminal || assignmentSaving}
                    onClick={() => void assignToMarketplace()}
                    className="order-3 min-h-[44px] rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {assignmentSaving ? 'Saving…' : 'Send to marketplace'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 bg-gradient-to-br from-slate-50/80 via-white to-slate-50/40 px-4 py-5 sm:px-6 lg:px-8">
          {detailsVm ? (
            <JobDetailsInsightsStrip vm={detailsVm} q={q} />
          ) : (
            <p className="text-sm text-slate-600">
              Route summary could not be built for this job (missing or unexpected quote fields). Other tabs below
              still work.
            </p>
          )}
        </div>
      </header>

      <div
        role="tablist"
        aria-label="Job sections"
        className="flex flex-wrap gap-1 border-b border-slate-200"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`relative -mb-px min-h-[44px] shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition sm:px-5 ${
              tab === t.id
                ? 'border-brand-600 text-slate-900'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-8 xl:mt-8 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start">
        <div className="min-w-0 space-y-6">
      {tab === 'overview' ? (
        <AdminCard title="Overview">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <label className="min-w-0 flex-1">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Workflow status
              </span>
              <select
                value={statusDraft}
                onChange={(e) => setStatusDraft(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={statusSaving || statusDraft === q.status}
              onClick={() => void saveWorkflowStatus()}
              className="min-h-[48px] shrink-0 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[44px]"
            >
              {statusSaving ? 'Saving…' : 'Save workflow status'}
            </button>
          </div>
          {statusMessage.text ? (
            <p
              className={`mt-3 text-sm ${
                statusMessage.type === 'success' ? 'text-emerald-800' : 'text-red-800'
              }`}
            >
              {statusMessage.text}
            </p>
          ) : null}
          <dl className="mt-6 grid gap-4 border-t border-slate-100 pt-6 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <DlItem label="Operational status" value={(overrides.operationalStatus || '').trim() || '—'} />
            <DlItem label="Payment status" value={q.payment_status ?? '—'} />
            <DlItem
              label="Original quote total"
              value={fin?.baseQuoteTotal != null ? money(fin.baseQuoteTotal) : '—'}
            />
            <DlItem label="Adjustments (sum)" value={money(adjSum)} />
            <DlItem label="Customer total" value={fin?.customerTotal != null ? money(fin.customerTotal) : '—'} />
            <DlItem label="Paid amount" value={money(fin?.paid)} />
            <DlItem label="Remaining balance" value={fin?.remaining != null ? money(fin.remaining) : '—'} />
          </dl>
        </AdminCard>
      ) : null}

      {tab === 'assignment' ? (
        <AdminCard title="Assignment & marketplace">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
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
            <DlItem label="Assigned driver" value={(overrides.assignedDriver || '').trim() || '—'} />
            <DlItem label="Assigned partner" value={(overrides.assignedPartnerCompany || '').trim() || '—'} />
          </dl>
          <p className="mt-4 text-xs text-slate-500">
            Partner listing visibility (visible / hidden for the Partner Dashboard) and payouts are managed from the{' '}
            <Link to="/admin/marketplace" className="font-semibold text-brand-700 hover:underline">
              Marketplace
            </Link>{' '}
            admin page. Use the header here to assign crew or send this job to the marketplace.
          </p>
        </AdminCard>
      ) : null}

      {tab === 'details' ? (
        <AdminJobQuoteDetailsPanel
          quote={q}
          jobId={linkedJob?.id != null ? String(linkedJob.id) : null}
          photoQuoteRef={photoQuoteRef}
          legacyPhotoFileNames={legacyPhotoFileNames}
        />
      ) : null}

      {tab === 'pricing' ? (
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

          {(overrides.adjustments || []).length > 0 ? (
            <div className="mt-8 border-t border-slate-100 pt-6">
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Adjustment history</h4>
              <ul className="mt-3 space-y-2">
                {(overrides.adjustments || []).map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{a.description}</p>
                      <p className="text-xs text-slate-500">{formatDateTimeUK(a.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold tabular-nums text-slate-900">£{Number(a.amountGbp).toFixed(2)}</span>
                      {a.status === 'pending' ? (
                        <button
                          type="button"
                          disabled
                          title="Automatic payment link requests will be added when invoicing is connected."
                          className="cursor-not-allowed rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-500 opacity-65"
                        >
                          Request top-up
                        </button>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-700">Paid</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </AdminCard>
      ) : null}

      {tab === 'notes' ? (
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

          <AdminCard title="Adjustment history">
            {(overrides.adjustments || []).length === 0 ? (
              <p className="text-sm text-slate-600">No adjustments recorded.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {(overrides.adjustments || []).map((a) => (
                  <li key={a.id} className="flex justify-between gap-4 rounded-lg border border-slate-100 px-3 py-2">
                    <span className="text-slate-800">{a.description}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{money(a.amountGbp)}</span>
                  </li>
                ))}
              </ul>
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

        <AdminJobDetailsSidebar
          quote={q}
          overrides={overrides}
          terminal={terminal}
          onOpenReassignDriver={() => overrideActionsRef.current?.openReassignDriver?.()}
          onOpenReassignPartner={() => overrideActionsRef.current?.openReassignPartner?.()}
          onMarkComplete={() => overrideActionsRef.current?.openMarkComplete?.()}
          onCancelJob={() => overrideActionsRef.current?.openMarkCancelled?.()}
        />
      </div>

      <AdminJobOverrideActions
        ref={overrideActionsRef}
        quote={q}
        jobs={jobsList}
        onApplied={() => void load()}
        showTriggerButtons={false}
      />

      {adjustOpen ? (
        <div
          className="fixed inset-0 z-[55] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
          onClick={() => setAdjustOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="adjust-title"
          >
            <h3 id="adjust-title" className="text-lg font-semibold text-slate-900">
              Add adjustment
            </h3>
            <p className="mt-1 text-sm text-slate-600">Updates the customer total for this job.</p>
            <label className="mt-4 block text-sm">
              <span className="text-xs font-semibold uppercase text-slate-500">Description</span>
              <input
                value={adjustDesc}
                onChange={(e) => setAdjustDesc(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="e.g. Extra flight of stairs"
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="text-xs font-semibold uppercase text-slate-500">Amount (£)</span>
              <input
                type="number"
                step="0.01"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="25.00"
              />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAdjustOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={addAdjustment}
                className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Save adjustment
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
