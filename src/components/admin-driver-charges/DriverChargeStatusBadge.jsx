import { driverChargeStatusMeta } from '../../lib/driverChargeConstants'

const tones = {
  amber: 'bg-amber-50 text-amber-950 ring-amber-200/90',
  rose: 'bg-rose-50 text-rose-900 ring-rose-200/90',
  violet: 'bg-violet-50 text-violet-900 ring-violet-200/90',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200/90',
}

/**
 * @param {{ status: string, className?: string }} props
 */
export default function DriverChargeStatusBadge({ status, className = '' }) {
  const meta = driverChargeStatusMeta(status)
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${tones[meta.tone] || tones.slate} ${className}`}
    >
      {meta.label}
    </span>
  )
}
