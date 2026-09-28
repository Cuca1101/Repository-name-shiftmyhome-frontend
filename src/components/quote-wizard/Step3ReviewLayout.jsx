import { Lock, ShieldCheck, Tag } from 'lucide-react'
import QuoteReviewPriceCalendar from './QuoteReviewPriceCalendar'
import QuoteReviewYourMoveCard from './QuoteReviewYourMoveCard'
import Step3Details from './steps/Step3Details'

/** Step 3 — choose date/price slot and optional move extras (payment is Step 4). */
export default function Step3ReviewLayout({
  quoteRef,
  wizard,
  onWizardChange,
  breakdown,
  serviceType,
  settings,
  lineItems,
  heavyItemCount,
  priceWithoutPromo = null,
  onGoToStep,
  totalM3 = 0,
  onContinueToPayment,
}) {
  const calendarProps = {
    wizard,
    onWizardChange,
    breakdown,
    pricingSettings: settings,
    serviceType,
    lineItems,
    heavyItemCount,
    priceWithoutPromo,
    compact: true,
    showSelectedTotal: false,
    weekGrid: true,
  }

  return (
    <div data-quote-step="3" className="min-w-0 max-w-full">
      <QuoteReviewPriceCalendar {...calendarProps} />

      <div className="mt-4 md:hidden">
        <QuoteReviewYourMoveCard
          wizard={wizard}
          breakdown={breakdown}
          pricingSettings={settings}
          totalM3={totalM3}
          priceWithoutPromo={priceWithoutPromo}
          onContinueToPayment={onContinueToPayment}
        />
      </div>

      <Step3Details
        data={wizard}
        onChange={onWizardChange}
        pricingSettings={settings}
        onGoToStep={onGoToStep}
        quoteRef={quoteRef}
        hideContactSection
        accordionLayout
      />

      {quoteRef ? (
        <p className="mt-3 font-mono text-xs font-semibold text-slate-500">Quote reference {quoteRef}</p>
      ) : null}

      <ul className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center text-[11px] font-semibold text-slate-600 sm:text-xs">
        <li className="flex flex-col items-center gap-1">
          <ShieldCheck className="h-4 w-4 text-blue-600" aria-hidden />
          Fully insured
        </li>
        <li className="flex flex-col items-center gap-1">
          <Lock className="h-4 w-4 text-blue-600" aria-hidden />
          Secure payment
        </li>
        <li className="flex flex-col items-center gap-1">
          <Tag className="h-4 w-4 text-blue-600" aria-hidden />
          No hidden fees
        </li>
      </ul>
    </div>
  )
}
