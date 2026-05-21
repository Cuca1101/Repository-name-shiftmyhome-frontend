import { payoutStatusLabel } from '../../lib/jobPayoutAccounting'

const tones = {
  paid: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  partially_paid: 'border-amber-200 bg-amber-50 text-amber-950',
  pending: 'border-slate-200 bg-slate-50 text-slate-800',
  not_set: 'border-slate-200 bg-slate-50 text-slate-600',
  held: 'border-violet-200 bg-violet-50 text-violet-900',
  disputed: 'border-rose-200 bg-rose-50 text-rose-900',
}

/**
 * @param {{ status?: string, className?: string }} props
 */
export default function DriverPayoutSettlementBadge({ status, className = '' }) {
  const s = String(status || 'pending').toLowerCase()
  const tone = tones[s] || tones.pending
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone} ${className}`}
    >
      {payoutStatusLabel(s)}
    </span>
  )
}
