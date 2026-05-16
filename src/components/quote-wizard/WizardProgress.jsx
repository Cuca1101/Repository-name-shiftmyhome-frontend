const STEPS = [
  { n: 1, label: 'Address & access' },
  { n: 2, label: 'Inventory' },
  { n: 3, label: 'Details' },
  { n: 4, label: 'Review & price' },
]

export default function WizardProgress({ step }) {
  return (
    <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-card sm:mb-8 sm:p-6">
      <div className="relative mb-4 h-2 overflow-hidden rounded-full bg-slate-100 sm:mb-6">
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-brand-600 to-emerald-500 transition-all duration-300 ease-out"
          style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
        />
      </div>
      <ol className="grid grid-cols-2 gap-x-2 gap-y-3 text-[0.7rem] font-semibold leading-tight text-slate-500 sm:grid-cols-4 sm:gap-2 sm:text-sm">
        {STEPS.map((s) => (
          <li
            key={s.n}
            className={`flex min-w-0 flex-col items-center gap-1 text-center sm:flex-1 sm:flex-row sm:justify-center sm:gap-2 ${
              step >= s.n ? 'text-brand-700' : ''
            }`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs tabular-nums sm:h-8 sm:w-8 sm:text-sm ${
                step === s.n
                  ? 'bg-brand-600 text-white shadow-md ring-2 ring-brand-200'
                  : step > s.n
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-100 text-slate-500'
              }`}
            >
              {step > s.n ? '✓' : s.n}
            </span>
            <span className="hidden line-clamp-2 sm:inline sm:max-w-none sm:line-clamp-none">{s.label}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-center text-sm font-medium text-slate-700 sm:hidden">
        Step {step}: {STEPS[step - 1]?.label}
      </p>
    </div>
  )
}
