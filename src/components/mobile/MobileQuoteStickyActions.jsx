/**
 * In-flow Back / Continue bar for mobile quote steps (&lt; md) — follows Move Summary.
 * `pinned` keeps the primary action in a bottom bar on the quote page.
 */
import { Lock } from 'lucide-react'
import MobileStepRefBadge from '../quote-wizard/MobileStepRefBadge'
import { QuoteFlowHelp } from '../WhatsAppButton'

export default function MobileQuoteStickyActions({
  step,
  onBack,
  onNext,
  nextDisabled = false,
  nextLoading = false,
  pinned = false,
  quoteRef = '',
}) {
  if (step > 4) return null

  if (pinned && step < 4) {
    const label = nextLoading
      ? 'Finding your price…'
      : step === 3
        ? 'Continue to payment →'
        : step === 2
          ? 'Get a quote'
          : 'Continue →'
    return (
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-[#e7eef6]/95 px-3 pt-2 backdrop-blur lg:hidden"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        role="group"
        aria-label="Quote navigation"
      >
        <MobileStepRefBadge quoteRef={quoteRef} className="mb-2" />
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-base font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {nextDisabled && step === 3 ? <Lock className="h-4 w-4" aria-hidden /> : null}
          {label}
        </button>
        <QuoteFlowHelp className="mt-2" />
      </div>
    )
  }

  if (step === 3) {
    return (
      <div
        className="sticky bottom-0 z-30 mt-3 border-t border-slate-200 bg-white/95 px-1 py-2 backdrop-blur lg:hidden"
        role="group"
        aria-label="Review navigation"
      >
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-bold text-white shadow-md disabled:cursor-not-allowed disabled:bg-[#d7e4f5] disabled:text-slate-500 disabled:shadow-none"
        >
          {nextDisabled ? <Lock className="h-4 w-4" aria-hidden /> : null}
          Continue to payment →
        </button>
        <button
          type="button"
          onClick={onBack}
          className="mt-1 flex min-h-[40px] w-full items-center justify-center gap-1 text-sm font-semibold text-slate-600"
        >
          <span aria-hidden>←</span>
          Back to items
        </button>
      </div>
    )
  }

  if (step === 4) {
    return (
      <div
        className="mt-2 border-t border-slate-200 pt-2 lg:hidden"
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
      className="mt-2 flex gap-5 border-t border-slate-200 pt-2 lg:hidden"
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
        disabled={nextDisabled}
        className="min-h-[48px] flex-[1.2] touch-manipulation rounded-lg bg-gradient-to-r from-brand-600 to-emerald-600 px-3 text-sm font-bold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-60"
      >
        {nextLoading
          ? 'Finding your price…'
          : step === 2
            ? 'Get a quote'
            : step === 3
              ? 'Continue to payment →'
              : 'Continue →'}
      </button>
    </div>
  )
}
