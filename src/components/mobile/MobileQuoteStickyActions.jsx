/**
 * In-flow Back / Continue bar for mobile quote steps (&lt; md) — follows Move Summary.
 */
export default function MobileQuoteStickyActions({ step, onBack, onNext }) {
  if (step >= 4) return null

  return (
    <div
      className="mt-3 flex gap-2 border-t border-slate-200 pt-3 md:hidden"
      role="group"
      aria-label="Wizard navigation"
    >
      <button
        type="button"
        onClick={onBack}
        disabled={step === 1}
        className="min-h-[48px] flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm disabled:opacity-40"
      >
        ← Back
      </button>
      <button
        type="button"
        onClick={onNext}
        className="min-h-[48px] flex-[1.2] rounded-xl bg-gradient-to-r from-brand-600 to-emerald-600 px-4 text-sm font-bold text-white shadow-md"
      >
        Continue →
      </button>
    </div>
  )
}
