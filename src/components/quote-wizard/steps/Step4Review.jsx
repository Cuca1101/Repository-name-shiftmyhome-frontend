import MobileStep4Review from '../MobileStep4Review'
import DesktopStep4Review from '../DesktopStep4Review'
import QuotePaymentSection from '../QuotePaymentSection'
import Step4BackNav from '../Step4BackNav'

export default function Step4Review({
  serviceType,
  quoteRef,
  wizard,
  breakdown,
  totalM3,
  crewSettings,
  onDistanceFromRoute,
  payLoading,
  payError,
  cardPayment,
  onClearCardPayment,
  onPay,
  onGoToStep,
  onBack,
}) {
  return (
    <>
      <MobileStep4Review
        quoteRef={quoteRef}
        wizard={wizard}
        serviceType={serviceType}
        breakdown={breakdown}
        totalM3={totalM3}
        crewSettings={crewSettings}
        onDistanceFromRoute={onDistanceFromRoute}
      />

      <div className="space-y-4 md:hidden">
        <Step4BackNav onBack={onBack} className="border-t-0 pt-0" />
        <QuotePaymentSection
          wizard={wizard}
          breakdown={breakdown}
          payLoading={payLoading}
          payError={payError}
          cardPayment={cardPayment}
          onClearCardPayment={onClearCardPayment}
          onPay={onPay}
        />
      </div>

      <DesktopStep4Review
        quoteRef={quoteRef}
        wizard={wizard}
        serviceType={serviceType}
        breakdown={breakdown}
        totalM3={totalM3}
        crewSettings={crewSettings}
        onDistanceFromRoute={onDistanceFromRoute}
        onGoToStep={onGoToStep}
      />

      <div className="hidden space-y-6 md:block">
        <Step4BackNav onBack={onBack} />
        <QuotePaymentSection
          wizard={wizard}
          breakdown={breakdown}
          payLoading={payLoading}
          payError={payError}
          cardPayment={cardPayment}
          onClearCardPayment={onClearCardPayment}
          onPay={onPay}
        />
      </div>
    </>
  )
}
