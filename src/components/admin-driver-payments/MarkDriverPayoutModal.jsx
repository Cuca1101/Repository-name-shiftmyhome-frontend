import { useEffect, useMemo, useState } from 'react'
import { PAYOUT_PAYMENT_METHODS } from '../../lib/driverPayoutSettlement'

const inputCls =
  'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900'

function todayIsoDate() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   title?: string,
 *   subtitle?: string,
 *   netPayable: number,
 *   remainingBalance: number,
 *   mode: 'full' | 'partial' | 'note_only',
 *   onSubmit: (payload: {
 *     mode: 'full' | 'partial' | 'note_only',
 *     amountPaid?: number,
 *     paidAt: string,
 *     method: string,
 *     reference: string,
 *     notes: string,
 *   }) => Promise<void>,
 * }} props
 */
export default function MarkDriverPayoutModal({
  open,
  onClose,
  title = 'Mark driver payout',
  subtitle = '',
  netPayable,
  remainingBalance,
  mode,
  onSubmit,
}) {
  const [amount, setAmount] = useState('')
  const [paidDate, setPaidDate] = useState(todayIsoDate())
  const [method, setMethod] = useState('bank_transfer')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const defaultAmount = useMemo(() => {
    const r = Number(remainingBalance)
    return Number.isFinite(r) && r > 0 ? r.toFixed(2) : '0.00'
  }, [remainingBalance])

  useEffect(() => {
    if (!open) return
    setAmount(mode === 'full' ? defaultAmount : mode === 'partial' ? defaultAmount : '')
    setPaidDate(todayIsoDate())
    setMethod('bank_transfer')
    setReference('')
    setNotes('')
    setErr('')
  }, [open, mode, defaultAmount])

  if (!open) return null

  const heading =
    mode === 'full'
      ? title || 'Mark as paid'
      : mode === 'partial'
        ? 'Mark partial payment'
        : 'Add payment note'

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const paidAt = paidDate ? new Date(`${paidDate}T12:00:00`).toISOString() : new Date().toISOString()
      await onSubmit({
        mode,
        amountPaid: mode === 'partial' ? parseFloat(String(amount).replace(/,/g, '')) : undefined,
        paidAt,
        method,
        reference: reference.trim(),
        notes: notes.trim(),
      })
      onClose()
    } catch (ex) {
      setErr(ex?.message || 'Could not save payment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <form
        onSubmit={handleSubmit}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-slate-900">{heading}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
        <p className="mt-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Internal driver payout only — does not change customer payment, Stripe, or invoices.
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-slate-500">Net payable</dt>
            <dd className="font-bold text-slate-900">£{Number(netPayable).toFixed(2)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Remaining</dt>
            <dd className="font-bold text-emerald-800">£{Number(remainingBalance).toFixed(2)}</dd>
          </div>
        </dl>

        {mode === 'partial' ? (
          <label className="mt-4 block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Amount paid now (£)
            </span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputCls}
            />
          </label>
        ) : null}

        {mode !== 'note_only' ? (
          <>
            <label className="mt-3 block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Payment date
              </span>
              <input
                type="date"
                required
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="mt-3 block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Payment method
              </span>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls}>
                {PAYOUT_PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Payment reference (optional)
              </span>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className={inputCls}
                placeholder="e.g. bank transfer ref"
              />
            </label>
          </>
        ) : null}

        <label className="mt-3 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</span>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputCls}
            placeholder="Internal payment note"
          />
        </label>

        {err ? <p className="mt-3 text-sm text-red-800">{err}</p> : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={busy}
            className="min-h-[44px] flex-1 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
          >
            {busy ? 'Saving…' : mode === 'note_only' ? 'Save note' : 'Confirm payment'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="min-h-[44px] rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
