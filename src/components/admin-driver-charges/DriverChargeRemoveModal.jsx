import { useEffect, useState } from 'react'
import { removeDriverCharge } from '../../lib/data/driverChargesRepository'
import { driverChargeTypeLabel } from '../../lib/driverChargeConstants'

/**
 * @param {{
 *   open: boolean,
 *   charge: Record<string, unknown> | null,
 *   onClose: () => void,
 *   onSaved?: () => void | Promise<void>,
 * }} props
 */
export default function DriverChargeRemoveModal({ open, charge, onClose, onSaved }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open) return
    setReason('')
    setErr('')
  }, [open, charge?.id])

  if (!open || !charge) return null

  async function save(e) {
    e.preventDefault()
    const trimmed = reason.trim()
    if (!trimmed) {
      setErr('Please explain why you are removing this charge.')
      return
    }
    setBusy(true)
    setErr('')
    try {
      await removeDriverCharge(charge, trimmed)
      await onSaved?.()
      onClose()
    } catch (ex) {
      setErr(ex?.message || 'Could not remove charge.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[125] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="remove-charge-title"
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <form
        onSubmit={save}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="remove-charge-title" className="text-base font-bold text-slate-900">
          Why are you removing this charge?
        </h3>
        <p className="mt-1 text-xs text-slate-600">
          {driverChargeTypeLabel(charge.chargeType)} · £{Number(charge.amount).toFixed(2)}. The charge stays on
          record as <span className="font-semibold">Removed</span> for audit.
        </p>
        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Removal reason <span className="text-rose-600">*</span>
          </span>
          <textarea
            required
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. entered in error, driver dispute upheld, duplicate charge…"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        {err ? <p className="mt-2 text-sm text-red-800">{err}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
          >
            {busy ? 'Removing…' : 'Remove charge'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
