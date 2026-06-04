import QuoteReviewPriceCalendar from './QuoteReviewPriceCalendar'

function EditLink({ label, step, onGoToStep }) {
  return (
    <button
      type="button"
      onClick={() => onGoToStep(step)}
      className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-900 shadow-sm transition hover:bg-brand-100"
    >
      {label}
    </button>
  )
}

/**
 * Desktop Step 4 review & payment (md+).
 */
export default function DesktopStep4Review({ onGoToStep, calendarProps }) {
  return (
    <div className="hidden min-w-0 space-y-6 md:block">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Review &amp; payment</h2>
        <p className="mt-1 text-sm text-slate-600">
          Choose your move slot, check your estimate, then pay securely to confirm your booking.
        </p>
      </div>

      {calendarProps ? <QuoteReviewPriceCalendar {...calendarProps} /> : null}

      <div className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50/90 to-white px-5 py-4 text-sm leading-relaxed text-sky-950 shadow-sm">
        <p className="font-semibold text-sky-900">Need to change something?</p>
        <p className="mt-1 text-sky-900/90">
          Use the edit links below — your quote reference stays the same and your estimate updates
          when you return here.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <EditLink label="Edit addresses & access" step={1} onGoToStep={onGoToStep} />
          <EditLink label="Edit inventory & contact" step={2} onGoToStep={onGoToStep} />
          <EditLink label="Edit date & extras" step={3} onGoToStep={onGoToStep} />
        </div>
      </div>
    </div>
  )
}
