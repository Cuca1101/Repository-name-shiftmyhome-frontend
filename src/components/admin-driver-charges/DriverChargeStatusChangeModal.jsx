import { useEffect, useState } from 'react'
import { setDriverChargePaymentStatus } from '../../lib/data/driverChargesRepository'
import { driverChargeStatusMeta, driverChargeTypeLabel } from '../../lib/driverChargeConstants'

/**
 * @param {{
 *   open: boolean,
 *   charge: Record<string, unknown> | null,
 *   targetStatus: 'paid' | 'not_paid',
 *   onClose: () => void,
 *   onSaved?: () => void | Promise<void>,
 * }} props
 */
export default function DriverChargeStatusChangeModal({
  open,
  charge,
  targetStatus,
  onClose,
  onSaved,
}) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open) return
    setNote('')
    setErr('')
  }, [open, charge?.id, targetStatus])

  if (!open || !charge) return null

  const targetMeta = driverChargeStatusMeta(targetStatus)

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await setDriverChargePaymentStatus(charge, targetStatus, note.trim())
      await onSaved?.()
      onClose()
    } catch (ex) {
      setErr(ex?.message || 'Could not update status.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[125] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <form
        onSubmit={save}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-slate-900">
          Mark as {targetMeta.label.toLowerCase()}
        </h3>
        <p className="mt-1 text-xs text-slate-600">
          {driverChargeTypeLabel(charge.chargeType)} · £{Number(charge.amount).toFixed(2)}
        </p>
        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Note (optional)
          </span>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. deducted from weekly settlement, driver paid cash…"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        {err ? <p className="mt-2 text-sm text-red-800">{err}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Saving…' : `Confirm ${targetMeta.label.toLowerCase()}`}
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
