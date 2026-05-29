import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import DriverChargeQuickActions from './admin-driver-charges/DriverChargeQuickActions'
import { fetchQuotesForAdmin } from '../lib/data/quotesAdminRepository'
import { fetchAllJobs } from '../lib/data/jobsRepository'
import { fetchFleetDrivers, upsertFleetDriver, setFleetDriverUserId } from '../lib/data/driversRepository'
import {
  fetchDriverDocuments,
  fetchDriverDocumentTypesByDriver,
  uploadPendingDriverDocuments,
} from '../lib/data/driverDocumentsRepository'
import { DRIVER_DOCUMENT_SLOTS } from '../lib/data/driverDocumentConstants'
import { loadFleetDriversForAdmin, setFleetDriversCache } from '../lib/adminFleetDrivers'
import { loadAdminPartners } from '../lib/adminFleetLocalStore'
import { countAssignedJobsForDriver, countCompletedJobsForDriver } from '../lib/adminDriverStats'
import {
  driverVerificationBadges,
  formatDriverDateOfBirth,
  shortenAddress,
} from '../lib/driverDisplayHelpers'
import { isSupabaseConfigured } from '../lib/supabase'
import JobStatusBadge from './admin-workflow/JobStatusBadge'
import DriverDocumentUpload from './admin/DriverDocumentUpload'
import DriverCreateAccountModal from './admin/DriverCreateAccountModal'
import DriverDeleteConfirmModal from './admin/DriverDeleteConfirmModal'
import {
  archiveFleetDriver,
  disableFleetDriver,
  driverMatchesStatusFilter,
  driverReactivateButtonLabel,
  getDriverDisplayStatus,
  getDriverLifecyclePhase,
  reactivateFleetDriver,
} from '../lib/driverAdminLifecycle'
import { deleteDriverAccountAdmin } from '../lib/deleteDriverAccountAdmin'
import DriverLifecycleActions from './admin/DriverLifecycleActions'

const fieldInput =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25'
const fieldLabel = 'text-xs font-semibold uppercase tracking-wide text-slate-500'

const STATUS_FILTERS = [
  { id: 'active', label: 'Active' },
  { id: 'suspended', label: 'Suspended' },
  { id: 'archived', label: 'Archived' },
  { id: 'all', label: 'All' },
]

function statusTone(st) {
  if (st === 'Active') return 'emerald'
  if (st === 'Suspended') return 'rose'
  if (st === 'Archived') return 'violet'
  return 'slate'
}

function VerificationBadge({ label, tone }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
    sky: 'bg-sky-50 text-sky-800 ring-sky-200/80',
    violet: 'bg-violet-50 text-violet-800 ring-violet-200/80',
  }
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${tones[tone] || tones.emerald}`}
    >
      {label}
    </span>
  )
}

function FormSection({ title, description, children }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      {description ? <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p> : null}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  )
}

function ModalShell({ title, children, onClose, footer, wide }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl ${
          wide ? 'max-w-2xl' : 'max-w-lg'
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <div className="mt-4">{children}</div>
        {footer ? <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">{footer}</div> : null}
      </div>
    </div>
  )
}

/** @returns {Record<string, File | null>} */
function emptyPendingDocs() {
  return Object.fromEntries(DRIVER_DOCUMENT_SLOTS.map((s) => [s.id, null]))
}

function emptyDriverDraft() {
  return {
    id: '',
    name: '',
    email: '',
    phone: '',
    vehicleType: '',
    status: 'Active',
    accountActive: true,
    hasLogin: false,
    notes: '',
    rating: '',
    partnerId: '',
    userId: '',
    address: '',
    dateOfBirth: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  }
}

export default function DriversAdmin() {
  const [partners, setPartners] = useState([])
  const [drivers, setDrivers] = useState([])
  const [quotes, setQuotes] = useState([])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [draft, setDraft] = useState(null)
  const [err, setErr] = useState('')
  const [docTypesMap, setDocTypesMap] = useState(() => new Map())
  const [driverDocs, setDriverDocs] = useState([])
  const [pendingDocs, setPendingDocs] = useState(emptyPendingDocs)
  const [createAccountOpen, setCreateAccountOpen] = useState(false)
  const [createSuccessBanner, setCreateSuccessBanner] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [deleteTarget, setDeleteTarget] = useState(/** @type {typeof drivers[0] | null} */ (null))
  const [deleteError, setDeleteError] = useState('')

  const reloadDrivers = useCallback(async () => {
    const list = await loadFleetDriversForAdmin()
    setDrivers(list)
    setPartners(loadAdminPartners())
    if (isSupabaseConfigured) {
      setDocTypesMap(await fetchDriverDocumentTypesByDriver())
    }
  }, [])

  const loadQuotesJobs = useCallback(async () => {
    setLoading(true)
    try {
      const [q, j] = await Promise.all([fetchQuotesForAdmin('all', ''), fetchAllJobs()])
      setQuotes(q)
      setJobs(j)
    } catch {
      setQuotes([])
      setJobs([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reloadDrivers()
  }, [reloadDrivers])

  useEffect(() => {
    loadQuotesJobs()
  }, [loadQuotesJobs])

  useEffect(() => {
    if (!draft?.id || !isSupabaseConfigured || (modal !== 'edit' && modal !== 'view')) {
      setDriverDocs([])
      return
    }
    let cancelled = false
    void fetchDriverDocuments(draft.id).then((rows) => {
      if (!cancelled) setDriverDocs(rows)
    })
    return () => {
      cancelled = true
    }
  }, [modal, draft?.id])

  const refreshDriverDocsForId = useCallback(async (driverId) => {
    if (!driverId || !isSupabaseConfigured) return
    const [docs, map] = await Promise.all([
      fetchDriverDocuments(driverId),
      fetchDriverDocumentTypesByDriver(),
    ])
    setDriverDocs(docs)
    setDocTypesMap(map)
  }, [])

  const refreshDriverDocs = useCallback(async () => {
    if (draft?.id) await refreshDriverDocsForId(draft.id)
  }, [draft?.id, refreshDriverDocsForId])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return drivers.filter((d) => {
      if (!driverMatchesStatusFilter(d, statusFilter)) return false
      if (!s) return true
      const blob = [d.name, d.email, d.phone, d.address]
        .map((x) => String(x || '').toLowerCase())
        .join(' ')
      return blob.includes(s)
    })
  }, [drivers, search, statusFilter])

  const statusFilterCounts = useMemo(() => {
    let active = 0
    let suspended = 0
    let archived = 0
    for (const d of drivers) {
      const phase = getDriverLifecyclePhase(d)
      if (phase === 'active') active += 1
      else if (phase === 'suspended') suspended += 1
      else if (phase === 'archived') archived += 1
    }
    return { active, suspended, archived, all: drivers.length }
  }, [drivers])

  function openCreate() {
    setDraft(emptyDriverDraft())
    setPendingDocs(emptyPendingDocs())
    setDriverDocs([])
    setErr('')
    setModal('edit')
  }

  function openEdit(d) {
    setDraft({
      ...emptyDriverDraft(),
      ...d,
      vehicleType: d.vehicleType ?? '',
      accountActive: d.accountActive !== false,
      hasLogin: Boolean(d.hasLogin || d.userId),
      partnerId: d.partnerId ?? '',
      userId: d.userId ?? '',
      address: d.address ?? '',
      dateOfBirth: d.dateOfBirth ?? '',
      emergencyContactName: d.emergencyContactName ?? '',
      emergencyContactPhone: d.emergencyContactPhone ?? '',
    })
    setPendingDocs(emptyPendingDocs())
    setErr('')
    setModal('edit')
  }

  function openView(d) {
    setDraft({ ...d })
    setModal('view')
  }

  function setPendingDoc(type, file) {
    setPendingDocs((prev) => ({ ...prev, [type]: file }))
  }

  async function saveDraft() {
    if (!draft?.name?.trim()) return
    setSaving(true)
    setErr('')
    try {
      if (isSupabaseConfigured) {
        const saved = await upsertFleetDriver({
          ...draft,
          name: draft.name.trim(),
          partnerId: draft.partnerId || '',
        })
        if (!saved) throw new Error('Could not save driver')
        const uid = String(draft.userId || '').trim()
        if (uid && saved.id) {
          await setFleetDriverUserId(saved.id, uid)
        }

        const hasPending = DRIVER_DOCUMENT_SLOTS.some((s) => pendingDocs[s.id] instanceof File)
        if (hasPending && saved.id) {
          const { errors } = await uploadPendingDriverDocuments(saved.id, pendingDocs)
          if (errors.length) {
            setDraft({
              ...draft,
              ...saved,
              id: saved.id,
              partnerId: saved.partnerId ?? '',
              userId: draft.userId || saved.userId || '',
            })
            setPendingDocs(emptyPendingDocs())
            await refreshDriverDocsForId(saved.id)
            const list = await fetchFleetDrivers()
            setFleetDriversCache(list)
            setDrivers(list)
            setDocTypesMap(await fetchDriverDocumentTypesByDriver())
            setErr(`Driver saved, but some documents failed: ${errors.join('; ')}`)
            return
          }
        }

        const list = await fetchFleetDrivers()
        setFleetDriversCache(list)
        setDrivers(list)
        setDocTypesMap(await fetchDriverDocumentTypesByDriver())
        setPendingDocs(emptyPendingDocs())
        setModal(null)
        setDraft(null)
        setDriverDocs([])
      } else {
        const id = draft.id || `d-${Date.now()}`
        const rec = {
          ...draft,
          id,
          name: draft.name.trim(),
          partnerId: draft.partnerId || '',
        }
        const rest = drivers.filter((x) => x.id !== id)
        const next = [...rest, rec]
        setFleetDriversCache(next)
        setDrivers(next)
        setModal(null)
        setDraft(null)
      }
    } catch (e) {
      setErr(e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function disableDriver(d) {
    setSaving(true)
    setErr('')
    try {
      const result = await disableFleetDriver(d)
      if (isSupabaseConfigured) {
        await reloadDrivers()
      } else if (result.driver) {
        const next = drivers.map((x) => (x.id === d.id ? result.driver : x))
        setFleetDriversCache(next)
        setDrivers(next)
      }
      setCreateSuccessBanner(result.message || 'Driver disabled')
    } catch (e) {
      setErr(e?.message || 'Could not disable driver.')
    } finally {
      setSaving(false)
    }
  }

  function requestDisableDriver(d) {
    const ok = window.confirm(
      `Disable ${d.name}?\n\nThey will be hidden from Assign Driver and cannot sign in on the mobile app until you enable them again.`,
    )
    if (ok) void disableDriver(d)
  }

  async function reactivateDriver(d) {
    setSaving(true)
    setErr('')
    try {
      const result = await reactivateFleetDriver(d)
      if (isSupabaseConfigured) {
        await reloadDrivers()
      } else if (result.driver) {
        const next = drivers.map((x) => (x.id === d.id ? result.driver : x))
        setFleetDriversCache(next)
        setDrivers(next)
      }
      setCreateSuccessBanner(result.message || 'Driver enabled')
    } catch (e) {
      setErr(e?.message || 'Could not reactivate driver.')
    } finally {
      setSaving(false)
    }
  }

  function requestReactivateDriver(d) {
    const phase = getDriverLifecyclePhase(d)
    const verb = phase === 'archived' ? 'Reactivate' : 'Enable'
    const ok = window.confirm(
      `${verb} ${d.name}?\n\nStatus returns to Active. They can sign in on the Driver app and receive new assignments.`,
    )
    if (ok) void reactivateDriver(d)
  }

  async function archiveDriverRecord(d) {
    setSaving(true)
    setErr('')
    try {
      const result = await archiveFleetDriver(d)
      if (isSupabaseConfigured) {
        await reloadDrivers()
      } else if (result.driver) {
        const next = drivers.map((x) => (x.id === d.id ? result.driver : x))
        setFleetDriversCache(next)
        setDrivers(next)
      }
      setDeleteTarget(null)
      setCreateSuccessBanner(result.message || 'Driver archived')
    } catch (e) {
      setErr(e?.message || 'Could not archive driver.')
    } finally {
      setSaving(false)
    }
  }

  function requestArchiveDriver(d) {
    const ok = window.confirm(
      `Archive ${d.name}?\n\nThey will be hidden from active driver pickers. Job and payment history is kept.`,
    )
    if (ok) void archiveDriverRecord(d)
  }

  async function confirmDeleteDriver(opts = {}) {
    if (!deleteTarget?.id) return
    setSaving(true)
    setErr('')
    setDeleteError('')
    try {
      let banner = 'Driver deleted'
      if (isSupabaseConfigured) {
        const del = await deleteDriverAccountAdmin({
          driverId: deleteTarget.id,
          forceCleanup: Boolean(opts.forceCleanup),
        })
        banner = del.message || banner
        await reloadDrivers()
      } else {
        const next = drivers.filter((x) => x.id !== deleteTarget.id)
        setFleetDriversCache(next)
        setDrivers(next)
      }
      setCreateSuccessBanner(banner)
      setDeleteTarget(null)
    } catch (e) {
      const msg = e?.message || 'Could not delete driver.'
      setDeleteError(msg)
      setErr(msg)
    } finally {
      setSaving(false)
    }
  }

  function docForType(type) {
    return driverDocs.find((row) => String(row.document_type) === type) ?? null
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Drivers</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Use <strong className="font-semibold text-slate-800">Add Driver</strong> to create Supabase Auth + a{' '}
            <code className="rounded bg-slate-100 px-1">drivers</code> row linked by{' '}
            <code className="rounded bg-slate-100 px-1">user_id</code>. Drivers sign in on the mobile app with email and
            password. Assign jobs using <code className="rounded bg-slate-100 px-1">drivers.id</code>.
            {!isSupabaseConfigured ? ' Connect Supabase to persist fleet records.' : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isSupabaseConfigured ? (
            <button
              type="button"
              onClick={() => setCreateAccountOpen(true)}
              className="min-h-[48px] rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              Add Driver
            </button>
          ) : null}
          <button
            type="button"
            onClick={openCreate}
            className="min-h-[48px] rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Profile only (no login)
          </button>
        </div>
      </div>

      {createSuccessBanner ? (
        <p
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
          role="status"
        >
          {createSuccessBanner}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Driver status filter">
          {STATUS_FILTERS.map((f) => {
            const count =
              f.id === 'active'
                ? statusFilterCounts.active
                : f.id === 'suspended'
                  ? statusFilterCounts.suspended
                  : f.id === 'archived'
                    ? statusFilterCounts.archived
                    : statusFilterCounts.all
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={statusFilter === f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`min-h-[40px] rounded-xl px-4 py-2 text-sm font-semibold shadow-sm ring-1 transition ${
                  statusFilter === f.id
                    ? 'bg-slate-900 text-white ring-slate-900'
                    : 'bg-white text-slate-800 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                {f.label}
                {count > 0 ? ` (${count})` : ''}
              </button>
            )
          })}
        </div>
        {statusFilter === 'active' && statusFilterCounts.suspended > 0 ? (
          <p className="text-sm text-amber-900">
            {statusFilterCounts.suspended} disabled driver{statusFilterCounts.suspended === 1 ? '' : 's'} — open{' '}
            <button
              type="button"
              className="font-semibold text-brand-700 underline hover:text-brand-800"
              onClick={() => setStatusFilter('suspended')}
            >
              Suspended
            </button>{' '}
            to use <strong>Enable Driver</strong>.
          </p>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 sm:max-w-md">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Search</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, email, phone, or address"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
            />
          </label>
          <button
            type="button"
            onClick={() => void loadQuotesJobs()}
            className="min-h-[48px] rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Refresh job stats
          </button>
        </div>
      </div>

      {err ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {err}
        </p>
      ) : null}

      {loading ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
          Loading quote data for stats…
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center text-sm text-slate-600">
          <p className="font-medium text-slate-800">
            {drivers.length === 0 ? 'No drivers in the fleet registry yet.' : 'No drivers match this filter.'}
          </p>
          <p className="mt-2">
            {drivers.length === 0 ? (
              <>
                Use <strong className="font-semibold">Add Driver</strong> to create login + fleet record, or profile-only
                for dispatch without mobile access.
              </>
            ) : (
              <>Try another status filter or clear the search.</>
            )}
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((d) => {
            const assigned = countAssignedJobsForDriver(d, quotes, jobs)
            const completed = countCompletedJobsForDriver(d, quotes, jobs)
            const rating = (d.rating || '').trim() || '—'
            const notes = (d.notes || '').trim() || 'No notes yet'
            const addrShort = shortenAddress(d.address)
            const dob = formatDriverDateOfBirth(d.dateOfBirth)
            const badges = driverVerificationBadges(docTypesMap.get(d.id))
            const lifecyclePhase = getDriverLifecyclePhase(d)
            return (
              <li
                key={d.id}
                className="flex flex-col rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.04]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold text-slate-900">{d.name}</p>
                    <p className="truncate text-sm text-slate-600">{d.email || '—'}</p>
                    <p className="truncate text-sm text-slate-600">{d.phone || '—'}</p>
                    {d.vehicleRegistration ? (
                      <p className="truncate text-xs text-slate-500">Reg: {d.vehicleRegistration}</p>
                    ) : d.vehicleType ? (
                      <p className="truncate text-xs text-slate-500">{d.vehicleType}</p>
                    ) : null}
                    {addrShort ? (
                      <p className="mt-1 truncate text-xs text-slate-500" title={d.address}>
                        {addrShort}
                      </p>
                    ) : null}
                    {dob ? <p className="mt-0.5 text-xs text-slate-500">DOB: {dob}</p> : null}
                    {d.hasLogin || d.userId ? (
                      <p
                        className={`mt-1 text-[10px] font-semibold uppercase tracking-wide ${
                          lifecyclePhase === 'active' ? 'text-emerald-700' : 'text-slate-600'
                        }`}
                      >
                        Mobile login linked
                        {lifecyclePhase === 'suspended' ? ' · disabled' : ''}
                        {lifecyclePhase === 'archived' ? ' · archived' : ''}
                      </p>
                    ) : (
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                        No mobile login
                      </p>
                    )}
                  </div>
                  <JobStatusBadge
                    label={getDriverDisplayStatus(d)}
                    tone={statusTone(getDriverDisplayStatus(d))}
                  />
                </div>
                {badges.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {badges.map((b) => (
                      <VerificationBadge key={b.key} label={b.label} tone={b.tone} />
                    ))}
                  </div>
                ) : null}
                <dl className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-600">
                  <div className="flex justify-between gap-2">
                    <dt>Assigned jobs</dt>
                    <dd className="font-semibold text-slate-900">{assigned}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Completed jobs</dt>
                    <dd className="font-semibold text-slate-900">{completed}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Rating</dt>
                    <dd className="max-w-[60%] truncate text-right font-medium text-slate-800">{rating}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Notes</dt>
                    <dd className="mt-1 line-clamp-3 text-slate-800">{notes}</dd>
                  </div>
                </dl>
                <div className="mt-3">
                  <DriverChargeQuickActions driverId={String(d.id)} onUpdated={reloadDrivers} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    to="/admin/driver-payments"
                    className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-900 shadow-sm hover:bg-rose-100"
                  >
                    Payments
                  </Link>
                  <button
                    type="button"
                    onClick={() => openView(d)}
                    className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                  >
                    View Driver
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(d)}
                    className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                  >
                    Edit Driver
                  </button>
                </div>
                <DriverLifecycleActions
                  driver={d}
                  saving={saving}
                  onDisable={() => requestDisableDriver(d)}
                  onArchive={() => requestArchiveDriver(d)}
                  onReactivate={() => requestReactivateDriver(d)}
                  onDelete={() => setDeleteTarget(d)}
                  showDelete={Boolean(d.id)}
                />
              </li>
            )
          })}
        </ul>
      )}

      {modal === 'view' && draft ? (
        <ModalShell
          title="Driver profile"
          onClose={() => setModal(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Close
              </button>
              {getDriverLifecyclePhase(draft) !== 'active' ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void requestReactivateDriver(draft)}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                >
                  {saving ? 'Working…' : driverReactivateButtonLabel(draft)}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => openEdit(draft)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Edit
              </button>
            </>
          }
        >
          <dl className="space-y-3 text-sm">
            <div>
              <dt className={fieldLabel}>Name</dt>
              <dd className="font-medium text-slate-900">{draft.name}</dd>
            </div>
            <div>
              <dt className={fieldLabel}>Email</dt>
              <dd>{draft.email || '—'}</dd>
            </div>
            <div>
              <dt className={fieldLabel}>Phone</dt>
              <dd>{draft.phone || '—'}</dd>
            </div>
            <div>
              <dt className={fieldLabel}>Vehicle type</dt>
              <dd>{draft.vehicleType || '—'}</dd>
            </div>
            <div>
              <dt className={fieldLabel}>Mobile app access</dt>
              <dd>
                {!draft.hasLogin && !draft.userId
                  ? 'No login account'
                  : getDriverLifecyclePhase(draft) === 'active'
                    ? 'Active — can sign in on Driver app'
                    : getDriverLifecyclePhase(draft) === 'archived'
                      ? 'Archived — login blocked'
                      : 'Disabled — login blocked until re-enabled'}
              </dd>
            </div>
            <div>
              <dt className={fieldLabel}>Address</dt>
              <dd className="break-words">{draft.address || '—'}</dd>
            </div>
            <div>
              <dt className={fieldLabel}>Date of birth</dt>
              <dd>{formatDriverDateOfBirth(draft.dateOfBirth) || '—'}</dd>
            </div>
            <div>
              <dt className={fieldLabel}>Emergency contact</dt>
              <dd>
                {draft.emergencyContactName || draft.emergencyContactPhone
                  ? `${draft.emergencyContactName || '—'} · ${draft.emergencyContactPhone || '—'}`
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className={fieldLabel}>Auth user id</dt>
              <dd className="break-all font-mono text-xs">{draft.userId || '—'}</dd>
            </div>
            <div>
              <dt className={fieldLabel}>Status</dt>
              <dd>
                <JobStatusBadge label={getDriverDisplayStatus(draft)} tone={statusTone(getDriverDisplayStatus(draft))} />
              </dd>
            </div>
            <div>
              <dt className={fieldLabel}>Assigned jobs</dt>
              <dd className="font-semibold tabular-nums text-slate-900">
                {countAssignedJobsForDriver(draft, quotes, jobs)}
              </dd>
            </div>
            <div>
              <dt className={fieldLabel}>Completed jobs</dt>
              <dd className="font-semibold tabular-nums text-slate-900">
                {countCompletedJobsForDriver(draft, quotes, jobs)}
              </dd>
            </div>
            <div>
              <dt className={fieldLabel}>Rating / feedback</dt>
              <dd>{draft.rating || '—'}</dd>
            </div>
            <div>
              <dt className={fieldLabel}>Internal notes</dt>
              <dd className="whitespace-pre-wrap text-slate-800">{draft.notes || '—'}</dd>
            </div>
          </dl>
          <DriverLifecycleActions
            driver={draft}
            saving={saving}
            onDisable={() => requestDisableDriver(draft)}
            onArchive={() => requestArchiveDriver(draft)}
            onReactivate={() => requestReactivateDriver(draft)}
            onDelete={() => setDeleteTarget(draft)}
            showDelete={
              getDriverLifecyclePhase(draft) === 'active' &&
              countAssignedJobsForDriver(draft, quotes, jobs) === 0 &&
              countCompletedJobsForDriver(draft, quotes, jobs) === 0
            }
          />
          <dl className="mt-4 space-y-3 text-sm">
            {isSupabaseConfigured && driverDocs.length > 0 ? (
              <div>
                <dt className={fieldLabel}>Verification documents</dt>
                <dd className="mt-1 space-y-2">
                  {driverDocs.map((doc) => (
                    <div key={String(doc.id)} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                      <p className="text-xs font-medium text-slate-800">{String(doc.file_name)}</p>
                      {doc.signedUrl ? (
                        <a
                          href={String(doc.signedUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-brand-700 hover:underline"
                        >
                          View (signed link)
                        </a>
                      ) : null}
                    </div>
                  ))}
                </dd>
              </div>
            ) : null}
          </dl>
        </ModalShell>
      ) : null}

      {modal === 'edit' && draft ? (
        <ModalShell
          wide
          title={drivers.some((x) => x.id === draft.id) ? 'Edit driver' : 'Add driver'}
          onClose={() => setModal(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Cancel
              </button>
              {getDriverLifecyclePhase(draft) !== 'active' ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void requestReactivateDriver(draft)}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                >
                  {saving ? 'Working…' : driverReactivateButtonLabel(draft)}
                </button>
              ) : null}
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveDraft()}
                className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          }
        >
          <div className="space-y-4 text-sm">
            {err ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p> : null}

            <FormSection title="Basic details" description="Contact, partner link, and fleet status.">
              <label className="block">
                <span className={fieldLabel}>Name *</span>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className={fieldInput}
                  placeholder="e.g. Alex Taylor"
                />
              </label>
              <label className="block">
                <span className={fieldLabel}>Email</span>
                <input
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                  className={fieldInput}
                />
              </label>
              <label className="block">
                <span className={fieldLabel}>Phone</span>
                <input
                  value={draft.phone}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                  className={fieldInput}
                />
              </label>
              <label className="block">
                <span className={fieldLabel}>Vehicle type</span>
                <input
                  value={draft.vehicleType || ''}
                  onChange={(e) => setDraft({ ...draft, vehicleType: e.target.value })}
                  className={fieldInput}
                  placeholder="e.g. LWB van"
                />
              </label>
              {draft.hasLogin && draft.userId ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                  Mobile login linked (Auth user{' '}
                  <span className="font-mono">{String(draft.userId).slice(0, 8)}…</span>). Use{' '}
                  <strong>Create driver account</strong> for new logins — do not share passwords in notes.
                </p>
              ) : isSupabaseConfigured && !draft.id ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  This form saves a fleet profile only. For mobile app login, close and use{' '}
                  <strong>Create driver account</strong> instead.
                </p>
              ) : null}
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={draft.accountActive !== false}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      accountActive: e.target.checked,
                      status: e.target.checked ? draft.status : 'Inactive',
                    })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-brand-600"
                />
                <span className="text-sm font-medium text-slate-800">Active — allow mobile app access</span>
              </label>
              <label className="block">
                <span className={fieldLabel}>Transport partner (optional)</span>
                <select
                  value={draft.partnerId || ''}
                  onChange={(e) => setDraft({ ...draft, partnerId: e.target.value })}
                  className={fieldInput}
                >
                  <option value="">None</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.companyName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={fieldLabel}>Status</span>
                <select
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                  className={fieldInput}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Suspended">Suspended</option>
                  <option value="Archived">Archived</option>
                </select>
              </label>
              <label className="block">
                <span className={fieldLabel}>Rating / feedback (optional)</span>
                <input
                  value={draft.rating}
                  onChange={(e) => setDraft({ ...draft, rating: e.target.value })}
                  className={fieldInput}
                />
              </label>
            </FormSection>

            <FormSection
              title="Personal information"
              description="Optional — for compliance, emergencies, and verification."
            >
              <label className="block">
                <span className={fieldLabel}>Full address</span>
                <textarea
                  value={draft.address}
                  onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                  rows={2}
                  className={fieldInput}
                  placeholder="Street, town, postcode"
                />
              </label>
              <label className="block">
                <span className={fieldLabel}>Date of birth</span>
                <input
                  type="date"
                  value={draft.dateOfBirth}
                  onChange={(e) => setDraft({ ...draft, dateOfBirth: e.target.value })}
                  className={fieldInput}
                />
              </label>
            </FormSection>

            <FormSection title="Emergency contact" description="Who to call if the driver is unreachable on a job.">
              <label className="block">
                <span className={fieldLabel}>Emergency contact name</span>
                <input
                  value={draft.emergencyContactName}
                  onChange={(e) => setDraft({ ...draft, emergencyContactName: e.target.value })}
                  className={fieldInput}
                />
              </label>
              <label className="block">
                <span className={fieldLabel}>Emergency contact phone</span>
                <input
                  type="tel"
                  value={draft.emergencyContactPhone}
                  onChange={(e) => setDraft({ ...draft, emergencyContactPhone: e.target.value })}
                  className={fieldInput}
                />
              </label>
            </FormSection>

            <FormSection
              title="Verification documents"
              description="Personal ID only — stored privately. Select files here; new drivers upload documents when you press Save."
            >
              {!isSupabaseConfigured ? (
                <p className="text-xs text-amber-800">Connect Supabase to upload verification documents.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {DRIVER_DOCUMENT_SLOTS.map((slot) => (
                    <DriverDocumentUpload
                      key={slot.id}
                      driverId={draft.id || null}
                      documentType={slot.id}
                      label={slot.label}
                      hint={slot.hint}
                      existing={docForType(slot.id)}
                      pendingFile={pendingDocs[slot.id] ?? null}
                      onPendingFileChange={(file) => setPendingDoc(slot.id, file)}
                      onChange={() => void refreshDriverDocs()}
                      externalBusy={saving}
                    />
                  ))}
                </div>
              )}
            </FormSection>

            <FormSection title="Internal notes">
              <label className="block">
                <span className={fieldLabel}>Notes</span>
                <textarea
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  rows={3}
                  className={fieldInput}
                />
              </label>
            </FormSection>
          </div>
        </ModalShell>
      ) : null}

      <DriverCreateAccountModal
        open={createAccountOpen}
        onClose={() => setCreateAccountOpen(false)}
        onCreated={async (result) => {
          await reloadDrivers()
          setCreateSuccessBanner(
            `${result.successMessage}. ${result.driver.name} — driver id ${result.driverId}. You can assign jobs now.`,
          )
        }}
      />

      <DriverDeleteConfirmModal
        open={Boolean(deleteTarget)}
        driver={deleteTarget}
        quotes={quotes}
        jobs={jobs}
        busy={saving}
        error={deleteError}
        onClose={() => {
          if (!saving) {
            setDeleteTarget(null)
            setDeleteError('')
          }
        }}
        onConfirmDelete={() => confirmDeleteDriver()}
        onForceDelete={() => confirmDeleteDriver({ forceCleanup: true })}
        onArchive={() => (deleteTarget ? archiveDriverRecord(deleteTarget) : undefined)}
      />
    </div>
  )
}
