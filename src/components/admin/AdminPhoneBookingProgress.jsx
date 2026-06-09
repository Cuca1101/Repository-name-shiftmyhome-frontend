const STEPS = [
  { n: 1, label: 'Move & access' },
  { n: 2, label: 'Inventory & contact' },
  { n: 3, label: 'Review & extras' },
]

const SHORT_LABELS = {
  1: 'Move',
  2: 'Items',
  3: 'Review',
}

/** @param {{ step: number, onStepClick?: (step: number) => void }} props */
export default function AdminPhoneBookingProgress({ step, onStepClick }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="relative mb-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-brand-600 to-emerald-500 transition-all duration-300 ease-out"
          style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
        />
      </div>
      <ol className="grid grid-cols-3 gap-2 text-sm font-semibold text-slate-500">
        {STEPS.map((s) => {
          const isCurrent = step === s.n
          const isDone = step > s.n
          const canClick = typeof onStepClick === 'function'
          return (
            <li key={s.n} className={`flex min-w-0 justify-center ${step >= s.n ? 'text-brand-700' : ''}`}>
              <button
                type="button"
                onClick={() => onStepClick?.(s.n)}
                disabled={!canClick}
                className={`flex min-w-0 items-center justify-center gap-2 rounded-lg px-1 py-1 transition ${
                  canClick ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default'
                } ${isCurrent ? 'ring-2 ring-brand-500/25' : ''}`}
                aria-current={isCurrent ? 'step' : undefined}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm tabular-nums ${
                    isCurrent
                      ? 'bg-brand-600 text-white shadow-md ring-2 ring-brand-200'
                      : isDone
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {isDone ? '✓' : s.n}
                </span>
                <span className="hidden min-w-0 sm:inline">{s.label}</span>
                <span className="min-w-0 sm:hidden">{SHORT_LABELS[s.n]}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
