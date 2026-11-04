import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import DriverFleetCard from './admin/DriverFleetCard'
import LeadCallButton from './admin/LeadCallButton'
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
import {
  countAssignedJobsForDriver,
  countCancelledJobsForDriver,
  countCompletedJobsForDriver,
  sumDriverEarnings,
} from '../lib/adminDriverStats'
import {
  driverAccountBadge,
  driverDutyBadge,
  driverVerificationBadges,
  formatDriverDateOfBirth,
} from '../lib/driverDisplayHelpers'
import { fetchLatestDriverLivePositionsMap } from '../lib/data/driverLivePositionsRepository'
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
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'on_duty', label: 'On Duty' },
  { id: 'offline', label: 'Offline' },
  { id: 'suspended', label: 'Suspended' },
  { id: 'archived', label: 'Archived' },
]

function statusTone(st) {
  if (st === 'Active') return 'emerald'
  if (st === 'On Duty') return 'sky'
  if (st === 'Suspended') return 'rose'
  if (st === 'Archived') return 'violet'
  return 'slate'
}

function DriverAvatar({ name, photoUrl, className = 'h-16 w-16 rounded-2xl text-lg' }) {
  const [failed, setFailed] = useState(false)
  const photo = String(photoUrl || '').trim()
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const initials =
    parts.length >= 2
      ? `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
      : (parts[0]?.[0] || '?').toUpperCase()
  if (photo && !failed) {
    return (
      <img
        src={photo}
        alt=""
        className={`${className} object-cover ring-2 ring-white shadow-sm`}
        onError={() => setFailed(true)}
      />
    )
  }
  return (
    <div className={`flex shrink-0 items-center justify-center bg-brand-gradient font-bold text-white shadow-sm ${className}`} aria-hidden>
      {initials}
    </div>
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
  const [statusFilter, setStatusFilter] = useState('all')
  const [liveByDriver, setLiveByDriver] = useState(/** @type {Record<string, Record<string, unknown>>} */ ({}))
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
      const [q, j, live] = await Promise.all([
        fetchQuotesForAdmin('all', ''),
        fetchAllJobs(),
        fetchLatestDriverLivePositionsMap(),
      ])
      setQuotes(q)
      setJobs(j)
      setLiveByDriver(live.map || {})
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
      const duty = driverDutyBadge(d, liveByDriver[String(d.id || '')])
      if (statusFilter === 'on_duty' && duty !== 'On Duty') return false
      if (statusFilter === 'offline' && duty !== 'Offline') return false
      if (statusFilter !== 'on_duty' && statusFilter !== 'offline' && !driverMatchesStatusFilter(d, statusFilter)) {
        return false
      }
      if (!s) return true
      const blob = [d.name, d.email, d.phone, d.address]
        .map((x) => String(x || '').toLowerCase())
        .join(' ')
      return blob.includes(s)
    })
  }, [drivers, liveByDriver, search, statusFilter])

  const statusFilterCounts = useMemo(() => {
    let active = 0
    let onDuty = 0
    let offline = 0
    let suspended = 0
    let archived = 0
    for (const d of drivers) {
      const phase = getDriverLifecyclePhase(d)
      const duty = driverDutyBadge(d, liveByDriver[String(d.id || '')])
      if (phase === 'active') active += 1
      else if (phase === 'suspended') suspended += 1
      else if (phase === 'archived') archived += 1
      if (duty === 'On Duty') onDuty += 1
      if (duty === 'Offline') offline += 1
    }
    return { active, onDuty, offline, suspended, archived, all: drivers.length }
  }, [drivers, liveByDriver])

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
      `Suspend ${d.name}?\n\nThey will be hidden from Assign Driver and cannot sign in on the mobile app until you activate them again.`,
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
    const ok = window.confirm(
      `Activate ${d.name}?\n\nStatus returns to Active. They can sign in on the Driver app and receive new assignments.`,
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
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Fleet</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Drivers</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
            Driver accounts, assignments, and payments stay on the same records. Add Driver creates the mobile login.
            Profile only saves a fleet record without a password.
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

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ['Fleet', statusFilterCounts.all],
          ['Active', statusFilterCounts.active],
          ['On Duty', statusFilterCounts.onDuty],
          ['Offline', statusFilterCounts.offline],
          ['Suspended', statusFilterCounts.suspended],
          ['Archived', statusFilterCounts.archived],
        ].map(([label, count]) => (
          <div key={label} className="rounded-2xl border border-slate-200/80 bg-white px-3 py-3 shadow-card">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-slate-950">{count}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-card sm:p-4">
        <label className="relative block">
          <span className="sr-only">Search drivers</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone, or address"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-4 pr-4 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Driver status filter">
          {STATUS_FILTERS.map((f) => {
            const count =
              f.id === 'active'
                ? statusFilterCounts.active
                : f.id === 'on_duty'
                  ? statusFilterCounts.onDuty
                  : f.id === 'offline'
                    ? statusFilterCounts.offline
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
                className={`min-h-10 rounded-full px-3.5 py-2 text-sm font-semibold transition ${
                  statusFilter === f.id
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {f.label}
                <span className={statusFilter === f.id ? 'ml-1.5 text-white/80' : 'ml-1.5 text-slate-400'}>{count}</span>
              </button>
            )
          })}
        </div>
          <button
            type="button"
            onClick={() => void loadQuotesJobs()}
            className="min-h-10 shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
        {statusFilter === 'active' && statusFilterCounts.suspended > 0 ? (
          <p className="mt-3 text-sm text-amber-900">
            {statusFilterCounts.suspended} suspended driver{statusFilterCounts.suspended === 1 ? '' : 's'} — open{' '}
            <button
              type="button"
              className="font-semibold text-brand-700 underline hover:text-brand-800"
              onClick={() => setStatusFilter('suspended')}
            >
              Suspended
            </button>{' '}
            to activate them.
          </p>
        ) : null}
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
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((d) => (
            <DriverFleetCard
              key={d.id}
              driver={d}
              assigned={countAssignedJobsForDriver(d, quotes, jobs)}
              completed={countCompletedJobsForDriver(d, quotes, jobs)}
              cancelled={countCancelledJobsForDriver(d, quotes, jobs)}
              earnings={sumDriverEarnings(d, quotes)}
              accountStatus={driverAccountBadge(d)}
              dutyStatus={driverDutyBadge(d, liveByDriver[String(d.id || '')])}
              badges={driverVerificationBadges(docTypesMap.get(d.id))}
              saving={saving}
              onView={() => openView(d)}
              onEdit={() => openEdit(d)}
              onDisable={() => requestDisableDriver(d)}
              onArchive={() => requestArchiveDriver(d)}
              onReactivate={() => requestReactivateDriver(d)}
              onDelete={() => setDeleteTarget(d)}
            />
          ))}
        </ul>
      )}

      {modal === 'view' && draft ? (
        <ModalShell
          wide
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
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-slate-200 bg-gradient-to-br from-brand-50/80 to-white p-4">
            <DriverAvatar name={draft.name} photoUrl={draft.profilePhotoUrl} />
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-slate-950">{draft.name}</p>
              <p className="truncate text-sm text-slate-500">{draft.email || 'No email'}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <JobStatusBadge label={driverAccountBadge(draft)} tone={statusTone(driverAccountBadge(draft))} />
                {driverDutyBadge(draft, liveByDriver[String(draft.id || '')]) ? (
                  <JobStatusBadge
                    label={driverDutyBadge(draft, liveByDriver[String(draft.id || '')])}
                    tone={statusTone(driverDutyBadge(draft, liveByDriver[String(draft.id || '')]))}
                  />
                ) : null}
              </div>
            </div>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              ['Assigned', countAssignedJobsForDriver(draft, quotes, jobs)],
              ['Completed', countCompletedJobsForDriver(draft, quotes, jobs)],
              ['Cancelled', countCancelledJobsForDriver(draft, quotes, jobs)],
              ['Rating', draft.rating || '—'],
              ['Earnings', (() => {
                const earnings = sumDriverEarnings(draft, quotes)
                return earnings == null ? '—' : `£${Number(earnings).toFixed(2)}`
              })()],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-slate-50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-950">{value}</p>
              </div>
            ))}
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <Link
              to={`/admin/driver-messages?driver=${encodeURIComponent(String(draft.id || ''))}`}
              className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              Message
            </Link>
            <Link
              to={`/admin/driver-payments?driver=${encodeURIComponent(String(draft.id || ''))}`}
              className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              Payments
            </Link>
          </div>
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
              <dd>
                <LeadCallButton phone={draft.phone || ''} />
              </dd>
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
        busy={saving}
        error={deleteError}
        onClose={() => {
          if (!saving) {
            setDeleteTarget(null)
            setDeleteError('')
          }
        }}
        onConfirmDelete={() => confirmDeleteDriver({ forceCleanup: true })}
        onArchive={() => (deleteTarget ? archiveDriverRecord(deleteTarget) : undefined)}
      />
    </div>
  )
}
