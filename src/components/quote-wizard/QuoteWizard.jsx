import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CreditCard, Lock, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { QuoteWizardProvider, useQuoteWizard, initialWizardState, makeQuoteRef } from './QuoteWizardContext'
import AdminPhoneBookingFinish from '../admin/AdminPhoneBookingFinish'
import {
  clearAdminPhoneBookingDraft,
  loadAdminPhoneBookingDraft,
  saveAdminPhoneBookingDraft,
} from '../../lib/adminPhoneBookingDraftStorage'
import { fetchAdminPhoneBookingForEdit } from '../../lib/adminPhoneBooking'
import { SERVICE_TYPES } from '../../constants/serviceTypes'
import { generateQuotePdf } from '../../utils/generateQuotePdf'
import WizardProgress from './WizardProgress'
import MoveSummary from './MoveSummary'
import QuoteReviewYourMoveCard from './QuoteReviewYourMoveCard'
import QuoteReviewMapInventory from './QuoteReviewMapInventory'
import { QuoteReviewSelectedSlot } from './QuoteReviewStickyPanel'
import QuoteEstimatedTotalStrip from './QuoteEstimatedTotalStrip'
import Step1Address from './steps/Step1Address'
import Step2Inventory from './steps/Step2Inventory'
import Step2Continuation, { Step2ContactCard, Step2Extras } from './Step2Continuation'
import Step3ReviewLayout from './Step3ReviewLayout'
import Step4Review from './steps/Step4Review'
import MobileQuoteStickyActions from '../mobile/MobileQuoteStickyActions'
import QuoteStep2TransitionLoading from './QuoteStep2TransitionLoading'
import useMobileQuoteLayout, { QUOTE_MOBILE_LAYOUT_MQ, useFromTabletQuoteLayout, useTabletQuoteLayout } from '../../hooks/useMobileQuoteLayout'
import { reviewDetailsReady } from '../../lib/quoteWizardContactFields'
import { QuoteFlowHelp } from '../WhatsAppButton'

function QuoteStep2TrustRow() {
  return (
    <ul className="mt-3 flex items-center justify-between gap-2 px-1 text-[11px] font-semibold leading-tight text-slate-600">
      <li className="inline-flex min-w-0 items-center gap-1.5"><ShieldCheck className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />Insured</li>
      <li className="inline-flex min-w-0 items-center gap-1.5"><Lock className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />Secure payment</li>
      <li className="inline-flex min-w-0 items-center gap-1.5"><CreditCard className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />No hidden fees</li>
    </ul>
  )
}

const PAGE_STEP_LINE = {
  1: 'Step 1 of 4 · Address & access',
  2: 'Step 2 of 4 · Items & contact',
  3: 'Step 3 of 4 · Review',
  4: 'Step 4 of 4 · Payment',
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
  adminPhoneBooking = null,
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
    setQuoteRef,
    setStep,
  } = useQuoteWizard()

  const isAdmin = Boolean(adminPhoneBooking)
  const editQuoteId = adminPhoneBooking?.editQuoteId || null
  const [savedQuoteId, setSavedQuoteId] = useState(null)
  const [editReady, setEditReady] = useState(!editQuoteId)
  const [editError, setEditError] = useState('')
  const [adminNotice, setAdminNotice] = useState('')
  const [priceMode, setPriceMode] = useState(() => {
    if (!isAdmin || editQuoteId) {
      return { useCalculatedPrice: true, finalPriceOverride: '', overrideReason: '', adminNote: '' }
    }
    const draft = loadAdminPhoneBookingDraft()
    return {
      useCalculatedPrice: draft?.useCalculatedPrice !== false,
      finalPriceOverride: draft?.finalPriceOverride || '',
      overrideReason: draft?.overrideReason || '',
      adminNote: draft?.adminNote || '',
    }
  })

  const isMobileLayout = useMobileQuoteLayout()
  const isTabletLayout = useTabletQuoteLayout()
  const fromTablet = useFromTabletQuoteLayout()
  const step2MatchTablet = step === 2 && pageChrome && !isAdmin
  const step2Columns = step === 2 && fromTablet && (isTabletLayout || step2MatchTablet)
  const navigate = useNavigate()
  const serviceTypeOptions = allowServiceChange ? [...SERVICE_TYPES] : undefined

  useEffect(() => {
    if (!isAdmin || editQuoteId) return undefined
    saveAdminPhoneBookingDraft({
      step,
      wizard,
      serviceType,
      quoteRef,
      customQuoteRef: '',
      useCalculatedPrice: priceMode.useCalculatedPrice,
      finalPriceOverride: priceMode.finalPriceOverride,
      overrideReason: priceMode.overrideReason,
      adminNote: priceMode.adminNote,
    })
    return undefined
  }, [isAdmin, editQuoteId, step, wizard, serviceType, quoteRef, priceMode])

  useEffect(() => {
    if (!editQuoteId) {
      setEditReady(true)
      return undefined
    }
    if (savedQuoteId === editQuoteId) {
      setEditReady(true)
      return undefined
    }
    let cancelled = false
    setEditReady(false)
    setEditError('')
    fetchAdminPhoneBookingForEdit(editQuoteId)
      .then((loaded) => {
        if (cancelled || !loaded) return
        setWizard(loaded.wizard)
        setServiceType(loaded.serviceType || serviceType)
        setQuoteRef(loaded.quoteRef || quoteRef)
        setStep(loaded.step || 4)
        setSavedQuoteId(loaded.id)
        setPriceMode({
          useCalculatedPrice: loaded.useCalculatedPrice !== false,
          finalPriceOverride: loaded.finalPriceOverride || '',
          overrideReason: loaded.overrideReason || '',
          adminNote: loaded.adminNote || '',
        })
        setAdminNotice(`Editing ${loaded.quote_ref}. Same quote. Save changes does not send an email.`)
        setEditReady(true)
      })
      .catch((err) => {
        if (!cancelled) setEditError(err?.message || 'Could not load this quote.')
      })
    return () => {
      cancelled = true
    }
  }, [editQuoteId, savedQuoteId, setFeedback, setQuoteRef, setServiceType, setStep, setWizard])

  function startNewAdminBooking({ skipConfirm = false } = {}) {
    if (
      !skipConfirm &&
      !window.confirm(
        savedQuoteId
          ? 'Start a new empty phone booking? This quote stays saved.'
          : 'Clear this form and start a new phone booking?',
      )
    ) return
    clearAdminPhoneBookingDraft()
    adminPhoneBooking?.onStartNew?.()
  }

  useLayoutEffect(() => {
    const side = sidebarAlignRef.current
    if (!pageChrome || step !== 1 || !side) {
      if (side) side.style.paddingTop = ''
      return undefined
    }

    const alignSidebarToForm = () => {
      const el = sidebarAlignRef.current
      if (!el) return
      el.style.paddingTop = '0px'
      if (window.matchMedia(QUOTE_MOBILE_LAYOUT_MQ).matches) return
      const anchorSelectors =
        step === 2
          ? ['[data-quote-field="crew-size"]']
          : ['[data-quote-field="service-type"]', '[data-quote-field="pickup-address"]']
      const anchor = anchorSelectors
        .flatMap((selector) => [...document.querySelectorAll(selector)])
        .find((node) => {
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
    alwaysShowMobile: isAdmin,
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
            continueLabel: isAdmin ? 'Continue to send quote →' : 'Continue to payment →',
            placement: 'aboveReference',
          }
        : null,
  }

  const pageChromeTopBack =
    pageChrome && (step > 1 || showStep1Back) ? (
      <button
        type="button"
        onClick={() => (step > 1 ? back() : navigate('/'))}
        className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900"
      >
        <span aria-hidden>←</span>
        Back
      </button>
    ) : null

  const stepNavButtons =
    pageChrome && step === 3 ? null : pageChrome && step < 4 ? (
      <div className="mt-4">
        <div className="flex items-stretch gap-6 sm:gap-8">
          {step > 1 ? (
            <button
              type="button"
              onClick={back}
              className="inline-flex min-h-[52px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 sm:min-w-[7.5rem] sm:px-6"
            >
              <span aria-hidden>←</span>
              Back
            </button>
          ) : null}
          <button
            type="button"
            onClick={next}
            disabled={quoteStepTransitionLoading || (isAdmin && step === 3 && !reviewDetailsReady(wizard))}
            className="flex min-h-[52px] min-w-0 flex-1 items-center justify-center rounded-xl bg-blue-600 px-5 text-base font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:px-6"
          >
            {quoteStepTransitionLoading && step === 2
              ? 'Finding your price…'
              : step === 3
                ? isAdmin
                  ? 'Continue to send quote →'
                  : 'Continue to payment →'
                : step === 2
                  ? 'Get a quote ›'
                  : 'Continue →'}
          </button>
        </div>
        {step === 2 ? <QuoteStep2TrustRow /> : null}
        {isAdmin ? null : <QuoteFlowHelp className="mt-4" />}
      </div>
    ) : pageChrome && step === 4 ? (
      <div className="mt-4">
        <button
          type="button"
          onClick={back}
          className="inline-flex min-h-[52px] w-full items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 sm:w-auto"
        >
          <span aria-hidden>←</span>
          Back
        </button>
        {isAdmin ? null : <QuoteFlowHelp className="mt-4" />}
      </div>
    ) : step === 4 ? (
      <div className="mt-6 flex border-t border-slate-200 pt-6 lg:justify-start">
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
      <div className="mt-4 hidden lg:block">
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
      <div className="mt-4 hidden flex-row flex-wrap justify-between gap-6 sm:mt-10 sm:gap-8 lg:flex">
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
            matchTablet={step2MatchTablet}
            data={wizard}
            onChange={setWizard}
            pricingSettings={settings}
            breakdown={breakdown}
            priceWithoutPromo={priceWithoutPromo}
            showCustomerIdentity={isAdmin}
            showContact={false}
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
          {fromTablet ? (
            <div className="mt-4">
              <Step2Extras />
            </div>
          ) : null}
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
          onBack={back}
          embedSummary={pageChrome}
          showOffer={!isAdmin}
          continueLabel={isAdmin ? 'Continue to send quote' : 'Continue to payment'}
          continueDisabled={isAdmin && !reviewDetailsReady(wizard)}
          hideContinue={!pageChrome && isMobileLayout}
        />
      )}
      {step === 4 && isAdmin && (
        <AdminPhoneBookingFinish
          savedQuoteId={savedQuoteId}
          onSaved={(saved, { updated, closeAfter = false }) => {
            setSavedQuoteId(saved.id)
            setQuoteRef(saved.quote_ref)
            clearAdminPhoneBookingDraft()
            adminPhoneBooking?.onQuoteSaved?.(saved)
            setAdminNotice(
              updated
                ? `Quote ${saved.quote_ref} updated. No email was sent.`
                : `Quote ${saved.quote_ref} saved as a draft. No email was sent.`,
            )
            const meta = { closeAfter }
            if (updated) adminPhoneBooking?.onBookingUpdated?.(saved, meta)
            else adminPhoneBooking?.onBookingCreated?.(saved, meta)
          }}
          priceMode={priceMode}
          onPriceModeChange={setPriceMode}
          onNewBooking={startNewAdminBooking}
          notice={adminNotice}
        />
      )}
      {step === 4 && !isAdmin && (
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

  const reviewMoveCard = (
    <QuoteReviewYourMoveCard
      quoteRef={quoteRef}
      wizard={wizard}
      breakdown={breakdown}
      pricingSettings={settings}
      totalM3={totalM3}
      priceWithoutPromo={priceWithoutPromo}
      onContinueToPayment={next}
      onBack={back}
      continueDisabled={isAdmin && !reviewDetailsReady(wizard)}
      continueLabel={isAdmin ? 'Continue to send quote' : 'Continue to payment'}
      showReference={false}
      showMap={false}
      showOffer={!isAdmin}
      headingId="quote-your-move-heading-side"
    />
  )

  const step2Sidebar = <Step2Continuation columnsLayout={step2Columns} hideExtras={fromTablet} />

  const reviewLike = step === 2 || step === 3
  const chromeTitle = step === 3 ? 'Review your move' : step === 2 ? 'Choose your items' : 'Get your instant quote'
  const chromeSubtitle =
    step === 3 ? '' : step === 2 ? 'Add your items and contact details to get your quote.' : 'Your price is shown at the review step.'

  const reviewSidebar = (
    <div className="flex min-w-0 flex-col gap-4 overflow-visible">
      <QuoteReviewSelectedSlot
        wizard={wizard}
        breakdown={breakdown}
        pricingSettings={settings}
        serviceType={serviceType}
        lineItems={lineItems}
        heavyItemCount={heavyItemCount}
        priceWithoutPromo={priceWithoutPromo}
      />
      <QuoteEstimatedTotalStrip
        breakdown={breakdown}
        pricingSettings={settings}
        promoCode={wizard.promoCode}
        priceWithoutPromo={priceWithoutPromo}
        note=""
      />
      <QuoteReviewMapInventory
        wizard={wizard}
        inventoryLines={wizard.inventoryLines}
        totalM3={totalM3}
        onDistanceFromRoute={handleDistanceFromRoute}
        onInventoryLinesChange={(inventoryLines) => setWizard((current) => ({ ...current, inventoryLines }))}
        afterMap={reviewMoveCard}
      />
    </div>
  )

  return (
    <section
      id="quote"
      className={
        pageChrome
          ? `quote-flow-scope quote-wizard-section scroll-mt-24 bg-transparent py-0${step2MatchTablet ? ' quote-step2-tablet' : ''}`
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

        {loadingSettings || (isAdmin && editQuoteId && !editReady) ? (
          editError ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
              {editError}
            </p>
          ) : (
            <p className="text-center text-slate-600">{editQuoteId ? 'Loading this quote…' : 'Loading…'}</p>
          )
        ) : isMobileLayout || step2MatchTablet ? (
          <div className={`quote-wizard-mobile-stack block min-w-0 max-w-full space-y-1.5 ${reviewLike ? 'md:grid md:grid-cols-[minmax(0,1fr)_minmax(260px,340px)] md:items-start md:gap-4 md:space-y-0' : ''}`}>
            <div
              className={`quote-wizard-form-card box-border min-w-0 w-full max-w-full rounded-xl border border-slate-200 bg-white shadow-card ${reviewLike ? 'p-2 min-[420px]:p-3 sm:p-4' : 'p-2'}${compact ? ' quote-wizard-card' : ''}`}
            >
              {pageChrome ? (
                <>
                  {pageChromeTopBack}
                  {titleTag === 'h2' ? (
                    <h2 id={titleId} className={`font-extrabold tracking-tight text-slate-900 ${reviewLike ? 'text-2xl' : 'text-[1.45rem]'}`}>
                      {chromeTitle}
                    </h2>
                  ) : (
                    <h1 id={titleId} className={`font-extrabold tracking-tight text-slate-900 ${reviewLike ? 'text-2xl' : 'text-[1.45rem]'}`}>
                      {chromeTitle}
                    </h1>
                  )}
                  {chromeSubtitle ? (
                    <p className="mt-1 text-sm leading-snug text-slate-500">{chromeSubtitle}</p>
                  ) : null}
                  <div id="quote-wizard-top" className="mt-3">
                    <WizardProgress step={step} variant="page" step4ShortLabel={isAdmin ? 'Send' : undefined} capAtTablet={step2MatchTablet} />
                  </div>
                  {reviewLike && quoteRef ? (
                    <p className={`mb-3 text-center font-mono text-[11px] font-semibold tracking-wide text-slate-500 md:text-sm ${step2MatchTablet ? '' : 'lg:text-base xl:text-lg'}`}>REF: {quoteRef}</p>
                  ) : null}
                  {reviewLike ? null : (
                    <p className="mb-2 mt-1 text-sm text-slate-500">{isAdmin && step === 4 ? 'Step 4 of 4 · Price & send' : PAGE_STEP_LINE[step]}</p>
                  )}
                  <div className="relative min-w-0">{stepPanelBody}</div>
                  {step === 2 && step2Columns ? (
                    <div className="mt-4">
                      <Step2ContactCard lockMobile />
                    </div>
                  ) : null}
                </>
              ) : (
                stepPanel
              )}
            </div>
            {step === 3 ? (
              <aside className="hidden min-w-0 md:block">{reviewSidebar}</aside>
            ) : step === 2 ? (
              <aside className="min-w-0">
                {step2Sidebar}
                {step2Columns && pageChrome ? (
                  <div className="mt-4">
                    <div className="flex items-stretch gap-6 sm:gap-8">
                      <button
                        type="button"
                        onClick={back}
                        className="inline-flex min-h-[52px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 sm:min-w-[7.5rem] sm:px-6"
                      >
                        <span aria-hidden>←</span>
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={next}
                        disabled={quoteStepTransitionLoading}
                        className="flex min-h-[52px] min-w-0 flex-1 items-center justify-center rounded-xl bg-blue-600 px-5 text-base font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:px-6"
                      >
                        {quoteStepTransitionLoading ? 'Finding your price…' : 'Get a quote ›'}
                      </button>
                    </div>
                    <QuoteStep2TrustRow />
                  </div>
                ) : null}
              </aside>
            ) : (
              <MoveSummary {...summaryProps} />
            )}
            {pageChrome ? (
              <>
                {stepNavButtons}
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={startNewAdminBooking}
                    className="mt-3 text-sm font-semibold text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
                  >
                    New booking
                  </button>
                ) : null}
              </>
            ) : (
              <div className={step === 3 ? 'md:hidden' : undefined}>
                <MobileQuoteStickyActions
                  step={step}
                  onBack={back}
                  onNext={next}
                  nextDisabled={quoteStepTransitionLoading || (isAdmin && step === 3 && !reviewDetailsReady(wizard))}
                  nextLoading={quoteStepTransitionLoading && step === 2}
                />
              </div>
            )}
          </div>
        ) : pageChrome ? (
          <div
            className={`quote-wizard-desktop-grid mx-auto grid w-full items-start gap-4 ${
              reviewLike
                ? 'max-w-6xl lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)] lg:gap-6'
                : 'max-w-6xl lg:grid-cols-[minmax(0,1fr)_minmax(300px,min(100%,380px))] lg:gap-6'
            }`}
          >
            <div className="quote-wizard-form-card min-w-0 min-[1200px]:col-start-1 min-[1200px]:row-start-1 lg:col-start-1 lg:row-start-1">
              {pageChromeTopBack}
              {titleTag === 'h2' ? (
                <h2 id={titleId} className={`font-extrabold tracking-tight text-slate-900 ${reviewLike ? 'text-2xl' : 'text-[1.7rem] sm:text-3xl'}`}>
                  {chromeTitle}
                </h2>
              ) : (
                <h1 id={titleId} className={`font-extrabold tracking-tight text-slate-900 ${reviewLike ? 'text-2xl' : 'text-[1.7rem] sm:text-3xl'}`}>
                  {chromeTitle}
                </h1>
              )}
              {chromeSubtitle ? (
                <p className="mt-1 text-sm leading-snug text-slate-500">{chromeSubtitle}</p>
              ) : null}
              <div id="quote-wizard-top" className={reviewLike ? 'mt-3' : 'mt-4'}>
                <WizardProgress step={step} variant="page" step4ShortLabel={isAdmin ? 'Send' : undefined} capAtTablet={step2MatchTablet} />
              </div>
              {reviewLike && quoteRef ? (
                <p className="mb-3 text-center font-mono text-[11px] font-semibold tracking-wide text-slate-500 md:text-sm lg:text-base xl:text-lg">REF: {quoteRef}</p>
              ) : null}
              {reviewLike ? null : (
                <p className="mb-3 text-sm text-slate-500">{isAdmin && step === 4 ? 'Step 4 of 4 · Price & send' : PAGE_STEP_LINE[step]}</p>
              )}
              <div className="relative min-w-0">{stepPanelBody}</div>
            </div>
            {step === 3 ? (
              <div className="quote-wizard-sidebar min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-2">
                {reviewSidebar}
              </div>
            ) : step === 2 ? (
              <div className="quote-wizard-sidebar min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-2">
                {step2Sidebar}
              </div>
            ) : (
              <div ref={sidebarAlignRef} className="quote-wizard-sidebar lg:col-start-2 lg:row-start-1 lg:row-span-2">
                <MoveSummary {...summaryProps} />
              </div>
            )}
            <div className="quote-wizard-nav lg:col-start-1 lg:row-start-2">
              {stepNavButtons}
              {isAdmin ? (
                <button
                  type="button"
                  onClick={startNewAdminBooking}
                  className="mt-3 text-sm font-semibold text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
                >
                  New booking
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className={`grid items-start gap-4 ${reviewLike ? 'mx-auto max-w-6xl lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)] lg:gap-6' : 'lg:grid-cols-[minmax(0,1fr)_minmax(260px,min(100%,340px))] lg:gap-6'}`}>
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
              <div className="min-w-0">{reviewSidebar}</div>
            ) : step === 2 ? (
              <div className="min-w-0">{step2Sidebar}</div>
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
 * @param {{
 *   serviceType: string,
 *   allowServiceChange?: boolean,
 *   servicePreSelected?: boolean,
 *   compact?: boolean,
 *   pageChrome?: boolean,
 *   titleTag?: 'h1' | 'h2',
 *   titleId?: string,
 *   showStep1Back?: boolean,
 *   adminPhoneBooking?: { editQuoteId?: string | null, onBookingCreated?: Function, onBookingUpdated?: Function } | null,
 * }} props
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
  adminPhoneBooking = null,
}) {
  return (
    <QuoteWizardProvider
      serviceType={serviceType}
      allowServiceChange={allowServiceChange}
      mode={adminPhoneBooking ? 'admin' : 'customer'}
      adminEditQuoteId={adminPhoneBooking?.editQuoteId || null}
    >
      <QuoteWizardInner
        compact={compact}
        servicePreSelected={servicePreSelected}
        pageChrome={pageChrome}
        titleTag={titleTag}
        titleId={titleId}
        showStep1Back={showStep1Back}
        adminPhoneBooking={adminPhoneBooking}
      />
    </QuoteWizardProvider>
  )
}
