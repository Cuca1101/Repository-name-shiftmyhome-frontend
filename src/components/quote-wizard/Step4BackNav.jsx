/**
 * Step 4 secondary back control — returns to Step 3 without clearing wizard state.
 * @param {{ onBack: () => void, className?: string }} props
 */
export default function Step4BackNav({ onBack, className = '' }) {
  return (
    <div
      className={`border-t border-slate-200 pt-4 ${className}`.trim()}
      role="group"
      aria-label="Review navigation"
    >
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.99] md:min-h-[52px] md:w-auto"
      >
        <span aria-hidden>←</span>
        Back
      </button>
    </div>
  )
}
