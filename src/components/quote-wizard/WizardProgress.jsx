const STEPS = [
  { n: 1, label: 'Address & access' },
  { n: 2, label: 'Items & contact' },
  { n: 3, label: 'Review' },
  { n: 4, label: 'Pay' },
]

const SHORT_LABELS = {
  1: 'Address',
  2: 'Items',
  3: 'Review',
  4: 'Pay',
}

export default function WizardProgress({ step, variant = 'default' }) {
  if (variant === 'page') {
    return (
      <ol className="quote-page-steps mb-2 flex w-full items-center">
        {STEPS.map((s, index) => {
          const current = step === s.n
          const done = step > s.n
          return (
            <li key={s.n} className="contents">
              <span className="flex shrink-0 items-center">
                <span
                  className={`quote-page-step-dot flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                    current || done ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {done ? '✓' : s.n}
                </span>
                <span
                  className={`quote-page-step-label ml-1.5 whitespace-nowrap text-xs font-semibold sm:text-sm ${
                    current ? 'text-slate-900' : done ? 'text-blue-700' : 'text-slate-400'
                  }`}
                >
                  {SHORT_LABELS[s.n]}
                </span>
              </span>
              {index < STEPS.length - 1 ? (
                <span className="mx-1.5 h-px min-w-2 flex-1 bg-slate-200 sm:mx-2" aria-hidden />
              ) : null}
            </li>
          )
        })}
      </ol>
    )
  }

  const progressPct = Math.min(100, Math.max(0, (step / STEPS.length) * 100))

  return (
    <div className="mb-1.5 rounded-lg border border-slate-200 bg-white p-1 shadow-card md:mb-8 md:rounded-xl md:p-6">
      <div className="relative mb-1 h-1 overflow-hidden rounded-full bg-slate-100 md:mb-6 md:h-2">
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-brand-600 to-emerald-500 transition-all duration-300 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <ol className="grid grid-cols-4 gap-0.5 text-[0.5625rem] font-semibold leading-tight text-slate-500 md:gap-2 md:text-sm">
        {STEPS.map((s) => (
          <li
            key={s.n}
            className={`flex min-w-0 flex-row items-center justify-center gap-0.5 text-center xxs:gap-1 sm:gap-2 ${
              step >= s.n ? 'text-brand-700' : ''
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.625rem] tabular-nums md:h-8 md:w-8 md:text-sm ${
                step === s.n
                  ? 'bg-brand-600 text-white shadow-md ring-2 ring-brand-200'
                  : step > s.n
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-100 text-slate-500'
              }`}
            >
              {step > s.n ? '✓' : s.n}
            </span>
            <span className="hidden min-w-0 line-clamp-2 xs:inline sm:max-w-none">
              {s.label}
            </span>
            <span className="min-w-0 line-clamp-1 xs:hidden">{SHORT_LABELS[s.n]}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
