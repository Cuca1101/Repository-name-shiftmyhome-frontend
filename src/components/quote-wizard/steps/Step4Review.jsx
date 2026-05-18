import MobileStep4Review from '../MobileStep4Review'
import DesktopStep4Review from '../DesktopStep4Review'
import QuotePaymentSection from '../QuotePaymentSection'

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

      <div className="md:hidden">
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

      <div className="hidden md:block">
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
