/**
 * In-flow Back / Continue bar for mobile quote steps (&lt; md) — follows Move Summary.
 */
export default function MobileQuoteStickyActions({ step, onBack, onNext }) {
  if (step > 4) return null

  if (step === 4) {
    return (
      <div
        className="mt-2 border-t border-slate-200 pt-2 md:hidden"
        role="group"
        aria-label="Review navigation"
      >
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.99]"
        >
          <span aria-hidden>←</span>
          Back
        </button>
      </div>
    )
  }

  return (
    <div
      className="mt-2 flex gap-2 border-t border-slate-200 pt-2 md:hidden"
      role="group"
      aria-label="Wizard navigation"
    >
      <button
        type="button"
        onClick={onBack}
        disabled={step === 1}
        className="min-h-[44px] flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm disabled:opacity-40"
      >
        ← Back
      </button>
      <button
        type="button"
        onClick={onNext}
        className="min-h-[44px] flex-[1.2] rounded-lg bg-gradient-to-r from-brand-600 to-emerald-600 px-3 text-sm font-bold text-white shadow-md"
      >
        Continue →
      </button>
    </div>
  )
}
