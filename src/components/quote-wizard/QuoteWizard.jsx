import { useLayoutEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { QuoteWizardProvider, useQuoteWizard } from './QuoteWizardContext'
import { SERVICE_TYPES } from '../../constants/serviceTypes'
import { generateQuotePdf } from '../../utils/generateQuotePdf'
import WizardProgress from './WizardProgress'
import MoveSummary from './MoveSummary'
import QuoteReviewYourMoveCard from './QuoteReviewYourMoveCard'
import Step1Address from './steps/Step1Address'
import Step2Inventory from './steps/Step2Inventory'
import Step3ReviewLayout from './Step3ReviewLayout'
import Step4Review from './steps/Step4Review'
import MobileQuoteStickyActions from '../mobile/MobileQuoteStickyActions'
import QuoteStep2TransitionLoading from './QuoteStep2TransitionLoading'
import useMobileQuoteLayout from '../../hooks/useMobileQuoteLayout'
import { reviewDetailsReady } from '../../lib/quoteWizardContactFields'
import { QuoteFlowHelp } from '../WhatsAppButton'

const PAGE_STEP_LINE = {
  1: 'Step 1 of 4 · Address & access',
  2: 'Step 2 of 4 · Items & contact',
  3: 'Step 3 of 4 · Review',
  4: 'Step 4 of 4 · Pay',
}

function step1ArrivalErrorMessage(feedback) {
  if (feedback.type !== 'error' || !feedback.text) return ''
  return /flexible from and until|exact arrival time|preferred arrival option/i.test(feedback.text)
    ? feedback.text
    : ''
}

function QuoteWizardInner({
  compact = false,
  servicePreSelected = false,
  pageChrome = false,
  titleTag = 'h1',
  titleId,
  showStep1Back = true,
}) {
  const sidebarAlignRef = useRef(null)
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
    totalM3,
    breakdown,
    priceWithoutPromo,
    lineItems,
    heavyItemCount,
    crewRestrictions,
    depositAmountGbp,
    customSizeM3,
    handleDistanceFromRoute,
    quoteStepTransitionLoading,
    back,
    next,
    goToStep,
    handleSubmit,
    handlePay,
    uploadCustomerPhotosAfterPayment,
  } = useQuoteWizard()

  const isMobileLayout = useMobileQuoteLayout()
  const navigate = useNavigate()
  const serviceTypeOptions = allowServiceChange ? [...SERVICE_TYPES] : undefined

  useLayoutEffect(() => {
    const side = sidebarAlignRef.current
    if (!pageChrome || (step !== 1 && step !== 2) || !side) {
      if (side) side.style.paddingTop = ''
      return undefined
    }

    const alignSidebarToForm = () => {
      const el = sidebarAlignRef.current
      if (!el) return
      el.style.paddingTop = '0px'
      if (window.matchMedia('(max-width: 767px)').matches) return
      const anchorSelector =
        step === 2 ? '[data-quote-field="crew-size"]' : '[data-quote-step="1"]'
      const anchor = [...document.querySelectorAll(anchorSelector)].find((node) => {
        const style = window.getComputedStyle(node)
        return style.display !== 'none' && style.visibility !== 'hidden' && node.getBoundingClientRect().height > 0
      })
      if (!anchor) return
      const delta = Math.round(anchor.getBoundingClientRect().top - el.getBoundingClientRect().top)
      if (delta > 0) el.style.paddingTop = `${delta}px`
    }

    alignSidebarToForm()
    const timer = window.setTimeout(alignSidebarToForm, 50)
    window.addEventListener('resize', alignSidebarToForm)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('resize', alignSidebarToForm)
      if (sidebarAlignRef.current) sidebarAlignRef.current.style.paddingTop = ''
    }
  }, [pageChrome, step, wizard.crewSize, loadingSettings])

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
    onInventoryLinesChange: (inventoryLines) =>
      setWizard((w) => ({ ...w, inventoryLines })),
    totalM3,
    showPricing: step >= 2,
    breakdown,
    serviceType,
    crewSettings: settings,
    pricingSettings: settings,
    promoCode: wizard.promoCode,
    priceWithoutPromo,
    crewRestrictions,
    reviewSticky:
      step === 3
        ? {
            wizard,
            breakdown,
            pricingSettings: settings,
            serviceType,
            lineItems,
            heavyItemCount,
            priceWithoutPromo,
            onContinueToPayment: next,
            placement: 'aboveReference',
          }
        : null,
  }

  const stepNavButtons =
    pageChrome && step < 4 ? (
      <div className="mt-4 pb-20 sm:pb-0">
        <div className="flex items-stretch gap-6 sm:gap-8">
          {step > 1 || showStep1Back ? (
            <button
              type="button"
              onClick={() => (step > 1 ? back() : navigate(-1))}
              className="inline-flex min-h-[52px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 sm:min-w-[7.5rem] sm:px-6"
            >
              <span aria-hidden>←</span>
              Back
            </button>
          ) : null}
          <button
            type="button"
            onClick={next}
            disabled={quoteStepTransitionLoading || (step === 3 && !reviewDetailsReady(wizard))}
            className="flex min-h-[52px] min-w-0 flex-1 items-center justify-center rounded-xl bg-blue-600 px-5 text-base font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:px-6"
          >
            {quoteStepTransitionLoading && step === 2
              ? 'Finding your price…'
              : step === 3
                ? 'Continue to payment →'
                : step === 2
                  ? 'Get a quote'
                  : 'Continue →'}
          </button>
        </div>
        <QuoteFlowHelp className="mt-4" />
      </div>
    ) : pageChrome && step === 4 ? (
      <div className="mt-4 pb-20 sm:pb-0">
        <button
          type="button"
          onClick={back}
          className="inline-flex min-h-[52px] w-full items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 sm:w-auto"
        >
          <span aria-hidden>←</span>
          Back
        </button>
        <QuoteFlowHelp className="mt-4" />
      </div>
    ) : step === 4 ? (
      <div className="mt-6 hidden border-t border-slate-200 pt-6 md:flex md:justify-start">
        <button
          type="button"
          onClick={back}
          className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
        >
          <span aria-hidden>←</span>
          Back
        </button>
      </div>
    ) : step === 3 ? (
      <div className="mt-4 hidden md:block">
        <button
          type="button"
          onClick={back}
          className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          <span aria-hidden>←</span>
          Back to items
        </button>
      </div>
    ) : step < 4 ? (
      <div className="mt-4 hidden flex-row flex-wrap justify-between gap-6 sm:mt-10 sm:gap-8 md:flex">
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
          disabled={quoteStepTransitionLoading}
          className="min-h-[52px] rounded-xl bg-gradient-to-r from-brand-600 to-emerald-600 px-8 py-3 text-sm font-bold text-white shadow-md transition hover:from-brand-700 hover:to-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {quoteStepTransitionLoading && step === 2
            ? 'Finding your price…'
            : step === 2
              ? 'Get a quote'
              : 'Continue →'}
        </button>
      </div>
    ) : null

  const stepPanelBody = (
    <>
      {step === 1 && (
        <Step1Address
          data={wizard}
          onChange={setWizard}
          quoteRef={quoteRef}
          serviceType={serviceType}
          serviceTypeOptions={serviceTypeOptions}
          onServiceTypeChange={allowServiceChange ? setServiceType : undefined}
          servicePreSelected={servicePreSelected}
          arrivalError={step1ArrivalErrorMessage(feedback)}
          customerAddressCards
          quotePage={pageChrome}
        />
      )}
      {step === 2 && (
        <>
          <Step2Inventory
            lines={wizard.inventoryLines}
            onLinesChange={(inventoryLines) => setWizard((w) => ({ ...w, inventoryLines }))}
            customSizeM3={customSizeM3}
            crewSize={wizard.crewSize}
            onCrewSizeChange={(crewSize) => setWizard((w) => ({ ...w, crewSize }))}
            crewSettings={settings}
            crewRestrictions={crewRestrictions}
            quoteRef={quoteRef}
            quotePage={pageChrome}
            data={wizard}
            onChange={setWizard}
            pricingSettings={settings}
            breakdown={breakdown}
            priceWithoutPromo={priceWithoutPromo}
            contactValidationMessage={
              step === 2 &&
              feedback.type === 'error' &&
              feedback.text &&
              /full name|phone|email|contact detail/i.test(feedback.text)
                ? feedback.text
                : ''
            }
            validationMessage={
              step === 2 &&
              feedback.type === 'error' &&
              feedback.text &&
              !/full name|phone|email|contact detail/i.test(feedback.text)
                ? feedback.text
                : ''
            }
          />
        </>
      )}
      {step === 3 && (
        <Step3ReviewLayout
          quoteRef={quoteRef}
          wizard={wizard}
          onWizardChange={setWizard}
          breakdown={breakdown}
          serviceType={serviceType}
          settings={settings}
          lineItems={lineItems}
          heavyItemCount={heavyItemCount}
          priceWithoutPromo={priceWithoutPromo}
          onGoToStep={goToStep}
          totalM3={totalM3}
          onContinueToPayment={next}
          embedSummary={pageChrome}
        />
      )}
      {step === 4 && (
        <Step4Review
          serviceType={serviceType}
          quoteRef={quoteRef}
          wizard={wizard}
          onWizardChange={setWizard}
          breakdown={breakdown}
          totalM3={totalM3}
          crewSettings={settings}
          pricingSettings={settings}
          lineItems={lineItems}
          heavyItemCount={heavyItemCount}
          onGoToStep={goToStep}
          onDistanceFromRoute={handleDistanceFromRoute}
          payLoading={payLoading}
          payError={payError}
          cardPayment={cardPayment}
          onClearCardPayment={clearCardPayment}
          onPay={handlePay}
          reservationFeeGbp={depositAmountGbp}
          onPaymentSucceeded={uploadCustomerPhotosAfterPayment}
          onBack={back}
          priceWithoutPromo={priceWithoutPromo}
          quotePage={pageChrome}
        />
      )}
    </>
  )

  const stepPanel = (
    <>
      <div className="relative min-w-0">{stepPanelBody}</div>
      {stepNavButtons}
    </>
  )

  return (
    <section
      id="quote"
      className={
        pageChrome
          ? 'quote-flow-scope quote-wizard-section scroll-mt-24 bg-transparent py-0'
          : compact
            ? 'quote-flow-scope quote-wizard-section quote-wizard-section--embedded scroll-mt-20 py-1.5 md:py-5'
            : 'quote-flow-scope quote-wizard-section scroll-mt-24 border-t border-slate-200 bg-slate-50 py-1.5 md:border-t md:py-14'
      }
    >
      {quoteStepTransitionLoading && step === 2 ? <QuoteStep2TransitionLoading /> : null}
      <div className={`mx-auto box-border min-w-0 w-full max-w-6xl ${pageChrome ? 'px-0' : 'px-2 md:px-6 lg:px-8'}`}>
        {pageChrome ? null : (
          <div id="quote-wizard-top">
            <WizardProgress step={step} />
          </div>
        )}

        {feedback.text && (
          <div
            role="alert"
            data-quote-wizard-feedback="true"
            data-quote-error={feedback.type === 'error' ? 'true' : undefined}
            className={`quote-error mb-2 rounded-lg border px-3 py-2 text-xs leading-snug md:mb-6 md:rounded-xl md:px-4 md:py-3 md:text-sm ${
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
        ) : pageChrome ? (
          <div
            className={`mx-auto grid w-full max-w-6xl items-start gap-4 ${
              step === 3
                ? 'md:grid-cols-[minmax(0,1fr)_minmax(260px,32%)] md:gap-6'
                : 'md:grid-cols-[minmax(0,1fr)_minmax(260px,34%)] lg:grid-cols-[minmax(0,1fr)_minmax(300px,min(100%,380px))] lg:gap-6'
            }`}
          >
            <div className="quote-wizard-form-card min-w-0 md:col-start-1 md:row-start-1">
              {step > 1 || showStep1Back ? (
                <button
                  type="button"
                  onClick={() => (step > 1 ? back() : navigate(-1))}
                  className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900"
                >
                  <span aria-hidden>←</span>
                  Back
                </button>
              ) : null}
              {titleTag === 'h2' ? (
                <h2 id={titleId} className="text-[1.7rem] font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                  Get your instant quote
                </h2>
              ) : (
                <h1 id={titleId} className="text-[1.7rem] font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                  Get your instant quote
                </h1>
              )}
              <p className="mt-1 text-sm leading-snug text-slate-500">
                Your price is shown at the review step.
              </p>
              <div id="quote-wizard-top" className="mt-4">
                <WizardProgress step={step} variant="page" />
              </div>
              <p className="mb-3 text-sm text-slate-500">{PAGE_STEP_LINE[step]}</p>
              <div className="relative min-w-0">{stepPanelBody}</div>
            </div>
            {step === 3 ? (
              <div className="hidden min-w-0 md:col-start-2 md:row-start-1 md:row-span-2 md:block">
                <MoveSummary
                  {...summaryProps}
                  afterMap={
                    <QuoteReviewYourMoveCard
                      quoteRef={quoteRef}
                      wizard={wizard}
                      breakdown={breakdown}
                      pricingSettings={settings}
                      totalM3={totalM3}
                      priceWithoutPromo={priceWithoutPromo}
                      onContinueToPayment={next}
                      continueDisabled={!reviewDetailsReady(wizard)}
                      showReference={false}
                      showMap={false}
                      hideContinue
                    />
                  }
                />
              </div>
            ) : (
              <div ref={sidebarAlignRef} className="md:col-start-2 md:row-start-1 md:row-span-2">
                <MoveSummary {...summaryProps} />
              </div>
            )}
            <div className="md:col-start-1 md:row-start-2">{stepNavButtons}</div>
          </div>
        ) : isMobileLayout ? (
          <div className="quote-wizard-mobile-stack block min-w-0 max-w-full space-y-1.5">
            <div
              className={`quote-wizard-form-card box-border min-w-0 w-full max-w-full rounded-xl border border-slate-200 bg-white p-2 shadow-card${compact ? ' quote-wizard-card' : ''}`}
            >
              {stepPanel}
            </div>
            {step === 3 ? null : <MoveSummary {...summaryProps} />}
            <MobileQuoteStickyActions
              step={step}
              onBack={back}
              onNext={next}
              nextDisabled={quoteStepTransitionLoading || (step === 3 && !reviewDetailsReady(wizard))}
              nextLoading={quoteStepTransitionLoading && step === 2}
            />
          </div>
        ) : (
          <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,34%)] lg:grid-cols-[minmax(0,1fr)_minmax(260px,min(100%,340px))] lg:gap-6">
            <div className="min-w-0">
              <div
                className={`quote-wizard-form-card min-w-0 rounded-2xl border border-slate-200 bg-white shadow-card ${
                  step === 3 || step === 4 ? 'p-4 lg:p-6' : 'p-8'
                } ${compact ? 'quote-wizard-card ' : ''}`}
              >
                {stepPanel}
              </div>
            </div>
            {step === 3 ? (
              <div className="hidden min-w-0 md:block">
                <MoveSummary
                  {...summaryProps}
                  afterMap={
                    <QuoteReviewYourMoveCard
                      quoteRef={quoteRef}
                      wizard={wizard}
                      breakdown={breakdown}
                      pricingSettings={settings}
                      totalM3={totalM3}
                      priceWithoutPromo={priceWithoutPromo}
                      onContinueToPayment={next}
                      continueDisabled={!reviewDetailsReady(wizard)}
                      showReference={false}
                      showMap={false}
                    />
                  }
                />
              </div>
            ) : (
              <MoveSummary {...summaryProps} />
            )}
          </div>
        )}
      </div>
    </section>
  )
}

/**
 * @param {{ serviceType: string, allowServiceChange?: boolean, servicePreSelected?: boolean, compact?: boolean, pageChrome?: boolean, titleTag?: 'h1' | 'h2', titleId?: string, showStep1Back?: boolean }} props
 */
export default function QuoteWizard({
  serviceType,
  allowServiceChange = false,
  servicePreSelected = false,
  compact = false,
  pageChrome = false,
  titleTag = 'h1',
  titleId,
  showStep1Back = true,
}) {
  return (
    <QuoteWizardProvider serviceType={serviceType} allowServiceChange={allowServiceChange}>
      <QuoteWizardInner
        compact={compact}
        servicePreSelected={servicePreSelected}
        pageChrome={pageChrome}
        titleTag={titleTag}
        titleId={titleId}
        showStep1Back={showStep1Back}
      />
    </QuoteWizardProvider>
  )
}
