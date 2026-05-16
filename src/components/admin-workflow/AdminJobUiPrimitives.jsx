/**
 * Shared admin job UI atoms (ShiftMyHome operations style).
 */

const TONE =
  /** @type {const} */ ({
    slate: 'border-slate-200/90 bg-slate-50 text-slate-800',
    emerald: 'border-emerald-200/90 bg-emerald-50 text-emerald-900',
    sky: 'border-sky-200/90 bg-sky-50 text-sky-900',
    amber: 'border-amber-200/90 bg-amber-50 text-amber-900',
    violet: 'border-violet-200/90 bg-violet-50 text-violet-900',
    rose: 'border-rose-200/90 bg-rose-50 text-rose-900',
  })

/**
 * @param {{ label: string, value: string, tone?: keyof typeof TONE }} props
 */
export function AdminChip({ label, value, tone = 'slate' }) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-sm sm:text-xs ${TONE[tone] ?? TONE.slate}`}
    >
      <span className="shrink-0 font-medium opacity-80">{label}</span>
      <span className="min-w-0 truncate">{value}</span>
    </span>
  )
}

/**
 * @param {{ title: string, children: unknown, className?: string }} props
 */
export function AdminSubsection({ title, children, className = '' }) {
  return (
    <div className={className}>
      <h4 className="text-[11px] font-bold uppercase tracking-wide text-slate-500 sm:text-xs">{title}</h4>
      <div className="mt-3">{children}</div>
    </div>
  )
}

/**
 * @param {{ label: string, value: unknown, mono?: boolean }} props
 */
export function AdminField({ label, value, mono = false }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd
        className={`mt-1 text-sm leading-relaxed text-slate-900 ${mono ? 'break-all font-mono text-[13px]' : 'whitespace-pre-wrap'}`}
      >
        {value ?? '—'}
      </dd>
    </div>
  )
}
