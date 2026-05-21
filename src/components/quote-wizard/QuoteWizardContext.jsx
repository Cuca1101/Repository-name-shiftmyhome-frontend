import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { EMAILJS_TEMPLATE_ID_GUIDE, isEmailJsReady } from '../../emailjs.config'
import { fetchPricingSettings } from '../../lib/data/pricingSettingsRepository'
import { createJobRequest } from '../../lib/data/jobsRepository'
import {
  buildQuoteRowFromTemplateParams,
  insertQuoteFromTemplateParams,
} from '../../lib/data/quotesRepository'
import { createPaymentIntent } from '../../lib/stripeCheckout'
import {
  buildQuoteEmailTemplateParams,
  buildWizardFullSummaryText,
  formatInventoryRowsForEmail,
  formatQuoteBreakdownLines,
  formatWizardArrivalSummary,
  getWizardArrivalTimePayload,
} from '../../lib/emailQuotePayload'
import {
  scrollToStep3ContactField,
  step3ContactDetailsError,
  step3ContactDetailsValid,
} from '../../lib/quoteWizardStep3ContactScroll'
import {
  QUOTE_ERROR_SCROLL_HINTS,
  resolveStep1ScrollHint,
  resolveStep2ScrollHint,
  scheduleQuoteValidationScroll,
} from '../../lib/quoteWizardScrollToError'
import { isMobileViewport } from '../../lib/arrivalTimeSlots'
import {
  isWizardArrivalValid,
  wizardArrivalErrorMessage,
} from '../../lib/arrivalWizardValidation'
import { getLocalDateYYYYMMDD } from '../../lib/moveDateLocal'
import {
  persistPhotoUploadNotice,
  uploadCustomerQuotePhotos,
} from '../../lib/quotePhotoUpload'
import { customerJobPhotoDedupKey } from '../../lib/data/jobPhotosRepository'
import { MAX_PHOTOS } from './QuoteWizardPhotosField'
import { sendQuoteRequestEmailJs } from '../../utils/sendQuoteRequestEmailJs'
import { parsePackingMaterialQuantities } from '../../lib/packingMaterialsCatalog'
import {
  calculateQuote,
  breakdownToFlatRows,
  isWeekendDate,
  resolveDepositAmountGbp,
} from '../../lib/pricingCalculator'
import {
  MOVE_DATE_PAST_ERROR,
  isMoveDateOnOrAfterToday,
} from '../../lib/moveDateLocal'
import { clearQuoteDraft, saveQuoteDraft } from '../../lib/quoteDraftStorage'
import { resolveWizardBootstrap } from '../../lib/quoteWizardBootstrap'
import { initialWizardState, makeQuoteRef } from '../../lib/quoteWizardDefaults'
import { clearResumeSavedQuote } from '../../lib/quoteSessionMode'
import { trackQuoteWizardSnapshot, trackWebsiteLeadEvent } from '../../lib/websiteLeadTracker'
import { useLocation } from 'react-router-dom'

const QuoteWizardContext = createContext(null)

export function useQuoteWizard() {
  const ctx = useContext(QuoteWizardContext)
  if (!ctx) {
    throw new Error('useQuoteWizard must be used within QuoteWizardProvider')
  }
  return ctx
}

export { makeQuoteRef, initialWizardState } from '../../lib/quoteWizardDefaults'

/** Scroll quote wizard to top after step change (mobile: user is often mid-form inside #quote). */
function scrollQuoteWizardIntoView() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.querySelector('#quote')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      document.querySelector('#quote-wizard-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  })
}

const HAS_MAPBOX_TOKEN = Boolean(import.meta.env.VITE_MAPBOX_TOKEN)

/**
 * Shared quote wizard state for all service routes and the homepage calculator.
 *
 * @param {{ children: import('react').ReactNode, serviceType: string, allowServiceChange?: boolean }} props
 */
export function QuoteWizardProvider({ children, serviceType: serviceTypeProp, allowServiceChange = false }) {
  const location = useLocation()
  const skipAutosaveRef = useRef(false)
  const [bootstrap] = useState(() => resolveWizardBootstrap(serviceTypeProp))
  const isResumedRef = useRef(bootstrap.isResumed)
  const addressBaselineRef = useRef(
    isResumedRef.current
      ? {
          pickup: bootstrap.wizard.pickupAddress.trim(),
          delivery: bootstrap.wizard.deliveryAddress.trim(),
        }
      : null,
  )
  const funnelTrackedRef = useRef(false)
  const savedDraftTrackedRef = useRef(false)

  const [step, setStep] = useState(bootstrap.step)
  const [quoteRef, setQuoteRef] = useState(bootstrap.quoteRef)
  const [wizard, setWizard] = useState(bootstrap.wizard)
  const [serviceType, setServiceType] = useState(bootstrap.serviceType)
  const [settings, setSettings] = useState(null)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState('')
  const [cardPayment, setCardPayment] = useState(null)
  const [feedback, setFeedback] = useState({ type: null, text: '' })
  const [lastQuoteData, setLastQuoteData] = useState(null)
  const [quotePhotoFiles, setQuotePhotoFiles] = useState([])
  const pendingStepScrollRef = useRef(false)

  const addQuotePhotos = useCallback((fileList) => {
    const incoming = Array.from(fileList).filter(
      (f) => f instanceof File && f.size > 0 && String(f.type || '').startsWith('image/'),
    )
    if (!incoming.length) return
    setQuotePhotoFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}|${f.size}|${f.lastModified}`))
      const merged = [...prev]
      for (const f of incoming) {
        const key = `${f.name}|${f.size}|${f.lastModified}`
        if (!seen.has(key)) {
          seen.add(key)
          merged.push(f)
        }
      }
      return merged.slice(0, MAX_PHOTOS)
    })
  }, [])

  const removeQuotePhotoAt = useCallback((index) => {
    setQuotePhotoFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const clearQuotePhotos = useCallback(() => {
    setQuotePhotoFiles([])
  }, [])

  useEffect(() => {
    if (!allowServiceChange) {
      setServiceType(serviceTypeProp)
    }
  }, [serviceTypeProp, allowServiceChange])

  useEffect(() => {
    if (funnelTrackedRef.current) return
    funnelTrackedRef.current = true
    trackWebsiteLeadEvent(isResumedRef.current ? 'saved_quote_resumed' : 'quote_started', {
      quoteRef,
      serviceType: bootstrap.serviceType,
      step,
      returnPath: location.pathname,
    })
  }, [bootstrap.serviceType, location.pathname, quoteRef, step])

  useEffect(() => {
    if (isResumedRef.current) return
    const pickup = wizard.pickupAddress.trim()
    const delivery = wizard.deliveryAddress.trim()
    if (!addressBaselineRef.current) {
      if (pickup.length > 2 || delivery.length > 2) {
        addressBaselineRef.current = { pickup, delivery }
      }
      return
    }
    const base = addressBaselineRef.current
    const pickupChanged = pickup.length > 2 && pickup !== base.pickup
    const deliveryChanged = delivery.length > 2 && delivery !== base.delivery
    if (!pickupChanged && !deliveryChanged) return

    addressBaselineRef.current = { pickup, delivery }
    const nextRef = makeQuoteRef()
    setQuoteRef(nextRef)
    if (pickupChanged) {
      trackWebsiteLeadEvent('pickup_address_changed', {
        quoteRef: nextRef,
        serviceType,
        pickupAddress: pickup,
        deliveryAddress: delivery,
        step,
      })
    }
    if (deliveryChanged) {
      trackWebsiteLeadEvent('dropoff_address_changed', {
        quoteRef: nextRef,
        serviceType,
        pickupAddress: pickup,
        deliveryAddress: delivery,
        step,
      })
    }
    trackWebsiteLeadEvent('new_quote_started', {
      quoteRef: nextRef,
      serviceType,
      source: 'address_change',
    })
  }, [wizard.pickupAddress, wizard.deliveryAddress, serviceType, step])

  useEffect(() => {
    if (!pendingStepScrollRef.current) return
    pendingStepScrollRef.current = false
    scrollQuoteWizardIntoView()
  }, [step])

  useEffect(() => {
    let c = false
    ;(async () => {
      try {
        const s = await fetchPricingSettings()
        if (!c) setSettings(s)
      } catch {
        if (!c) {
          setFeedback({ type: 'error', text: 'Could not load pricing. Refresh and try again.' })
          scheduleQuoteValidationScroll({ hint: QUOTE_ERROR_SCROLL_HINTS.feedback })
        }
      } finally {
        if (!c) setLoadingSettings(false)
      }
    })()
    return () => {
      c = true
    }
  }, [])

  const lineItems = useMemo(
    () =>
      wizard.inventoryLines.map((l) => ({
        name: l.name,
        quantity: l.quantity,
        volumePerUnitM3: l.m3,
        handlingMultiplier: l.mult ?? 1,
        weightType: l.weightType,
        isCustom: l.isCustom,
      })),
    [wizard.inventoryLines],
  )

  const heavyItemCount = useMemo(() => {
    let n = 0
    for (const l of wizard.inventoryLines) {
      if (l.weightType === 'heavy') n += l.quantity
    }
    return n
  }, [wizard.inventoryLines])

  const totalM3 = useMemo(() => {
    let t = 0
    for (const l of wizard.inventoryLines) {
      t += l.quantity * l.m3 * (l.mult ?? 1)
    }
    return Math.round(t * 100) / 100
  }, [wizard.inventoryLines])

  const breakdown = useMemo(() => {
    if (step < 4 || !settings) return null
    const moveDate = wizard.moveDate
    const today = getLocalDateYYYYMMDD()
    const sameDay = moveDate === today
    const weekend = isWeekendDate(moveDate)

    const packingMaterialQuantities = parsePackingMaterialQuantities(wizard)

    return calculateQuote(settings, {
      serviceType,
      distanceMiles: Number(wizard.distanceMiles) || 0,
      lineItems,
      access: {
        pickupFloor: wizard.pickupFloor == null ? 0 : Number(wizard.pickupFloor),
        deliveryFloor: wizard.deliveryFloor == null ? 0 : Number(wizard.deliveryFloor),
        pickupLift: wizard.pickupLift == null ? undefined : Boolean(wizard.pickupLift),
        deliveryLift: wizard.deliveryLift == null ? undefined : Boolean(wizard.deliveryLift),
        longWalk: wizard.walkingDistance === 'long',
        parking: wizard.parkingDistance === 'long',
        stairsFlights: wizard.stairsFlights,
        heavyItemCount,
      },
      extras: {
        packing: wizard.packing,
        packingApproxBoxes: wizard.packingApproxBoxes,
        packingFragile: wizard.packingFragile,
        packingMaterials: wizard.packingMaterials,
        packingMaterialQuantities,
        dismantling: wizard.dismantling,
        dismantlingItemCount: wizard.dismantlingItemCount,
        reassembly: wizard.reassembly,
        reassemblyItemCount: wizard.reassemblyItemCount,
        reassemblySameAsDismantling: wizard.reassemblySameAsDismantling,
        waitingHours: 0,
        extraHelpers: 0,
        sameDay,
        weekend,
        exactArrivalPremium: wizard.arrivalWindow === 'exact',
        promoCode: wizard.promoCode,
      },
      crewSize:
        wizard.crewSize != null && wizard.crewSize !== ''
          ? Number(wizard.crewSize)
          : undefined,
      moveDate,
    })
  }, [step, settings, serviceType, wizard, lineItems, heavyItemCount])

  const estimatedTotalForDraft =
    breakdown?.estimatedTotal != null && Number.isFinite(breakdown.estimatedTotal)
      ? breakdown.estimatedTotal
      : null

  useEffect(() => {
    if (skipAutosaveRef.current) return undefined
    const hasProgress =
      isResumedRef.current ||
      step > 1 ||
      wizard.pickupAddress.trim().length > 2 ||
      wizard.deliveryAddress.trim().length > 2
    if (!hasProgress) return undefined

    const returnPath =
      location.pathname && location.pathname !== '/' ? location.pathname : '/quote'
    const timer = window.setTimeout(() => {
      saveQuoteDraft({
        step,
        quoteRef,
        serviceType,
        returnPath,
        wizard,
        estimatedTotal: estimatedTotalForDraft,
      })
      if (!savedDraftTrackedRef.current) {
        savedDraftTrackedRef.current = true
        trackWebsiteLeadEvent('saved_quote_created', {
          quoteRef,
          serviceType,
          step,
          returnPath,
        })
      }
      trackQuoteWizardSnapshot({
        step,
        quoteRef,
        serviceType,
        wizard,
        estimatedTotal: estimatedTotalForDraft,
        landingPath: returnPath,
        status: step > 1 ? 'step_completed' : 'quote_started',
        allowContactInLead: false,
      })
    }, 500)
    return () => window.clearTimeout(timer)
  }, [step, quoteRef, serviceType, wizard, location.pathname, estimatedTotalForDraft])

  useEffect(() => {
    if (step <= 1) return
    trackWebsiteLeadEvent(`quote_step_${step}`, {
      quoteRef,
      serviceType,
      step,
      estimatedTotal: estimatedTotalForDraft,
      returnPath: location.pathname,
    })
    trackWebsiteLeadEvent('step_completed', {
      quoteRef,
      serviceType,
      step,
      estimatedTotal: estimatedTotalForDraft,
      returnPath: location.pathname,
    })
  }, [step])

  const customSizeM3 = settings?.customSizeM3

  const handleDistanceFromRoute = useCallback((payload) => {
    if (payload?.type === 'ok' && typeof payload.miles === 'number') {
      setWizard((w) => ({ ...w, distanceMiles: payload.miles }))
    }
  }, [])

  const canGoNext = useCallback(() => {
    if (step === 1) {
      const textOk =
        wizard.pickupAddress.trim().length > 2 && wizard.deliveryAddress.trim().length > 2
      const coordsOk =
        !HAS_MAPBOX_TOKEN ||
        (wizard.pickupLng != null &&
          wizard.pickupLat != null &&
          wizard.deliveryLng != null &&
          wizard.deliveryLat != null)
      const floorsOk = wizard.pickupFloor != null && wizard.deliveryFloor != null
      const moveDateOk =
        Boolean(wizard.moveDate) && isMoveDateOnOrAfterToday(wizard.moveDate)
      const arrivalOk = isWizardArrivalValid(wizard)
      return (
        textOk &&
        floorsOk &&
        moveDateOk &&
        arrivalOk &&
        Number(wizard.distanceMiles) > 0 &&
        coordsOk
      )
    }
    if (step === 2) {
      const crewOk = Number(wizard.crewSize) >= 1 && Number(wizard.crewSize) <= 4
      return wizard.inventoryLines.length > 0 && crewOk
    }
    if (step === 3) {
      return step3ContactDetailsValid(wizard)
    }
    return true
  }, [step, wizard])

  const next = useCallback(() => {
    setFeedback({ type: null, text: '' })
    if (
      step === 1 &&
      HAS_MAPBOX_TOKEN &&
      (wizard.pickupLng == null ||
        wizard.pickupLat == null ||
        wizard.deliveryLng == null ||
        wizard.deliveryLat == null)
    ) {
      setFeedback({
        type: 'error',
        text: 'Please select an address from the suggestions so we can calculate the route.',
      })
      scheduleQuoteValidationScroll({
        hint: resolveStep1ScrollHint(
          wizard,
          'Please select an address from the suggestions so we can calculate the route.',
        ),
      })
      return
    }
    if (
      step === 1 &&
      wizard.moveDate &&
      !isMoveDateOnOrAfterToday(wizard.moveDate)
    ) {
      setFeedback({ type: 'error', text: MOVE_DATE_PAST_ERROR })
      scheduleQuoteValidationScroll({ hint: QUOTE_ERROR_SCROLL_HINTS.moveDate })
      return
    }
    if (step === 1 && !isWizardArrivalValid(wizard)) {
      const arrivalMsg = wizardArrivalErrorMessage(wizard)
      setFeedback({ type: 'error', text: arrivalMsg })
      scheduleQuoteValidationScroll({
        hint: QUOTE_ERROR_SCROLL_HINTS.arrival,
      })
      return
    }
    if (!canGoNext()) {
      if (step === 2) {
        if (!(Number(wizard.crewSize) >= 1 && Number(wizard.crewSize) <= 4)) {
          setFeedback({ type: 'error', text: 'Please select a crew size before continuing.' })
          scheduleQuoteValidationScroll({ hint: QUOTE_ERROR_SCROLL_HINTS.crewSize })
        } else if (wizard.inventoryLines.length === 0) {
          setFeedback({ type: 'error', text: 'Add at least one item to your inventory.' })
          scheduleQuoteValidationScroll({ hint: QUOTE_ERROR_SCROLL_HINTS.inventory })
        } else {
          setFeedback({ type: 'error', text: 'Please complete the required fields.' })
          scheduleQuoteValidationScroll({ hint: resolveStep2ScrollHint(wizard) })
        }
      } else if (step === 3) {
        const { message, field } = step3ContactDetailsError(wizard)
        setFeedback({ type: 'error', text: message })
        scrollToStep3ContactField(field)
      } else if (step === 1) {
        setFeedback({ type: 'error', text: 'Please complete the required fields.' })
        scheduleQuoteValidationScroll({ hint: resolveStep1ScrollHint(wizard) })
      } else {
        setFeedback({ type: 'error', text: 'Please complete the required fields.' })
        scheduleQuoteValidationScroll({ hint: QUOTE_ERROR_SCROLL_HINTS.feedback })
      }
      return
    }
    pendingStepScrollRef.current = true
    setStep((s) => Math.min(4, s + 1))
  }, [step, wizard, canGoNext])

  const back = useCallback(() => {
    pendingStepScrollRef.current = true
    setStep((s) => Math.max(1, s - 1))
  }, [])

  const goToStep = useCallback((targetStep) => {
    const n = Math.min(4, Math.max(1, Number(targetStep) || 1))
    setFeedback({ type: null, text: '' })
    pendingStepScrollRef.current = true
    setStep(n)
  }, [])

  const buildQuotePayloadForSave = useCallback(() => {
    if (!breakdown) return null
    const files = quotePhotoFiles

    const fullSummaryText = buildWizardFullSummaryText({
      wizard,
      serviceType,
      quoteRef,
      breakdown,
      photoFileNames: files.map((f) => f.name),
    })

    const invRowsForParams = wizard.inventoryLines.map((l) => ({
      name: l.name,
      quantity: l.quantity,
      volumePerUnitM3: l.m3,
      handlingMultiplier: l.mult ?? 1,
      weightType: l.weightType,
      isCustom: l.isCustom,
      categoryLabel: l.categoryLabel,
      customSizeBand: l.customSizeBand,
    }))
    const invSummaryForParams = formatInventoryRowsForEmail(invRowsForParams)

    const templateParams = buildQuoteEmailTemplateParams({
      name: wizard.fullName,
      email: wizard.email,
      phone: wizard.phone,
      service: serviceType,
      pickup: wizard.pickupAddress,
      delivery: wizard.deliveryAddress,
      move_date: wizard.moveDate,
      quote_ref: quoteRef,
      details: fullSummaryText,
      inventory: invSummaryForParams,
      pricing: breakdown ? formatQuoteBreakdownLines(breakdown) : '',
      arrival_type: wizard.arrivalWindow === 'exact' ? 'exact' : 'window',
      arrival_time: getWizardArrivalTimePayload(wizard),
    })

    const extras = {
      arrival_window: formatWizardArrivalSummary(wizard),
      distance_miles: Number(wizard.distanceMiles) || 0,
      crew_size: Number(wizard.crewSize) || null,
      vehicle_size: wizard.vehicleSize ? String(wizard.vehicleSize) : null,
    }

    return { templateParams, extras, fullSummaryText, photoFileNames: files.map((f) => f.name) }
  }, [breakdown, wizard, serviceType, quoteRef, quotePhotoFiles])

  const clearCardPayment = useCallback(() => setCardPayment(null), [])

  /** Upload wizard photos after Stripe payment succeeds (booking already created server-side). */
  const uploadCustomerPhotosAfterPayment = useCallback(
    async (booking = {}) => {
      if (!quotePhotoFiles.length) return { warningMessage: null }
      const ref = String(booking.quoteRef || quoteRef).trim()
      if (!ref) return { warningMessage: null }

      const jobId =
        booking.jobId != null && String(booking.jobId).trim()
          ? String(booking.jobId).trim()
          : null

      const result = await uploadCustomerQuotePhotos({
        files: quotePhotoFiles,
        quoteRef: ref,
        jobId,
      })

      persistPhotoUploadNotice(result)

      setQuotePhotoFiles((prev) =>
        prev.filter((f) => !result.completedFingerprints.has(customerJobPhotoDedupKey(f))),
      )

      if (result.warningMessage) {
        setFeedback({
          type: 'warning',
          text: result.warningMessage,
        })
      }

      return { warningMessage: result.warningMessage }
    },
    [quotePhotoFiles, quoteRef],
  )

  const handlePay = useCallback(
    async (paymentType) => {
      if (paymentType === 'full' && !breakdown) {
        setPayError('Your quote total is still calculating. Please wait a moment and try again.')
        scheduleQuoteValidationScroll({ hint: QUOTE_ERROR_SCROLL_HINTS.payment })
        return
      }
      if (!isMoveDateOnOrAfterToday(wizard.moveDate)) {
        setPayError(MOVE_DATE_PAST_ERROR)
        scheduleQuoteValidationScroll({ hint: QUOTE_ERROR_SCROLL_HINTS.payment })
        return
      }
      if (wizard.phone.trim().length <= 5) {
        setPayError('Please add your phone number on step 3 before paying.')
        scheduleQuoteValidationScroll({ hint: QUOTE_ERROR_SCROLL_HINTS.payment })
        return
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(wizard.email.trim())) {
        setPayError('Please add a valid email on step 3 before paying.')
        scheduleQuoteValidationScroll({ hint: QUOTE_ERROR_SCROLL_HINTS.payment })
        return
      }

      let payload
      try {
        payload = buildQuotePayloadForSave()
      } catch (e) {
        setPayError(e?.message ?? 'Could not prepare your quote for payment.')
        scheduleQuoteValidationScroll({ hint: QUOTE_ERROR_SCROLL_HINTS.payment })
        return
      }
      if (!payload) {
        setPayError('Please complete your quote details before paying.')
        scheduleQuoteValidationScroll({ hint: QUOTE_ERROR_SCROLL_HINTS.payment })
        return
      }

      setPayLoading(true)
      setPayError('')
      setCardPayment(null)
      try {
        const quote_lead = buildQuoteRowFromTemplateParams(payload.templateParams, payload.extras)
        const depositGbp = resolveDepositAmountGbp(settings)
        const { clientSecret, paymentIntentId } = await createPaymentIntent({
          quote_ref: quoteRef,
          customer_email: wizard.email.trim(),
          customer_name: wizard.fullName.trim(),
          service_type: serviceType,
          amount: paymentType === 'deposit' ? depositGbp : breakdown.estimatedTotal,
          amount_gbp: paymentType === 'deposit' ? depositGbp : breakdown.estimatedTotal,
          payment_type: paymentType,
          quote_lead,
        })
        const amountLabel =
          paymentType === 'deposit'
            ? `£${depositGbp.toFixed(2)} deposit`
            : `£${breakdown.estimatedTotal.toFixed(2)} (estimated total)`
        setCardPayment({
          clientSecret,
          paymentIntentId,
          paymentType,
          amountLabel,
        })
        trackWebsiteLeadEvent('payment_started', {
          quoteRef,
          serviceType,
          step,
          estimatedTotal: breakdown?.estimatedTotal,
          customerName: wizard.fullName,
          customerEmail: wizard.email,
          customerPhone: wizard.phone,
          pickupAddress: wizard.pickupAddress,
          deliveryAddress: wizard.deliveryAddress,
        })
      } catch (e) {
        setPayError(e?.message ?? 'Payment could not start.')
        scheduleQuoteValidationScroll({ hint: QUOTE_ERROR_SCROLL_HINTS.payment })
      } finally {
        setPayLoading(false)
      }
    },
    [
      breakdown,
      buildQuotePayloadForSave,
      quoteRef,
      wizard.email,
      wizard.fullName,
      wizard.moveDate,
      serviceType,
      settings,
    ],
  )

  const handleSubmit = useCallback(async () => {
    if (!breakdown || !settings) return
    if (!isMoveDateOnOrAfterToday(wizard.moveDate)) {
      setFeedback({ type: 'error', text: MOVE_DATE_PAST_ERROR })
      scheduleQuoteValidationScroll({ hint: QUOTE_ERROR_SCROLL_HINTS.moveDate })
      return
    }
    if (!isEmailJsReady()) {
      setFeedback({
        type: 'error',
        text: EMAILJS_TEMPLATE_ID_GUIDE,
      })
      scheduleQuoteValidationScroll({ hint: QUOTE_ERROR_SCROLL_HINTS.feedback })
      return
    }

    const payload = buildQuotePayloadForSave()
    if (!payload) return

    setSubmitting(true)
    setFeedback({ type: null, text: '' })
    setLastQuoteData(null)

    const flatRows = breakdownToFlatRows(breakdown).map((r) => ({
      label: r.label,
      amount: r.amount,
    }))
    const priceBreakdownPayload = { rows: flatRows, ...breakdown }

    const { templateParams, extras, fullSummaryText, photoFileNames } = payload

    const priceInputs = {
      serviceType,
      quoteRef,
      wizard,
      arrivalWindow: wizard.arrivalWindow,
      exactArrivalTime: wizard.exactArrivalTime,
      arrival_type: wizard.arrivalWindow === 'exact' ? 'exact' : 'window',
      arrival_time: getWizardArrivalTimePayload(wizard) || null,
      photoFileNames,
    }

    const jobItems = wizard.inventoryLines.map((row) => {
      const lineVol = row.quantity * row.m3 * (row.mult ?? 1)
      return {
        item_name: row.name,
        library_item_id: row.isCustom ? null : row.catalogId ?? null,
        quantity: row.quantity,
        cubic_metres_per_unit: row.m3,
        line_volume_m3: Math.round(lineVol * 100) / 100,
        is_custom: Boolean(row.isCustom),
        weight_type: row.weightType,
      }
    })

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug('EmailJS templateParams:', templateParams)
    }

    try {
      await sendQuoteRequestEmailJs(templateParams, wizard.email)

      setLastQuoteData(structuredClone(templateParams))

      let quoteWarning = null
      try {
        await insertQuoteFromTemplateParams(templateParams, extras)
      } catch (err) {
        const code = err?.code
        const msg = String(err?.message ?? '')
        if (code === '23505' || msg.toLowerCase().includes('duplicate')) {
          quoteWarning = null
        } else {
          quoteWarning = msg || 'Could not save quote lead.'
        }
      }

      let jobWarning = null
      let createdJob = null
      try {
        createdJob = await createJobRequest({
          full_name: wizard.fullName,
          phone: wizard.phone,
          email: wizard.email,
          pickup_address: wizard.pickupAddress,
          delivery_address: wizard.deliveryAddress,
          move_date: wizard.moveDate,
          service_type: serviceType,
          distance_miles: Number(wizard.distanceMiles) || 0,
          total_cubic_metres: breakdown.totalCubicMetres,
          price_breakdown: priceBreakdownPayload,
          price_inputs: priceInputs,
          estimated_total: breakdown.estimatedTotal,
          customer_message: fullSummaryText || null,
          status: 'New',
          job_items: jobItems,
          arrival_type: wizard.arrivalWindow === 'exact' ? 'exact' : 'window',
          arrival_time: getWizardArrivalTimePayload(wizard) || null,
        })
      } catch (err) {
        jobWarning = err?.message || 'Database error'
      }

      let photoWarning = null
      if (quotePhotoFiles.length > 0) {
        const photoResult = await uploadCustomerQuotePhotos({
          files: quotePhotoFiles,
          quoteRef,
          jobId: createdJob?.id ?? null,
        })
        setQuotePhotoFiles((prev) =>
          prev.filter((f) => !photoResult.completedFingerprints.has(customerJobPhotoDedupKey(f))),
        )
        if (photoResult.warningMessage) {
          photoWarning = photoResult.warningMessage
        }
      }

      const backendIssues = [quoteWarning, jobWarning, photoWarning].filter(Boolean)
      setFeedback({
        type: backendIssues.length ? 'warning' : 'success',
        text: backendIssues.length
          ? `Quote emailed. ${backendIssues.join(' ')}`
          : 'Thank you — your quote request was sent. We’ll be in touch shortly.',
      })
      trackWebsiteLeadEvent('quote_completed', {
        quoteRef,
        serviceType,
        step,
        estimatedTotal: breakdown.estimatedTotal,
        customerName: wizard.fullName,
        customerEmail: wizard.email,
        customerPhone: wizard.phone,
        pickupAddress: wizard.pickupAddress,
        deliveryAddress: wizard.deliveryAddress,
      })
      skipAutosaveRef.current = true
      clearQuoteDraft()
      setWizard(initialWizardState())
      setQuotePhotoFiles([])
      setQuoteRef(makeQuoteRef())
      setStep(1)
      window.setTimeout(() => {
        skipAutosaveRef.current = false
      }, 600)
    } catch (err) {
      setLastQuoteData(null)
      const msg = err?.text || err?.message || 'Something went wrong.'
      setFeedback({ type: 'error', text: typeof msg === 'string' ? msg : 'Submit failed.' })
      scheduleQuoteValidationScroll({ hint: QUOTE_ERROR_SCROLL_HINTS.feedback })
    } finally {
      setSubmitting(false)
    }
  }, [breakdown, settings, serviceType, quoteRef, wizard, quotePhotoFiles, buildQuotePayloadForSave])

  const resetQuoteWizard = useCallback(() => {
    skipAutosaveRef.current = true
    clearResumeSavedQuote()
    isResumedRef.current = false
    addressBaselineRef.current = null
    savedDraftTrackedRef.current = false
    clearQuoteDraft()
    setWizard(initialWizardState())
    setQuoteRef(makeQuoteRef())
    setStep(1)
    setServiceType(serviceTypeProp)
    setFeedback({ type: null, text: '' })
    setLastQuoteData(null)
    setCardPayment(null)
    setPayError('')
    setQuotePhotoFiles([])
    window.setTimeout(() => {
      skipAutosaveRef.current = false
    }, 600)
  }, [serviceTypeProp])

  const value = {
    step,
    setStep,
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
    setFeedback,
    lastQuoteData,
    setLastQuoteData,
    quotePhotoFiles,
    addQuotePhotos,
    removeQuotePhotoAt,
    clearQuotePhotos,
    lineItems,
    heavyItemCount,
    totalM3,
    breakdown,
    depositAmountGbp: settings ? resolveDepositAmountGbp(settings) : 50,
    customSizeM3,
    handleDistanceFromRoute,
    canGoNext,
    next,
    back,
    goToStep,
    buildQuotePayloadForSave,
    handlePay,
    handleSubmit,
    uploadCustomerPhotosAfterPayment,
    resetQuoteWizard,
  }

  return <QuoteWizardContext.Provider value={value}>{children}</QuoteWizardContext.Provider>
}
