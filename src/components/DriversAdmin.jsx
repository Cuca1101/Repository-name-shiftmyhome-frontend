import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchQuotesForAdmin } from '../lib/data/quotesAdminRepository'
import { fetchAllJobs } from '../lib/data/jobsRepository'
import { fetchFleetDrivers, upsertFleetDriver, setFleetDriverUserId } from '../lib/data/driversRepository'
import { loadFleetDriversForAdmin, setFleetDriversCache } from '../lib/adminFleetDrivers'
import { loadAdminPartners } from '../lib/adminFleetLocalStore'
import { countAssignedJobsForDriver, countCompletedJobsForDriver } from '../lib/adminDriverStats'
import { isSupabaseConfigured } from '../lib/supabase'
import JobStatusBadge from './admin-workflow/JobStatusBadge'

function statusTone(st) {
  if (st === 'Active') return 'emerald'
  if (st === 'Suspended') return 'rose'
  return 'slate'
}

function ModalShell({ title, children, onClose, footer }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
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

  const reloadDrivers = useCallback(async () => {
    const list = await loadFleetDriversForAdmin()
    setDrivers(list)
    setPartners(loadAdminPartners())
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

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s) return drivers
    return drivers.filter((d) => {
      const blob = [d.name, d.email, d.phone].map((x) => String(x || '').toLowerCase()).join(' ')
      return blob.includes(s)
    })
  }, [drivers, search])

  function openCreate() {
    setDraft({
      id: '',
      name: '',
      email: '',
      phone: '',
      status: 'Active',
      notes: '',
      rating: '',
      partnerId: '',
      userId: '',
    })
    setErr('')
    setModal('edit')
  }

  function openEdit(d) {
    setDraft({ ...d, partnerId: d.partnerId ?? '', userId: d.userId ?? '' })
    setErr('')
    setModal('edit')
  }

  function openView(d) {
    setDraft({ ...d })
    setModal('view')
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
        const list = await fetchFleetDrivers()
        setFleetDriversCache(list)
        setDrivers(list)
      } else {
        const id = draft.id || `d-${Date.now()}`
        const rec = { ...draft, id, name: draft.name.trim(), partnerId: draft.partnerId || '' }
        const rest = drivers.filter((x) => x.id !== id)
        const next = [...rest, rec]
        setFleetDriversCache(next)
        setDrivers(next)
      }
      setModal(null)
      setDraft(null)
    } catch (e) {
      setErr(e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function disableDriver(d) {
    setSaving(true)
    try {
      const nextRec = { ...d, status: 'Suspended' }
      if (isSupabaseConfigured) {
        await upsertFleetDriver(nextRec)
        await reloadDrivers()
      } else {
        const next = drivers.map((x) => (x.id === d.id ? nextRec : x))
        setFleetDriversCache(next)
        setDrivers(next)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Drivers</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Fleet drivers are stored in Supabase <code className="rounded bg-slate-100 px-1">drivers</code>. Job
            assignment uses <code className="rounded bg-slate-100 px-1">drivers.id</code> and syncs to{' '}
            <code className="rounded bg-slate-100 px-1">job_assignments</code> for the mobile app.
            {!isSupabaseConfigured ? ' Connect Supabase to persist fleet records.' : null}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="min-h-[48px] rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          Add driver
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 sm:max-w-md">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, email, or phone"
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

      {loading ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
          Loading quote data for stats…
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center text-sm text-slate-600">
          <p className="font-medium text-slate-800">No drivers in the fleet registry yet.</p>
          <p className="mt-2">
            Add a driver, link their Supabase Auth user id when the mobile account exists, then assign jobs using the
            same name.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((d) => {
            const assigned = countAssignedJobsForDriver(d, quotes, jobs)
            const completed = countCompletedJobsForDriver(d, quotes, jobs)
            const rating = (d.rating || '').trim() || '—'
            const notes = (d.notes || '').trim() || 'No notes yet'
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
                    {d.userId ? (
                      <p className="mt-1 text-[10px] text-emerald-700">Mobile login linked</p>
                    ) : (
                      <p className="mt-1 text-[10px] text-amber-700">No mobile login linked</p>
                    )}
                  </div>
                  <JobStatusBadge label={d.status} tone={statusTone(d.status)} />
                </div>
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
                <div className="mt-4 flex flex-wrap gap-2">
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
                  <button
                    type="button"
                    disabled={d.status === 'Suspended' || saving}
                    onClick={() => void disableDriver(d)}
                    className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-900 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Disable Driver
                  </button>
                </div>
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
              <button
                type="button"
                onClick={() => setModal('edit')}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Edit
              </button>
            </>
          }
        >
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Name</dt>
              <dd className="font-medium text-slate-900">{draft.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Email</dt>
              <dd>{draft.email || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Phone</dt>
              <dd>{draft.phone || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Auth user id</dt>
              <dd className="break-all font-mono text-xs">{draft.userId || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Status</dt>
              <dd>
                <JobStatusBadge label={draft.status} tone={statusTone(draft.status)} />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Assigned jobs</dt>
              <dd className="font-semibold tabular-nums text-slate-900">
                {countAssignedJobsForDriver(draft, quotes, jobs)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Completed jobs</dt>
              <dd className="font-semibold tabular-nums text-slate-900">
                {countCompletedJobsForDriver(draft, quotes, jobs)}
              </dd>
            </div>
          </dl>
        </ModalShell>
      ) : null}

      {modal === 'edit' && draft ? (
        <ModalShell
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
          <div className="space-y-3 text-sm">
            {err ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p> : null}
            <label className="block">
              <span className="text-xs font-semibold uppercase text-slate-500">Name *</span>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                placeholder="e.g. Alex Taylor"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase text-slate-500">Email</span>
              <input
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase text-slate-500">Phone</span>
              <input
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            {isSupabaseConfigured ? (
              <label className="block">
                <span className="text-xs font-semibold uppercase text-slate-500">Supabase Auth user id</span>
                <input
                  value={draft.userId || ''}
                  onChange={(e) => setDraft({ ...draft, userId: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs"
                  placeholder="auth.users UUID — links mobile login"
                />
              </label>
            ) : null}
            <label className="block">
              <span className="text-xs font-semibold uppercase text-slate-500">Transport partner (optional)</span>
              <select
                value={draft.partnerId || ''}
                onChange={(e) => setDraft({ ...draft, partnerId: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
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
              <span className="text-xs font-semibold uppercase text-slate-500">Status</span>
              <select
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Suspended">Suspended</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase text-slate-500">Rating / feedback (optional)</span>
              <input
                value={draft.rating}
                onChange={(e) => setDraft({ ...draft, rating: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase text-slate-500">Internal notes</span>
              <textarea
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                rows={3}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
          </div>
        </ModalShell>
      ) : null}
    </div>
  )
}
