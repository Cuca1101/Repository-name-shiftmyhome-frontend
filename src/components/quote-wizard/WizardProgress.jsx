const STEPS = [
  { n: 1, label: 'Address & access' },
  { n: 2, label: 'Items & contact' },
  { n: 3, label: 'Review' },
  { n: 4, label: 'Payment' },
]

const SHORT_LABELS = {
  1: 'Address',
  2: 'Items',
  3: 'Review',
  4: 'Payment',
}

export default function WizardProgress({ step, variant = 'default', step4ShortLabel, capAtTablet = false }) {
  const shortLabels = step4ShortLabel ? { ...SHORT_LABELS, 4: step4ShortLabel } : SHORT_LABELS
  const steps = step4ShortLabel
    ? STEPS.map((item) => (item.n === 4 ? { ...item, label: step4ShortLabel } : item))
    : STEPS

  if (variant === 'page') {
    return (
      <ol className="quote-page-steps mb-1 flex w-full items-start justify-between gap-0.5 min-[420px]:items-center min-[420px]:justify-center min-[420px]:gap-0">
        {steps.map((s, index) => {
          const current = step === s.n
          const done = step > s.n
          return (
            <li key={s.n} className="flex min-w-0 flex-1 flex-col items-center min-[420px]:contents">
              <span className="flex min-w-0 flex-col items-center gap-0.5 min-[420px]:flex-row min-[420px]:gap-0">
                <span
                  className={`quote-page-step-dot flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums min-[420px]:h-6 min-[420px]:w-6 min-[420px]:text-[11px] md:h-8 md:w-8 md:text-sm ${capAtTablet ? '' : 'lg:h-9 lg:w-9 lg:text-base xl:h-10 xl:w-10 '}${
                    done ? 'bg-emerald-500 text-white' : current ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {done ? '✓' : s.n}
                </span>
                <span
                  className={`quote-page-step-label max-w-full px-0.5 text-center text-[10px] font-semibold leading-tight min-[420px]:ml-1 min-[420px]:whitespace-nowrap min-[420px]:px-0 min-[420px]:text-[11px] md:ml-1.5 md:text-sm ${capAtTablet ? '' : 'lg:ml-2 lg:text-base xl:text-lg '}${
                    current ? 'text-slate-900' : done ? 'text-emerald-600' : 'text-slate-400'
                  }`}
                >
                  {shortLabels[s.n]}
                </span>
              </span>
              {index < STEPS.length - 1 ? (
                <span className={`mx-1 hidden h-px w-2 shrink-0 bg-slate-300 min-[420px]:mx-1.5 min-[420px]:block min-[420px]:w-3 md:mx-3 md:w-6 ${capAtTablet ? '' : 'lg:mx-4 lg:w-8 xl:w-10'}`} aria-hidden />
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
        {steps.map((s) => (
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
