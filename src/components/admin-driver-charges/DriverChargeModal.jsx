import { useEffect, useMemo, useState } from 'react'
import { createDriverCharge } from '../../lib/data/driverChargesRepository'
import {
  DRIVER_CHARGE_STATUSES,
  DRIVER_CHARGE_TYPES,
} from '../../lib/driverChargeConstants'
import { loadFleetDriversForAdmin } from '../../lib/adminFleetDrivers'

const inputCls =
  'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900'

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   onSaved?: () => void | Promise<void>,
 *   initialDriverId?: string,
 *   initialQuoteId?: string | null,
 *   initialJobId?: string | null,
 *   initialQuoteRef?: string,
 *   initialChargeType?: string,
 * }} props
 */
export default function DriverChargeModal({
  open,
  onClose,
  onSaved,
  initialDriverId = '',
  initialQuoteId = null,
  initialJobId = null,
  initialQuoteRef = '',
  initialChargeType = 'admin_adjustment',
}) {
  const [drivers, setDrivers] = useState([])
  const [driverId, setDriverId] = useState('')
  const [chargeType, setChargeType] = useState('admin_adjustment')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [status, setStatus] = useState('pending')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    void loadFleetDriversForAdmin().then(setDrivers)
  }, [])

  useEffect(() => {
    if (!open) return
    setDriverId(initialDriverId || '')
    setChargeType(initialChargeType || 'admin_adjustment')
    setAmount('')
    setReason('')
    setNotes('')
    setEvidenceUrl('')
    setStatus('pending')
    setErr('')
  }, [open, initialDriverId, initialChargeType])

  const quoteLabel = useMemo(() => {
    if (initialQuoteRef) return initialQuoteRef
    if (initialQuoteId) return `Quote ${String(initialQuoteId).slice(0, 8)}…`
    return '—'
  }, [initialQuoteRef, initialQuoteId])

  if (!open) return null

  async function save() {
    const amt = parseFloat(String(amount).replace(/,/g, ''))
    if (!driverId) {
      setErr('Select a driver.')
      return
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setErr('Enter a valid charge amount.')
      return
    }
    if (!reason.trim()) {
      setErr('Enter a reason for this charge.')
      return
    }
    setBusy(true)
    setErr('')
    try {
      await createDriverCharge({
        driverId,
        quoteId: initialQuoteId,
        jobId: initialJobId,
        chargeType,
        amount: amt,
        reason: reason.trim(),
        notes: notes.trim(),
        evidenceUrl: evidenceUrl.trim() || null,
        status,
      })
      await onSaved?.()
      onClose()
    } catch (e) {
      setErr(e?.message || 'Could not save charge.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/55 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-slate-900">Add driver charge</h2>
        <p className="mt-2 rounded-lg border border-amber-200/90 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          This is an internal deduction from driver payout only. It does not affect customer payment,
          invoice, or Stripe charges.
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Driver</span>
            <select
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              className={inputCls}
              disabled={Boolean(initialDriverId)}
            >
              <option value="">Select driver…</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="text-xs font-semibold uppercase text-slate-500">Related job</span>
            <p className="font-mono font-semibold text-slate-900">{quoteLabel}</p>
          </div>

          <label className="block text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Charge type
            </span>
            <select value={chargeType} onChange={(e) => setChargeType(e.target.value)} className={inputCls}>
              {DRIVER_CHARGE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Amount (£)
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputCls}
            />
          </label>

          <label className="block text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reason</span>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={inputCls}
              placeholder="e.g. Damage to customer sofa"
            />
          </label>

          <label className="block text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Internal notes
            </span>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={inputCls}
            />
          </label>

          <label className="block text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Evidence URL (optional)
            </span>
            <input
              type="url"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              className={inputCls}
              placeholder="https://…"
            />
          </label>

          <label className="block text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              {DRIVER_CHARGE_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {err ? (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {err}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="min-h-[44px] rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800"
          >
            Close
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="min-h-[44px] rounded-xl bg-rose-800 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-900 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save charge'}
          </button>
        </div>
      </div>
    </div>
  )
}
