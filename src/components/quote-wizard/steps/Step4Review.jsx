import MobileStep4Review from '../MobileStep4Review'
import DesktopStep4Review from '../DesktopStep4Review'
import QuoteEstimatedTotalCard from '../QuoteEstimatedTotalCard'
import QuotePaymentSection from '../QuotePaymentSection'
import Step4BackNav from '../Step4BackNav'

export default function Step4Review({
  serviceType,
  quoteRef,
  wizard,
  onWizardChange,
  breakdown,
  totalM3,
  crewSettings,
  pricingSettings,
  lineItems,
  heavyItemCount,
  onDistanceFromRoute,
  payLoading,
  payError,
  cardPayment,
  onClearCardPayment,
  onPay,
  reservationFeeGbp = 50,
  onPaymentSucceeded,
  onGoToStep,
  onBack,
  priceWithoutPromo = null,
}) {
  const settings = pricingSettings ?? crewSettings
  const calendarProps = settings
    ? {
        wizard,
        onWizardChange,
        breakdown,
        pricingSettings: settings,
        serviceType,
        lineItems,
        heavyItemCount,
        priceWithoutPromo,
        compact: true,
        showSelectedTotal: true,
      }
    : null

  return (
    <div data-quote-step="4" className="min-w-0 space-y-3 md:space-y-6">
      <QuoteEstimatedTotalCard
        breakdown={breakdown}
        pricingSettings={settings}
        promoCode={wizard.promoCode}
        priceWithoutPromo={priceWithoutPromo}
        className="mb-3 md:hidden"
      />

      <MobileStep4Review
        quoteRef={quoteRef}
        wizard={wizard}
        serviceType={serviceType}
        breakdown={breakdown}
        totalM3={totalM3}
        crewSettings={crewSettings}
        onDistanceFromRoute={onDistanceFromRoute}
        calendarProps={calendarProps}
      />

      <div className="min-w-0 max-w-full space-y-4 md:hidden">
        <Step4BackNav onBack={onBack} className="border-t-0 pt-0" />
        <div id="quote-wizard-payment" className="scroll-mt-20 pb-1">
          <QuotePaymentSection
            wizard={wizard}
            breakdown={breakdown}
            pricingSettings={settings}
            priceWithoutPromo={priceWithoutPromo}
            payLoading={payLoading}
            payError={payError}
            cardPayment={cardPayment}
            onClearCardPayment={onClearCardPayment}
            onPay={onPay}
            reservationFeeGbp={reservationFeeGbp}
            onPaymentSucceeded={onPaymentSucceeded}
          />
        </div>
      </div>

      <DesktopStep4Review onGoToStep={onGoToStep} calendarProps={calendarProps} />

      <div className="hidden space-y-6 md:block">
        <Step4BackNav onBack={onBack} />
        <div id="quote-wizard-payment" className="scroll-mt-24">
          <QuotePaymentSection
            wizard={wizard}
            breakdown={breakdown}
            pricingSettings={settings}
            priceWithoutPromo={priceWithoutPromo}
            reservationFeeGbp={reservationFeeGbp}
            payLoading={payLoading}
            payError={payError}
            cardPayment={cardPayment}
            onClearCardPayment={onClearCardPayment}
            onPay={onPay}
            onPaymentSucceeded={onPaymentSucceeded}
          />
        </div>
      </div>
    </div>
  )
}
