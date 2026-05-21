import MobileStep4Review from '../MobileStep4Review'
import DesktopStep4Review from '../DesktopStep4Review'
import QuoteEstimatedTotalCard from '../QuoteEstimatedTotalCard'
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
  onPaymentSucceeded,
  onGoToStep,
  onBack,
  depositAmountGbp = 50,
}) {
  return (
    <>
      <QuoteEstimatedTotalCard breakdown={breakdown} className="mb-3 md:hidden" />

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
          depositAmountGbp={depositAmountGbp}
          payLoading={payLoading}
          payError={payError}
          cardPayment={cardPayment}
          onClearCardPayment={onClearCardPayment}
          onPay={onPay}
          onPaymentSucceeded={onPaymentSucceeded}
        />
      </div>

      <DesktopStep4Review breakdown={breakdown} onGoToStep={onGoToStep} />

      <div className="hidden space-y-6 md:block">
        <Step4BackNav onBack={onBack} />
        <QuotePaymentSection
          wizard={wizard}
          breakdown={breakdown}
          depositAmountGbp={depositAmountGbp}
          payLoading={payLoading}
          payError={payError}
          cardPayment={cardPayment}
          onClearCardPayment={onClearCardPayment}
          onPay={onPay}
          onPaymentSucceeded={onPaymentSucceeded}
        />
      </div>
    </>
  )
}
