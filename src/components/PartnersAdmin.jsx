import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchQuotesForAdmin } from '../lib/data/quotesAdminRepository'
import { fetchAllJobs } from '../lib/data/jobsRepository'
import { loadAdminDrivers, loadAdminPartners, saveAdminPartners } from '../lib/adminFleetLocalStore'
import {
  countDriversForPartner,
  countPartnerActiveJobs,
  countPartnerAssignedJobs,
  countPartnerCompletedJobs,
} from '../lib/adminPartnerStats'
import JobStatusBadge from './admin-workflow/JobStatusBadge'

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `p-${Date.now()}`
}

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

export default function PartnersAdmin() {
  const [partners, setPartners] = useState([])
  const [drivers, setDrivers] = useState([])
  const [quotes, setQuotes] = useState([])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [draft, setDraft] = useState(null)

  const reload = useCallback(() => {
    setPartners(loadAdminPartners())
    setDrivers(loadAdminDrivers())
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
    reload()
  }, [reload])

  useEffect(() => {
    loadQuotesJobs()
  }, [loadQuotesJobs])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s) return partners
    return partners.filter((p) => {
      const blob = [p.companyName, p.contactPerson, p.email, p.phone, p.vehicles]
        .map((x) => String(x || '').toLowerCase())
        .join(' ')
      return blob.includes(s)
    })
  }, [partners, search])

  function persist(next) {
    saveAdminPartners(next)
    setPartners(next)
  }

  function openCreate() {
    setDraft({
      id: newId(),
      companyName: '',
      contactPerson: '',
      email: '',
      phone: '',
      vehicles: '',
      notes: '',
      status: 'Active',
      payoutNotes: '',
    })
    setModal('edit')
  }

  function openEdit(p) {
    setDraft({ ...p, payoutNotes: p.payoutNotes ?? '' })
    setModal('edit')
  }

  function openView(p) {
    setDraft({ ...p, payoutNotes: p.payoutNotes ?? '' })
    setModal('view')
  }

  function saveDraft() {
    if (!draft?.companyName?.trim()) return
    const rest = partners.filter((x) => x.id !== draft.id)
    persist([
      ...rest,
      {
        ...draft,
        companyName: draft.companyName.trim(),
        payoutNotes: (draft.payoutNotes || '').trim(),
      },
    ])
    setModal(null)
    setDraft(null)
  }

  function disablePartner(p) {
    const next = partners.map((x) => (x.id === p.id ? { ...x, status: 'Suspended' } : x))
    persist(next)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Partners / companies</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Partner registry is stored in this browser until a partners table exists. Job counts use{' '}
            <code className="rounded bg-slate-100 px-1">assignedPartnerCompany</code> on each Available Job (saved in
            this browser) — use the exact company name shown here, or assign from the job detail screen.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="min-h-[48px] rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          Add partner
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 sm:max-w-md">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Company, contact, email, phone, vehicles"
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
          <p className="font-medium text-slate-800">No transport partners in the registry yet.</p>
          <p className="mt-2">
            Add a partner here, then link jobs from Available Job detail using &quot;Assign transport partner&quot; so
            active and completed counts populate.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const name = p.companyName
            const assigned = countPartnerAssignedJobs(name, quotes)
            const active = countPartnerActiveJobs(name, quotes, jobs)
            const completed = countPartnerCompletedJobs(name, quotes, jobs)
            const driverN = countDriversForPartner(p.id, drivers)
            const payout = (p.payoutNotes || '').trim() || 'No payout notes yet (paste history or connect payouts API).'
            return (
              <li
                key={p.id}
                className="flex flex-col rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.04]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold text-slate-900">{p.companyName}</p>
                    <p className="truncate text-sm text-slate-600">{p.contactPerson || '—'}</p>
                    <p className="truncate text-sm text-slate-600">{p.email || '—'}</p>
                    <p className="truncate text-sm text-slate-600">{p.phone || '—'}</p>
                  </div>
                  <JobStatusBadge label={p.status} tone={statusTone(p.status)} />
                </div>
                <dl className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-600">
                  <div>
                    <dt>Vehicles (summary)</dt>
                    <dd className="mt-1 line-clamp-2 font-medium text-slate-800">{p.vehicles || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Drivers under partner</dt>
                    <dd className="font-semibold text-slate-900">{driverN}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Partner-assigned jobs</dt>
                    <dd className="font-semibold text-slate-900">{assigned}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Active jobs</dt>
                    <dd className="font-semibold text-slate-900">{active}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Completed jobs</dt>
                    <dd className="font-semibold text-slate-900">{completed}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Payout / finance notes</dt>
                    <dd className="mt-1 line-clamp-3 text-slate-800">{payout}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openView(p)}
                    className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                  >
                    View Partner
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                  >
                    Edit Partner
                  </button>
                  <button
                    type="button"
                    disabled={p.status === 'Suspended'}
                    onClick={() => disablePartner(p)}
                    className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-900 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Disable Partner
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {modal === 'view' && draft ? (
        <ModalShell
          title="Partner profile"
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
              <dt className="text-xs font-semibold uppercase text-slate-500">Company</dt>
              <dd className="font-medium text-slate-900">{draft.companyName}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Contact person</dt>
              <dd>{draft.contactPerson || '—'}</dd>
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
              <dt className="text-xs font-semibold uppercase text-slate-500">Vehicles</dt>
              <dd className="whitespace-pre-wrap text-slate-800">{draft.vehicles || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Status</dt>
              <dd>
                <JobStatusBadge label={draft.status} tone={statusTone(draft.status)} />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Drivers (linked by driver profile)</dt>
              <dd className="font-semibold tabular-nums text-slate-900">{countDriversForPartner(draft.id, drivers)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Partner-assigned jobs</dt>
              <dd className="font-semibold tabular-nums text-slate-900">
                {countPartnerAssignedJobs(draft.companyName, quotes)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Active jobs</dt>
              <dd className="font-semibold tabular-nums text-slate-900">
                {countPartnerActiveJobs(draft.companyName, quotes, jobs)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Completed jobs</dt>
              <dd className="font-semibold tabular-nums text-slate-900">
                {countPartnerCompletedJobs(draft.companyName, quotes, jobs)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Payout / finance notes</dt>
              <dd className="whitespace-pre-wrap text-slate-800">
                {(draft.payoutNotes || '').trim() || 'No payout notes yet.'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Internal notes</dt>
              <dd className="whitespace-pre-wrap text-slate-800">{(draft.notes || '').trim() || '—'}</dd>
            </div>
          </dl>
        </ModalShell>
      ) : null}

      {modal === 'edit' && draft ? (
        <ModalShell
          title={partners.some((x) => x.id === draft.id) ? 'Edit partner' : 'Add partner'}
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
                onClick={saveDraft}
                className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Save
              </button>
            </>
          }
        >
          <div className="space-y-3 text-sm">
            <label className="block">
              <span className="text-xs font-semibold uppercase text-slate-500">Company name *</span>
              <input
                value={draft.companyName}
                onChange={(e) => setDraft({ ...draft, companyName: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                placeholder="e.g. Northline Removals Ltd"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase text-slate-500">Contact person</span>
              <input
                value={draft.contactPerson}
                onChange={(e) => setDraft({ ...draft, contactPerson: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
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
            <label className="block">
              <span className="text-xs font-semibold uppercase text-slate-500">Vehicles available (summary)</span>
              <textarea
                value={draft.vehicles}
                onChange={(e) => setDraft({ ...draft, vehicles: e.target.value })}
                rows={2}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                placeholder="e.g. 2 × Luton, 1 × LWB van"
              />
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
              <span className="text-xs font-semibold uppercase text-slate-500">Payout / finance notes</span>
              <textarea
                value={draft.payoutNotes}
                onChange={(e) => setDraft({ ...draft, payoutNotes: e.target.value })}
                rows={3}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                placeholder="Paste payout history or notes until a finance integration exists."
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase text-slate-500">Internal notes</span>
              <textarea
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                rows={2}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            {partners.some((x) => x.id === draft.id) ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
                Renaming the company will not update existing job links. Re-save assignments on jobs if the legal name
                changes.
              </p>
            ) : null}
          </div>
        </ModalShell>
      ) : null}
    </div>
  )
}
