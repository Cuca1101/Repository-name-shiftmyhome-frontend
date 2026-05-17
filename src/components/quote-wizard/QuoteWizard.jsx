import { QuoteWizardProvider, useQuoteWizard } from './QuoteWizardContext'
import { SERVICE_TYPES } from '../../constants/serviceTypes'
import { generateQuotePdf } from '../../utils/generateQuotePdf'
import WizardProgress from './WizardProgress'
import MoveSummary from './MoveSummary'
import Step1Address from './steps/Step1Address'
import Step2Inventory from './steps/Step2Inventory'
import Step3Details from './steps/Step3Details'
import Step4Review from './steps/Step4Review'

function QuoteWizardInner({ compact = false }) {
  const {
    step,
    quoteRef,
    wizard,
    setWizard,
    serviceType,
    setServiceType,
    allowServiceChange,
    settings,
    loadingSettings,
    submitting,
    payLoading,
    payError,
    cardPayment,
    clearCardPayment,
    feedback,
    lastQuoteData,
    setFeedback,
    fileInputRef,
    totalM3,
    breakdown,
    customSizeM3,
    handleDistanceFromRoute,
    back,
    next,
    goToStep,
    handleSubmit,
    handlePay,
  } = useQuoteWizard()

  const serviceTypeOptions = allowServiceChange ? [...SERVICE_TYPES] : undefined

  return (
    <section
      id="quote"
      className={
        compact
          ? 'scroll-mt-20 bg-slate-50 py-3 xxs:py-4 sm:py-5'
          : 'scroll-mt-24 border-t border-slate-200 bg-slate-50 py-4 xxs:py-5 sm:py-14'
      }
    >
      <div className="mx-auto min-w-0 w-full max-w-6xl px-2.5 xxs:px-3 xs:px-4 sm:px-6 lg:px-8">
        <div id="quote-wizard-top">
          <WizardProgress step={step} />
        </div>

        {feedback.text && (
          <div
            role="alert"
            className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
              feedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : feedback.type === 'warning'
                  ? 'border-amber-200 bg-amber-50 text-amber-950'
                  : 'border-red-200 bg-red-50 text-red-900'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {lastQuoteData && (
          <div className="mb-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => {
                if (!lastQuoteData) return
                void generateQuotePdf(lastQuoteData).catch((err) => {
                  console.error(err)
                  setFeedback({
                    type: 'error',
                    text:
                      'Could not generate the PDF. Please try again, or save a screenshot of your confirmation.',
                  })
                })
              }}
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand-600 px-8 py-3 text-sm font-bold text-white shadow-md transition hover:bg-brand-700"
            >
              Download Quote PDF
            </button>
          </div>
        )}

        {loadingSettings ? (
          <p className="text-center text-slate-600">Loading…</p>
        ) : (
          <div className="grid quote-wizard-layout grid-cols-[minmax(0,1fr)_minmax(0,24%)] items-start gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(200px,34%)] sm:gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,min(100%,360px))] lg:gap-10">
            <div className="min-w-0">
              <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-2 shadow-card xxs:rounded-2xl xxs:p-2.5 xs:p-3 sm:p-8">
                {step === 1 && (
                  <Step1Address
                    data={wizard}
                    onChange={setWizard}
                    serviceType={serviceType}
                    serviceTypeOptions={serviceTypeOptions}
                    onServiceTypeChange={allowServiceChange ? setServiceType : undefined}
                  />
                )}
                {step === 2 && (
                  <Step2Inventory
                    lines={wizard.inventoryLines}
                    onLinesChange={(inventoryLines) => setWizard((w) => ({ ...w, inventoryLines }))}
                    customSizeM3={customSizeM3}
                    crewSize={wizard.crewSize}
                    onCrewSizeChange={(crewSize) => setWizard((w) => ({ ...w, crewSize }))}
                    crewSettings={settings}
                  />
                )}
                {step === 3 && (
                  <Step3Details data={wizard} onChange={setWizard} fileInputRef={fileInputRef} />
                )}
                {step === 4 && (
                  <Step4Review
                    serviceType={serviceType}
                    quoteRef={quoteRef}
                    wizard={wizard}
                    breakdown={breakdown}
                    submitting={submitting}
                    payLoading={payLoading}
                    payError={payError}
                    cardPayment={cardPayment}
                    onClearCardPayment={clearCardPayment}
                    onSubmit={handleSubmit}
                    onPay={handlePay}
                    onGoToStep={goToStep}
                  />
                )}

                {step < 4 && (
                  <div className="mt-4 flex flex-row flex-wrap justify-between gap-2 xxs:mt-5 sm:mt-10">
                    <button
                      type="button"
                      onClick={back}
                      disabled={step === 1}
                      className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-40 xxs:min-h-[42px] xxs:px-4 xxs:text-sm sm:min-h-[52px] sm:rounded-xl sm:px-6 sm:py-3"
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      onClick={next}
                      className="min-h-[40px] rounded-lg bg-gradient-to-r from-brand-600 to-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md transition hover:from-brand-700 hover:to-emerald-700 xxs:min-h-[42px] xxs:px-5 xxs:text-sm sm:min-h-[52px] sm:rounded-xl sm:px-8 sm:py-3"
                    >
                      Continue →
                    </button>
                  </div>
                )}
              </div>
            </div>

            <MoveSummary
              quoteRef={quoteRef}
              step={step}
              wizard={wizard}
              onDistanceFromRoute={handleDistanceFromRoute}
              pickupLng={wizard.pickupLng}
              pickupLat={wizard.pickupLat}
              deliveryLng={wizard.deliveryLng}
              deliveryLat={wizard.deliveryLat}
              pickupAddress={wizard.pickupAddress}
              deliveryAddress={wizard.deliveryAddress}
              pickupPropertyType={wizard.pickupPropertyType}
              deliveryPropertyType={wizard.deliveryPropertyType}
              pickupFloor={wizard.pickupFloor}
              deliveryFloor={wizard.deliveryFloor}
              pickupLift={wizard.pickupLift}
              deliveryLift={wizard.deliveryLift}
              distanceMiles={wizard.distanceMiles}
              moveDate={wizard.moveDate}
              arrivalWindow={wizard.arrivalWindow}
              exactArrivalTime={wizard.exactArrivalTime}
              inventoryLines={wizard.inventoryLines}
              totalM3={totalM3}
              showPricing={step >= 4}
              breakdown={breakdown}
              serviceType={serviceType}
            />
          </div>
        )}
      </div>
    </section>
  )
}

/**
 * @param {{ serviceType: string, allowServiceChange?: boolean, compact?: boolean }} props
 */
export default function QuoteWizard({ serviceType, allowServiceChange = false, compact = false }) {
  return (
    <QuoteWizardProvider serviceType={serviceType} allowServiceChange={allowServiceChange}>
      <QuoteWizardInner compact={compact} />
    </QuoteWizardProvider>
  )
}
