import { useState } from 'react'
import {
  formatJobAcceptedMoney,
  MANUAL_PAYOUT_CONFIRMED_LABEL,
  resolveJobAcceptedPaymentBreakdown,
} from '../../lib/jobAcceptedPaymentDisplay'
import JobDriverPayoutOverrideModal from './JobDriverPayoutOverrideModal'

const btn =
  'inline-flex min-h-[34px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45'

/**
 * Edit driver payout / jump to customer adjustments — before assigning from Available Jobs.
 * @param {{
 *   q: Record<string, unknown>,
 *   onUpdated?: () => void | Promise<void>,
 *   compact?: boolean,
 *   disabled?: boolean,
 * }} props
 */
export default function JobPayoutQuickActions({ q, onUpdated, compact = false, disabled = false }) {
  const [modalOpen, setModalOpen] = useState(false)
  const payment = resolveJobAcceptedPaymentBreakdown(q)

  function scrollToAdjustments() {
    document.querySelector('[data-job-adjustments]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (compact) {
    return (
      <>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-slate-600">
            Driver pay:{' '}
            <span className="font-bold tabular-nums text-violet-900">
              {formatJobAcceptedMoney(payment.driverPayout)}
            </span>
          </span>
          {payment.manualPayoutOverride ? (
            <span className="rounded bg-violet-100 px-1.5 py-px text-[9px] font-bold uppercase text-violet-900">
              {MANUAL_PAYOUT_CONFIRMED_LABEL}
            </span>
          ) : null}
          <button
            type="button"
            disabled={disabled}
            className="font-semibold text-brand-700 hover:underline disabled:opacity-45"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setModalOpen(true)
            }}
          >
            Edit payout
          </button>
        </div>
        <JobDriverPayoutOverrideModal
          open={modalOpen}
          q={q}
          onClose={() => setModalOpen(false)}
          onSaved={onUpdated}
        />
      </>
    )
  }

  return (
    <>
      <div className="rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50/90 to-white px-4 py-3 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-violet-900">Price before you assign</p>
        <p className="mt-1 text-sm text-slate-600">
          Change what the driver is paid, or add a customer charge/credit before sending the job.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-slate-800">
            Driver payout:{' '}
            <span className="text-base font-bold tabular-nums text-violet-900">
              {formatJobAcceptedMoney(payment.driverPayout)}
            </span>
          </p>
          {payment.manualPayoutOverride ? (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-900">
              {MANUAL_PAYOUT_CONFIRMED_LABEL}
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={disabled} className={`${btn} border-violet-300 bg-violet-600 text-white hover:bg-violet-700`} onClick={() => setModalOpen(true)}>
            Edit driver payout
          </button>
          <button type="button" disabled={disabled} className={btn} onClick={scrollToAdjustments}>
            Adjust customer total
          </button>
        </div>
      </div>
      <JobDriverPayoutOverrideModal
        open={modalOpen}
        q={q}
        onClose={() => setModalOpen(false)}
        onSaved={onUpdated}
      />
    </>
  )
}
