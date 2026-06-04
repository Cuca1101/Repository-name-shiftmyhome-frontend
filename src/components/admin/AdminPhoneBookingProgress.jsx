const STEPS = [
  { n: 1, label: 'Move & access' },
  { n: 2, label: 'Inventory & contact' },
  { n: 3, label: 'Review & book' },
]

const SHORT_LABELS = {
  1: 'Move',
  2: 'Items',
  3: 'Book',
}

/** @param {{ step: number }} props */
export default function AdminPhoneBookingProgress({ step }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="relative mb-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-brand-600 to-emerald-500 transition-all duration-300 ease-out"
          style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
        />
      </div>
      <ol className="grid grid-cols-3 gap-2 text-sm font-semibold text-slate-500">
        {STEPS.map((s) => (
          <li
            key={s.n}
            className={`flex min-w-0 items-center justify-center gap-2 ${step >= s.n ? 'text-brand-700' : ''}`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm tabular-nums ${
                step === s.n
                  ? 'bg-brand-600 text-white shadow-md ring-2 ring-brand-200'
                  : step > s.n
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-100 text-slate-500'
              }`}
            >
              {step > s.n ? '✓' : s.n}
            </span>
            <span className="hidden min-w-0 sm:inline">{s.label}</span>
            <span className="min-w-0 sm:hidden">{SHORT_LABELS[s.n]}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
