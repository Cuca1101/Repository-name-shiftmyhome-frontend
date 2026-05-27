import { useState } from 'react'
import {
  formatJobAcceptedMoney,
  MANUAL_PAYOUT_CONFIRMED_LABEL,
  resolveJobAcceptedPaymentBreakdown,
} from '../../lib/jobAcceptedPaymentDisplay'
import JobDriverPayoutOverrideModal from './JobDriverPayoutOverrideModal'

/**
 * Compact driver pay line for Job Accepted list rows only.
 * @param {{
 *   q: Record<string, unknown>,
 *   onUpdated?: () => void | Promise<void>,
 *   showEdit?: boolean,
 * }} props
 */
export default function JobAcceptedListPayoutSummary({ q, onUpdated, showEdit = true }) {
  const [modalOpen, setModalOpen] = useState(false)
  const payment = resolveJobAcceptedPaymentBreakdown(q)

  return (
    <>
      <p className="text-[10px] leading-snug text-slate-700">
        <span className="font-semibold text-slate-600">Driver pay:</span>{' '}
        <span className="tabular-nums font-semibold text-violet-900">
          {formatJobAcceptedMoney(payment.driverPayout)}
        </span>
      </p>
      {payment.manualPayoutOverride ? (
        <span className="mt-0.5 inline-flex rounded bg-violet-100 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-violet-900">
          {MANUAL_PAYOUT_CONFIRMED_LABEL}
        </span>
      ) : null}
      {showEdit ? (
        <button
          type="button"
          className="mt-0.5 block text-[9px] font-medium text-slate-400 opacity-0 transition hover:text-slate-600 group-hover:opacity-100"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setModalOpen(true)
          }}
        >
          Edit payout
        </button>
      ) : null}
      <JobDriverPayoutOverrideModal
        open={modalOpen}
        q={q}
        onClose={() => setModalOpen(false)}
        onSaved={onUpdated}
      />
    </>
  )
}
