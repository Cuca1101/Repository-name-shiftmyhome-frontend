import { useEffect } from 'react'
import QuoteReviewPriceCalendar from './QuoteReviewPriceCalendar'
import QuoteReviewYourMoveCard from './QuoteReviewYourMoveCard'
import QuoteServicePackagePicker from './QuoteServicePackagePicker'
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
  onBack,
  embedSummary = false,
  showOffer = true,
  continueLabel = 'Continue to payment',
  continueDisabled = false,
  hideContinue = false,
}) {
  useEffect(() => {
    document.body.classList.add('quote-step3-review')
    return () => document.body.classList.remove('quote-step3-review')
  }, [])
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

      <QuoteServicePackagePicker
        packageId={breakdown?.servicePackageId || wizard?.packageTier || 'standard'}
        baseTotal={
          breakdown?.quoteBaseTotal != null && Number.isFinite(breakdown.quoteBaseTotal)
            ? breakdown.quoteBaseTotal
            : breakdown?.estimatedTotal
        }
        declaredVolumeM3={totalM3}
        pricingSettings={settings}
        onChange={(packageTier) => onWizardChange?.((prev) => ({ ...prev, packageTier }))}
      />

      <Step3Details
        data={wizard}
        onChange={onWizardChange}
        pricingSettings={settings}
        onGoToStep={onGoToStep}
        quoteRef={quoteRef}
        hideContactSection
        accordionLayout
      />

      <div className="mt-4">
        <QuoteReviewYourMoveCard
          quoteRef={quoteRef}
          wizard={wizard}
          breakdown={breakdown}
          pricingSettings={settings}
          totalM3={totalM3}
          priceWithoutPromo={priceWithoutPromo}
          onContinueToPayment={onContinueToPayment}
          onBack={onBack}
          continueDisabled={continueDisabled}
          hideContinue={hideContinue}
          showReference={!embedSummary}
          showMap={false}
          showOffer={showOffer}
          continueLabel={continueLabel}
        />
      </div>

    </div>
  )
}
