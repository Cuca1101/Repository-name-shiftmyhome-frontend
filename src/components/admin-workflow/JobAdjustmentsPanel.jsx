import { useCallback, useMemo, useState } from 'react'
import { formatDateTimeUK } from '../../lib/formatDateDisplay'
import { fetchAssignedByActor } from '../../lib/data/quotesAdminRepository'
import {
  JOB_ADJUSTMENT_TYPES,
  jobAdjustmentTypeLabel,
  newJobAdjustmentId,
  normalizeJobAdjustments,
  sumJobAdjustmentsGbp,
} from '../../lib/jobAdjustments'

function money(n) {
  if (n == null || n === '') return '—'
  return `£${Number(n).toFixed(2)}`
}

/**
 * @param {{
 *   adjustments: import('../../lib/jobAdjustments.js').JobAdjustmentRow[],
 *   onAdjustmentsChange: (next: import('../../lib/jobAdjustments.js').JobAdjustmentRow[]) => void,
 *   fin: { customerTotal: number|null, paid: number, remaining: number|null, baseQuoteTotal?: number|null } | null,
 *   disabled?: boolean,
 *   onNotify?: (message: string) => void,
 *   embedded?: boolean,
 * }} props
 */
export default function JobAdjustmentsPanel({
  adjustments: adjustmentsProp,
  onAdjustmentsChange,
  fin,
  disabled = false,
  onNotify,
  embedded = false,
}) {
  const adjustments = useMemo(() => normalizeJobAdjustments(adjustmentsProp), [adjustmentsProp])
  const adjSum = useMemo(() => sumJobAdjustmentsGbp(adjustments), [adjustments])

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(/** @type {string | null} */ (null))
  const [type, setType] = useState('extra_charge')
  const [note, setNote] = useState('')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const baseTotal =
    fin?.customerTotal != null && Number.isFinite(fin.customerTotal)
      ? fin.customerTotal - adjSum
      : fin?.baseQuoteTotal != null
        ? fin.baseQuoteTotal
        : null

  const notify = useCallback(
    (msg) => {
      if (onNotify) onNotify(msg)
    },
    [onNotify],
  )

  function openAdd() {
    setEditingId(null)
    setType('extra_charge')
    setNote('')
    setAmount('')
    setErr('')
    setModalOpen(true)
  }

  /** @param {import('../../lib/jobAdjustments.js').JobAdjustmentRow} row */
  function openEdit(row) {
    setEditingId(row.id)
    setType(String(row.type || 'other'))
    setNote(row.description || '')
    setAmount(String(row.amountGbp))
    setErr('')
    setModalOpen(true)
  }

  function closeModal() {
    if (saving) return
    setModalOpen(false)
    setEditingId(null)
    setErr('')
  }

  async function handleSave() {
    const amt = parseFloat(String(amount).replace(/,/g, ''))
    if (!note.trim()) {
      setErr('Enter a note or reason.')
      return
    }
    if (!Number.isFinite(amt) || amt === 0) {
      setErr('Enter a non-zero amount (use negative for discounts).')
      return
    }
    setSaving(true)
    setErr('')
    try {
      const actor = await fetchAssignedByActor()
      const now = new Date().toISOString()
      if (editingId) {
        const next = adjustments.map((a) =>
          a.id === editingId
            ? {
                ...a,
                type,
                description: note.trim(),
                amountGbp: amt,
                updatedAt: now,
              }
            : a,
        )
        onAdjustmentsChange(next)
        notify(`Adjustment updated (${money(amt)}).`)
      } else {
        const row = {
          id: newJobAdjustmentId(),
          type,
          description: note.trim(),
          amountGbp: amt,
          createdAt: now,
          createdBy: actor,
          status: 'pending',
        }
        onAdjustmentsChange([...adjustments, row])
        notify(`Adjustment added (${money(amt)}).`)
      }
      closeModal()
    } catch (e) {
      setErr(e?.message || 'Could not save adjustment.')
    } finally {
      setSaving(false)
    }
  }

  /** @param {import('../../lib/jobAdjustments.js').JobAdjustmentRow} row */
  function handleRemove(row) {
    const label = `${jobAdjustmentTypeLabel(row.type)} · ${money(row.amountGbp)}`
    if (
      !window.confirm(
        `Remove this adjustment?\n\n${label}\n${row.description || ''}\n\nTotals will update immediately.`,
      )
    ) {
      return
    }
    onAdjustmentsChange(adjustments.filter((a) => a.id !== row.id))
    notify('Adjustment removed.')
  }

  const shell = embedded
    ? 'overflow-hidden rounded-lg border border-amber-200/70 bg-white/80'
    : 'overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-b from-amber-50/40 to-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]'

  return (
    <section className={shell}>
      <div
        className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${embedded ? 'px-3 py-2' : 'gap-3 border-b border-amber-100/90 px-4 py-3 sm:px-5'}`}
      >
        <div>
          <h3 className={`font-semibold tracking-tight text-slate-900 ${embedded ? 'text-sm' : 'text-base'}`}>
            Adjustments
          </h3>
          {!embedded ? (
            <p className="mt-0.5 text-xs text-slate-600">
              Admin charges and credits applied on top of the quoted total. Separate from dispatch controls.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={openAdd}
          className="inline-flex min-h-[40px] shrink-0 items-center justify-center rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Add adjustment
        </button>
      </div>

      <div className="grid gap-2 border-b border-amber-100/60 bg-white/60 px-4 py-3 text-xs sm:grid-cols-3 sm:px-5">
        <div>
          <p className="font-semibold uppercase tracking-wide text-slate-500">Quoted base</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
            {baseTotal != null ? money(baseTotal) : '—'}
          </p>
        </div>
        <div>
          <p className="font-semibold uppercase tracking-wide text-slate-500">Adjustments</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-amber-900">{money(adjSum)}</p>
        </div>
        <div>
          <p className="font-semibold uppercase tracking-wide text-slate-500">Customer total</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
            {fin?.customerTotal != null ? money(fin.customerTotal) : '—'}
          </p>
        </div>
      </div>

      {adjustments.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-600 sm:px-5">No adjustments on this job yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 sm:px-5">Type</th>
                <th className="px-4 py-2.5">Amount</th>
                <th className="px-4 py-2.5">Note</th>
                <th className="hidden px-4 py-2.5 md:table-cell">Created</th>
                <th className="hidden px-4 py-2.5 lg:table-cell">By</th>
                <th className="px-4 py-2.5 text-right sm:px-5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {adjustments.map((a) => (
                <tr key={a.id} className="bg-white/80 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-900 sm:px-5">{jobAdjustmentTypeLabel(a.type)}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-slate-900">{money(a.amountGbp)}</td>
                  <td className="max-w-[12rem] px-4 py-3 text-slate-700 sm:max-w-xs">
                    <span className="line-clamp-2" title={a.description}>
                      {a.description || '—'}
                    </span>
                    <span className="mt-1 block text-[10px] text-slate-500 md:hidden">
                      {formatDateTimeUK(a.createdAt)}
                      {a.createdBy ? ` · ${a.createdBy}` : ''}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-slate-600 md:table-cell">
                    {formatDateTimeUK(a.createdAt)}
                    {a.updatedAt ? (
                      <span className="mt-0.5 block text-[10px] text-slate-400">Edited {formatDateTimeUK(a.updatedAt)}</span>
                    ) : null}
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-slate-600 lg:table-cell">{a.createdBy || '—'}</td>
                  <td className="px-4 py-3 text-right sm:px-5">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => openEdit(a)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-45"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => handleRemove(a)}
                        className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-800 hover:bg-red-50 disabled:opacity-45"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen ? (
        <div
          className="fixed inset-0 z-[115] flex items-end justify-center bg-slate-900/55 p-4 sm:items-center"
          role="presentation"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="job-adjust-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 id="job-adjust-modal-title" className="text-lg font-semibold text-slate-900">
              {editingId ? 'Edit adjustment' : 'Add adjustment'}
            </h4>
            <p className="mt-1 text-sm text-slate-600">Updates the live customer total for this job.</p>

            {err ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>
            ) : null}

            <label className="mt-4 block text-sm">
              <span className="text-xs font-semibold uppercase text-slate-500">Adjustment type</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              >
                {JOB_ADJUSTMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-3 block text-sm">
              <span className="text-xs font-semibold uppercase text-slate-500">Amount (£)</span>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                placeholder="25.00 or -10.00"
              />
            </label>

            <label className="mt-3 block text-sm">
              <span className="text-xs font-semibold uppercase text-slate-500">Note / reason</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                placeholder="e.g. Extra flight of stairs at delivery"
              />
            </label>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={closeModal}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add adjustment'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
