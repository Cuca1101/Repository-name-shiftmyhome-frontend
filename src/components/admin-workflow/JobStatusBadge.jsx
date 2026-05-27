function badgeClass(tone) {
  switch (tone) {
    case 'emerald':
      return 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200'
    case 'sky':
      return 'bg-sky-50 text-sky-900 ring-1 ring-sky-200'
    case 'red':
      return 'bg-red-50 text-red-900 ring-1 ring-red-200'
    case 'slate':
      return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
    case 'violet':
      return 'bg-violet-50 text-violet-900 ring-1 ring-violet-200'
    case 'rose':
      return 'bg-rose-50 text-rose-900 ring-1 ring-rose-200'
    default:
      return 'bg-amber-50 text-amber-900 ring-1 ring-amber-200'
  }
}

/** @param {{ label: string, tone?: string }} props */
export default function JobStatusBadge({ label, tone = 'amber' }) {
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${badgeClass(tone)}`}>
      {label}
    </span>
  )
}

export { badgeClass }
