import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { driverChargeTypeLabel } from '../../lib/driverChargeConstants'
import { DRIVER_CHARGE_FILTER_TABS, driverChargeMatchesFilter, normalizeDriverChargeStatus } from '../../lib/driverChargeStatus'
import { formatDateTimeUK } from '../../lib/formatDateDisplay'
import DriverChargeStatusBadge from './DriverChargeStatusBadge'
import DriverChargeNotesModal from './DriverChargeNotesModal'
import DriverChargeRemoveModal from './DriverChargeRemoveModal'
import DriverChargeStatusChangeModal from './DriverChargeStatusChangeModal'
import { setDriverChargePaymentStatus } from '../../lib/data/driverChargesRepository'

const btn =
  'rounded border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-45'

function money(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return `£${Number(n).toFixed(2)}`
}

function fmtWhen(iso) {
  if (!iso) return '—'
  try {
    return formatDateTimeUK(iso)
  } catch {
    return '—'
  }
}

/**
 * @param {{
 *   charges: Array<Record<string, unknown>>,
 *   onNotesSaved?: () => void | Promise<void>,
 *   onUpdated?: () => void | Promise<void>,
 *   compact?: boolean,
 *   showFilters?: boolean,
 *   maxItems?: number,
 * }} props
 */
export default function DriverChargesList({
  charges,
  onNotesSaved,
  onUpdated,
  compact = false,
  showFilters = false,
  maxItems,
}) {
  const [filter, setFilter] = useState('all')
  const [editingNotes, setEditingNotes] = useState(/** @type {Record<string, unknown> | null} */ (null))
  const [removing, setRemoving] = useState(/** @type {Record<string, unknown> | null} */ (null))
  const [statusChange, setStatusChange] = useState(
    /** @type {{ charge: Record<string, unknown>, target: 'paid' | 'not_paid' } | null} */ (null),
  )
  const [busyId, setBusyId] = useState('')

  const reload = onUpdated || onNotesSaved

  const list = useMemo(() => {
    const raw = Array.isArray(charges) ? charges : []
    const filtered = showFilters ? raw.filter((c) => driverChargeMatchesFilter(c, filter)) : raw
    const cap = maxItems != null && maxItems > 0 ? maxItems : filtered.length
    return filtered.slice(0, cap)
  }, [charges, filter, showFilters, maxItems])

  const totalCount = Array.isArray(charges) ? charges.length : 0

  async function markPending(charge) {
    const id = String(charge.id)
    setBusyId(id)
    try {
      await setDriverChargePaymentStatus(charge, 'pending')
      await reload?.()
    } finally {
      setBusyId('')
    }
  }

  if (totalCount === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-600">
        No driver charges yet. Add a charge from a job or use Add charge above.
      </p>
    )
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {showFilters ? (
        <div className="flex flex-wrap gap-1.5">
          {DRIVER_CHARGE_FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                filter === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}

      {list.length === 0 ? (
        <p className="text-sm text-slate-600">No charges match this filter.</p>
      ) : (
        <ul className={compact ? 'space-y-1.5' : 'space-y-2'}>
          {list.map((c) => {
            const id = String(c.id)
            const st = normalizeDriverChargeStatus(c.status)
            const isRemoved = st === 'removed'
            const isPaid = st === 'paid'
            const busy = busyId === id

            return (
              <li
                key={id}
                className={`rounded-xl border px-3 py-2.5 text-sm ${
                  isRemoved
                    ? 'border-slate-200 bg-slate-50/90'
                    : 'border-rose-100/90 bg-rose-50/30'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">
                      {driverChargeTypeLabel(c.chargeType)} · {money(c.amount)}
                    </p>
                    {c.reason ? (
                      <p className="mt-0.5 text-xs text-slate-600">{String(c.reason)}</p>
                    ) : null}
                    {c.notes ? (
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        <span className="font-semibold">Notes:</span> {String(c.notes)}
                      </p>
                    ) : null}
                    <dl className="mt-2 grid gap-1 text-[10px] text-slate-600 sm:grid-cols-2">
                      <div>
                        <dt className="font-semibold uppercase text-slate-500">Created</dt>
                        <dd>{fmtWhen(c.createdAt)}</dd>
                      </div>
                      {c.createdBy ? (
                        <div>
                          <dt className="font-semibold uppercase text-slate-500">Created by</dt>
                          <dd className="truncate">{String(c.createdBy)}</dd>
                        </div>
                      ) : null}
                      {isPaid && c.paidAt ? (
                        <div>
                          <dt className="font-semibold uppercase text-emerald-800">Paid</dt>
                          <dd>
                            {fmtWhen(c.paidAt)}
                            {c.paidBy ? ` · ${String(c.paidBy)}` : ''}
                          </dd>
                        </div>
                      ) : null}
                      {isRemoved ? (
                        <>
                          <div className="sm:col-span-2">
                            <dt className="font-semibold uppercase text-slate-500">Removed</dt>
                            <dd>
                              {fmtWhen(c.removedAt)}
                              {c.removedBy ? ` · ${String(c.removedBy)}` : ''}
                            </dd>
                          </div>
                          {c.removedReason ? (
                            <div className="sm:col-span-2">
                              <dt className="font-semibold uppercase text-slate-500">Removal reason</dt>
                              <dd className="text-slate-800">{String(c.removedReason)}</dd>
                            </div>
                          ) : null}
                        </>
                      ) : null}
                      {c.statusChangedAt && !isRemoved ? (
                        <div className="sm:col-span-2">
                          <dt className="font-semibold uppercase text-slate-500">Last status change</dt>
                          <dd>
                            {c.statusPrevious ? `${String(c.statusPrevious)} → ${st}` : st}
                            {' · '}
                            {fmtWhen(c.statusChangedAt)}
                            {c.statusChangedBy ? ` · ${String(c.statusChangedBy)}` : ''}
                            {c.statusChangeNote ? (
                              <span className="block italic text-slate-700">{String(c.statusChangeNote)}</span>
                            ) : null}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                    {c.quoteId ? (
                      <Link
                        to={`/admin/active-jobs/${encodeURIComponent(String(c.quoteId))}`}
                        className="mt-1 inline-block text-[11px] font-semibold text-brand-700 hover:underline"
                      >
                        View job
                      </Link>
                    ) : null}
                    {c.evidenceUrl ? (
                      <a
                        href={String(c.evidenceUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-2 inline-block text-[11px] font-medium text-brand-700 hover:underline"
                      >
                        Evidence
                      </a>
                    ) : null}
                  </div>
                  <DriverChargeStatusBadge status={st} />
                </div>

                {!isRemoved ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {st !== 'paid' ? (
                      <button
                        type="button"
                        disabled={busy}
                        className={`${btn} border-emerald-200 text-emerald-900`}
                        onClick={() => setStatusChange({ charge: c, target: 'paid' })}
                      >
                        Mark as paid
                      </button>
                    ) : null}
                    {st !== 'not_paid' ? (
                      <button
                        type="button"
                        disabled={busy}
                        className={`${btn} border-rose-200 text-rose-900`}
                        onClick={() => setStatusChange({ charge: c, target: 'not_paid' })}
                      >
                        Mark as not paid
                      </button>
                    ) : null}
                    {st !== 'pending' && st !== 'not_paid' ? (
                      <button
                        type="button"
                        disabled={busy}
                        className={btn}
                        onClick={() => void markPending(c)}
                      >
                        Mark pending
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={busy}
                      className={`${btn} border-slate-300 text-slate-600`}
                      onClick={() => setRemoving(c)}
                    >
                      Remove charge
                    </button>
                    {reload ? (
                      <button type="button" className={btn} onClick={() => setEditingNotes(c)}>
                        Edit notes
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      {showFilters && maxItems && totalCount > maxItems ? (
        <p className="text-[11px] text-slate-500">
          Showing {list.length} of {totalCount} charges (filter: {filter}).
        </p>
      ) : null}

      <DriverChargeNotesModal
        open={Boolean(editingNotes)}
        charge={editingNotes}
        onClose={() => setEditingNotes(null)}
        onSaved={reload}
      />
      <DriverChargeRemoveModal
        open={Boolean(removing)}
        charge={removing}
        onClose={() => setRemoving(null)}
        onSaved={reload}
      />
      <DriverChargeStatusChangeModal
        open={Boolean(statusChange)}
        charge={statusChange?.charge ?? null}
        targetStatus={statusChange?.target ?? 'paid'}
        onClose={() => setStatusChange(null)}
        onSaved={reload}
      />
    </div>
  )
}
