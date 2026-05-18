import { QuoteWizardProvider, useQuoteWizard } from './QuoteWizardContext'
import { SERVICE_TYPES } from '../../constants/serviceTypes'
import { generateQuotePdf } from '../../utils/generateQuotePdf'
import WizardProgress from './WizardProgress'
import MoveSummary from './MoveSummary'
import Step1Address from './steps/Step1Address'
import Step2Inventory from './steps/Step2Inventory'
import Step3Details from './steps/Step3Details'
import Step4Review from './steps/Step4Review'
import MobileQuoteStickyActions from '../mobile/MobileQuoteStickyActions'

function step1ArrivalErrorMessage(feedback) {
  if (feedback.type !== 'error' || !feedback.text) return ''
  return /flexible from and until|exact arrival time|preferred arrival option/i.test(feedback.text)
    ? feedback.text
    : ''
}

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

  const summaryProps = {
    quoteRef,
    step,
    wizard,
    onDistanceFromRoute: handleDistanceFromRoute,
    pickupLng: wizard.pickupLng,
    pickupLat: wizard.pickupLat,
    deliveryLng: wizard.deliveryLng,
    deliveryLat: wizard.deliveryLat,
    pickupAddress: wizard.pickupAddress,
    deliveryAddress: wizard.deliveryAddress,
    pickupPropertyType: wizard.pickupPropertyType,
    deliveryPropertyType: wizard.deliveryPropertyType,
    pickupFloor: wizard.pickupFloor,
    deliveryFloor: wizard.deliveryFloor,
    pickupLift: wizard.pickupLift,
    deliveryLift: wizard.deliveryLift,
    distanceMiles: wizard.distanceMiles,
    moveDate: wizard.moveDate,
    arrivalWindow: wizard.arrivalWindow,
    exactArrivalTime: wizard.exactArrivalTime,
    inventoryLines: wizard.inventoryLines,
    totalM3,
    showPricing: step >= 4,
    breakdown,
    serviceType,
    crewSettings: settings,
  }

  const stepNavButtons =
    step < 4 ? (
      <div className="mt-4 hidden flex-row flex-wrap justify-between gap-2 sm:mt-10 md:flex">
        <button
          type="button"
          onClick={back}
          disabled={step === 1}
          className="min-h-[52px] rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-40"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={next}
          className="min-h-[52px] rounded-xl bg-gradient-to-r from-brand-600 to-emerald-600 px-8 py-3 text-sm font-bold text-white shadow-md transition hover:from-brand-700 hover:to-emerald-700"
        >
          Continue →
        </button>
      </div>
    ) : null

  const stepPanel = (
    <>
      {step === 1 && (
        <Step1Address
          data={wizard}
          onChange={setWizard}
          quoteRef={quoteRef}
          serviceType={serviceType}
          serviceTypeOptions={serviceTypeOptions}
          onServiceTypeChange={allowServiceChange ? setServiceType : undefined}
          arrivalError={step1ArrivalErrorMessage(feedback)}
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
          quoteRef={quoteRef}
          onGoToStep={goToStep}
          validationMessage={
            step === 2 && feedback.type === 'error' && feedback.text ? feedback.text : ''
          }
        />
      )}
      {step === 3 && (
        <Step3Details
          data={wizard}
          onChange={setWizard}
          fileInputRef={fileInputRef}
          quoteRef={quoteRef}
          validationMessage={
            step === 3 && feedback.type === 'error' && feedback.text ? feedback.text : ''
          }
        />
      )}
      {step === 4 && (
        <Step4Review
          serviceType={serviceType}
          quoteRef={quoteRef}
          wizard={wizard}
          breakdown={breakdown}
          totalM3={totalM3}
          crewSettings={settings}
          onDistanceFromRoute={handleDistanceFromRoute}
          submitting={submitting}
          payLoading={payLoading}
          payError={payError}
          cardPayment={cardPayment}
          onClearCardPayment={clearCardPayment}
          onPay={handlePay}
          onGoToStep={goToStep}
        />
      )}
      {stepNavButtons}
    </>
  )

  return (
    <section
      id="quote"
      className={
        compact
          ? 'quote-wizard-section scroll-mt-20 bg-slate-50 py-3 md:py-5'
          : 'quote-wizard-section scroll-mt-24 border-t border-slate-200 bg-slate-50 py-4 md:border-t md:py-14'
      }
    >
      <div className="mx-auto min-w-0 w-full max-w-6xl px-3 md:px-6 lg:px-8">
        <div id="quote-wizard-top">
          <WizardProgress step={step} />
        </div>

        {feedback.text && (
          <div
            role="alert"
            className={`mb-4 rounded-xl border px-4 py-3 text-sm md:mb-6 ${
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
          <div className="mb-4 flex flex-col items-center gap-2 sm:mb-6 sm:flex-row sm:justify-center">
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
          <>
            {/* Mobile: steps → open summary (map + details) → in-flow nav */}
            <div className="block space-y-3 md:hidden">
              <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-card">{stepPanel}</div>
              {step !== 4 ? <MoveSummary {...summaryProps} /> : null}
              <MobileQuoteStickyActions step={step} onBack={back} onNext={next} />
            </div>

            {/* Desktop: two-column steps 1–3; single column review on step 4 */}
            <div
              className={
                step === 4
                  ? 'hidden md:block md:max-w-3xl'
                  : 'hidden items-start gap-4 md:grid md:grid-cols-[minmax(0,1fr)_minmax(200px,34%)] lg:grid-cols-[minmax(0,1fr)_minmax(260px,min(100%,360px))] lg:gap-10'
              }
            >
              <div className="min-w-0">
                <div
                  className={`min-w-0 rounded-2xl border border-slate-200 bg-white shadow-card ${
                    step === 4 ? 'p-6 lg:p-8' : 'p-8'
                  }`}
                >
                  {stepPanel}
                </div>
              </div>
              {step !== 4 ? <MoveSummary {...summaryProps} /> : null}
            </div>
          </>
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
