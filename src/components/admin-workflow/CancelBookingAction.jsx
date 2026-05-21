import { useState } from 'react'
import { cancelBookingForQuote } from '../../lib/cancelDemoBooking'
import { isQuoteDemoOrTest, isRealCustomerBooking } from '../../lib/demoTestRecordDetection'
import { quotePassesAvailableJobsStrict } from '../../lib/adminJobListRules'
import { showDemoAdminUi } from '../../lib/adminProductionMode'

/**
 * Cancel an Available Jobs booking (workflow only). In production, only shown for legacy test rows.
 *
 * @param {{
 *   quote: Record<string, unknown>,
 *   onApplied?: () => void | Promise<void>,
 *   compact?: boolean,
 *   className?: string,
 * }} props
 */
export default function CancelBookingAction({ quote, onApplied, compact = false, className = '' }) {
  const id = String(quote?.id ?? '').trim()
  const [open, setOpen] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  if (!id || !quotePassesAvailableJobsStrict(quote)) return null

  const legacyTest = isQuoteDemoOrTest(quote)
  if (!showDemoAdminUi() && !legacyTest) return null
  if (isRealCustomerBooking(quote)) return null

  async function handleConfirm() {
    if (!confirmed) return
    setBusy(true)
    setErr('')
    try {
      await cancelBookingForQuote(id, quote)
      setOpen(false)
      setConfirmed(false)
      if (onApplied) await onApplied()
    } catch (e) {
      setErr(e?.message || 'Could not cancel booking.')
    } finally {
      setBusy(false)
    }
  }

  function closeModal() {
    if (busy) return
    setOpen(false)
    setConfirmed(false)
    setErr('')
  }

  const btnClass = compact
    ? 'inline-flex min-h-[36px] w-full items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-800 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50'
    : 'inline-flex min-h-[44px] items-center justify-center rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-800 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <>
      <button
        type="button"
        className={`${btnClass} ${className}`.trim()}
        onClick={() => setOpen(true)}
      >
        Cancel booking
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
          onClick={closeModal}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-booking-title"
          >
            <h2 id="cancel-booking-title" className="text-lg font-bold text-slate-900">
              Cancel booking?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              This removes the job from Available Jobs and marks it cancelled in admin. Payment and Stripe
              records are not changed.
            </p>
            {legacyTest ? (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
                This booking is flagged as a test record. Do not use for live customer bookings.
              </p>
            ) : (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-900">
                Only use when the booking should not proceed. Real customer refunds must be handled separately.
              </p>
            )}

            <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>I confirm this booking should be cancelled in admin.</span>
            </label>

            {err ? (
              <p className="mt-3 text-sm text-red-700" role="alert">
                {err}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={closeModal}
                className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                Keep booking
              </button>
              <button
                type="button"
                disabled={busy || !confirmed}
                onClick={() => void handleConfirm()}
                className="min-h-[44px] rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? 'Cancelling…' : 'Cancel booking'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
