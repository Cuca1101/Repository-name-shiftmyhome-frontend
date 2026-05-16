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
} from '../../lib/emailQuotePayload'
import { getLocalDateYYYYMMDD } from '../../lib/moveDateLocal'
import { sendQuoteRequestEmailJs } from '../../utils/sendQuoteRequestEmailJs'
import {
  calculateQuote,
  breakdownToFlatRows,
  isWeekendDate,
} from '../../lib/pricingCalculator'
import {
  MOVE_DATE_PAST_ERROR,
  isMoveDateOnOrAfterToday,
} from '../../lib/moveDateLocal'

const QuoteWizardContext = createContext(null)

export function useQuoteWizard() {
  const ctx = useContext(QuoteWizardContext)
  if (!ctx) {
    throw new Error('useQuoteWizard must be used within QuoteWizardProvider')
  }
  return ctx
}

export function makeQuoteRef() {
  const y = new Date().getFullYear()
  const n = Math.floor(100000 + Math.random() * 900000)
  return `SMH-${y}-${n}`
}

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

export function initialWizardState() {
  return {
    pickupAddress: '',
    deliveryAddress: '',
    pickupLng: null,
    pickupLat: null,
    deliveryLng: null,
    deliveryLat: null,
    pickupPropertyType: 'House',
    deliveryPropertyType: 'House',
    pickupFloor: null,
    deliveryFloor: null,
    pickupLift: true,
    deliveryLift: true,
    distanceMiles: 0,
    moveDate: '',
    arrivalWindow: 'flex',
    exactArrivalTime: '',
    inventoryLines: [],
    packing: false,
    packingWhat: '',
    packingApproxBoxes: 0,
    packingFragile: false,
    packingMaterials: false,
    dismantling: false,
    dismantlingWhat: '',
    dismantlingItemCount: 0,
    reassembly: false,
    reassemblyWhat: '',
    reassemblyItemCount: 0,
    reassemblySameAsDismantling: false,
    parkingDistance: 'standard',
    walkingDistance: 'standard',
    stairsFlights: 0,
    stairsNotes: '',
    heavyNotes: '',
    specialInstructions: '',
    crewSize: null,
    vehicleSize: '',
    fullName: '',
    phone: '',
    email: '',
  }
}

const HAS_MAPBOX_TOKEN = Boolean(import.meta.env.VITE_MAPBOX_TOKEN)

/**
 * Shared quote wizard state for all service routes and the homepage calculator.
 *
 * @param {{ children: import('react').ReactNode, serviceType: string, allowServiceChange?: boolean }} props
 */
export function QuoteWizardProvider({ children, serviceType: serviceTypeProp, allowServiceChange = false }) {
  const [step, setStep] = useState(1)
  const [quoteRef] = useState(() => makeQuoteRef())
  const [wizard, setWizard] = useState(initialWizardState)
  const [serviceType, setServiceType] = useState(serviceTypeProp)
  const [settings, setSettings] = useState(null)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState('')
  const [cardPayment, setCardPayment] = useState(null)
  const [feedback, setFeedback] = useState({ type: null, text: '' })
  const [lastQuoteData, setLastQuoteData] = useState(null)
  const fileInputRef = useRef(null)
  const pendingStepScrollRef = useRef(false)

  useEffect(() => {
    setServiceType(serviceTypeProp)
  }, [serviceTypeProp])

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
        if (!c) setFeedback({ type: 'error', text: 'Could not load pricing. Refresh and try again.' })
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

    return calculateQuote(settings, {
      serviceType,
      distanceMiles: Number(wizard.distanceMiles) || 0,
      lineItems,
      access: {
        pickupFloor: wizard.pickupFloor == null ? 0 : Number(wizard.pickupFloor),
        deliveryFloor: wizard.deliveryFloor == null ? 0 : Number(wizard.deliveryFloor),
        pickupLift: Boolean(wizard.pickupLift),
        deliveryLift: Boolean(wizard.deliveryLift),
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
      },
      crewSize:
        wizard.crewSize != null && wizard.crewSize !== ''
          ? Number(wizard.crewSize)
          : undefined,
      moveDate,
    })
  }, [step, settings, serviceType, wizard, lineItems, heavyItemCount])

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
      const et = (wizard.exactArrivalTime || '').trim()
      const arrivalOk =
        wizard.arrivalWindow !== 'exact' ||
        (/^\d{2}:\d{2}$/.test(et) &&
          (() => {
            const h = parseInt(et.slice(0, 2), 10)
            return h >= 8 && h <= 18
          })())
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
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(wizard.email.trim())
      return (
        wizard.fullName.trim().length > 1 &&
        wizard.phone.trim().length > 5 &&
        emailOk
      )
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
      return
    }
    if (
      step === 1 &&
      wizard.moveDate &&
      !isMoveDateOnOrAfterToday(wizard.moveDate)
    ) {
      setFeedback({ type: 'error', text: MOVE_DATE_PAST_ERROR })
      return
    }
    if (step === 1 && wizard.arrivalWindow === 'exact') {
      const et = (wizard.exactArrivalTime || '').trim()
      if (!/^\d{2}:\d{2}$/.test(et)) {
        setFeedback({
          type: 'error',
          text: 'Please choose your preferred arrival hour (08:00–18:00).',
        })
        return
      }
      const h = parseInt(et.slice(0, 2), 10)
      if (h < 8 || h > 18) {
        setFeedback({
          type: 'error',
          text: 'Arrival time must be between 08:00 and 18:00.',
        })
        return
      }
    }
    if (!canGoNext()) {
      if (step === 2) {
        if (!(Number(wizard.crewSize) >= 1 && Number(wizard.crewSize) <= 4)) {
          setFeedback({ type: 'error', text: 'Please select a crew size before continuing.' })
        } else if (wizard.inventoryLines.length === 0) {
          setFeedback({ type: 'error', text: 'Add at least one item to your inventory.' })
        } else {
          setFeedback({ type: 'error', text: 'Please complete the required fields.' })
        }
      } else {
        setFeedback({ type: 'error', text: 'Please complete the required fields.' })
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
    const photoInput = fileInputRef.current
    const files = photoInput?.files ? Array.from(photoInput.files) : []

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
      arrival_time: wizard.arrivalWindow === 'exact' ? (wizard.exactArrivalTime || '').trim() : '',
    })

    const extras = {
      arrival_window: formatWizardArrivalSummary(wizard),
      distance_miles: Number(wizard.distanceMiles) || 0,
      crew_size: Number(wizard.crewSize) || null,
      vehicle_size: wizard.vehicleSize ? String(wizard.vehicleSize) : null,
    }

    return { templateParams, extras, fullSummaryText, photoFileNames: files.map((f) => f.name) }
  }, [breakdown, wizard, serviceType, quoteRef])

  const clearCardPayment = useCallback(() => setCardPayment(null), [])

  const handlePay = useCallback(
    async (paymentType) => {
      if (!breakdown) return
      if (!isMoveDateOnOrAfterToday(wizard.moveDate)) {
        setPayError(MOVE_DATE_PAST_ERROR)
        return
      }
      const payload = buildQuotePayloadForSave()
      if (!payload) return

      setPayLoading(true)
      setPayError('')
      setCardPayment(null)
      try {
        const quote_lead = buildQuoteRowFromTemplateParams(payload.templateParams, payload.extras)
        const { clientSecret, paymentIntentId } = await createPaymentIntent({
          quote_ref: quoteRef,
          customer_email: wizard.email.trim(),
          customer_name: wizard.fullName.trim(),
          service_type: serviceType,
          amount: paymentType === 'deposit' ? 50 : breakdown.estimatedTotal,
          amount_gbp: paymentType === 'deposit' ? 50 : breakdown.estimatedTotal,
          payment_type: paymentType,
          quote_lead,
        })
        const amountLabel =
          paymentType === 'deposit'
            ? '£50.00 deposit'
            : `£${breakdown.estimatedTotal.toFixed(2)} (estimated total)`
        setCardPayment({
          clientSecret,
          paymentIntentId,
          paymentType,
          amountLabel,
        })
      } catch (e) {
        setPayError(e?.message ?? 'Payment could not start.')
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
    ],
  )

  const handleSubmit = useCallback(async () => {
    if (!breakdown || !settings) return
    if (!isMoveDateOnOrAfterToday(wizard.moveDate)) {
      setFeedback({ type: 'error', text: MOVE_DATE_PAST_ERROR })
      return
    }
    if (!isEmailJsReady()) {
      setFeedback({
        type: 'error',
        text: EMAILJS_TEMPLATE_ID_GUIDE,
      })
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
      arrival_time: wizard.arrivalWindow === 'exact' ? (wizard.exactArrivalTime || '').trim() || null : null,
      photoFileNames,
    }

    const jobItems = wizard.inventoryLines.map((row) => {
      const lineVol = row.quantity * row.m3 * (row.mult ?? 1)
      return {
        item_name: row.name,
        library_item_id: null,
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
      try {
        await createJobRequest({
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
          arrival_time:
            wizard.arrivalWindow === 'exact' ? (wizard.exactArrivalTime || '').trim() || null : null,
        })
      } catch (err) {
        jobWarning = err?.message || 'Database error'
      }

      const backendIssues = [quoteWarning, jobWarning].filter(Boolean)
      setFeedback({
        type: backendIssues.length ? 'warning' : 'success',
        text: backendIssues.length
          ? `Quote emailed. ${backendIssues.join(' ')}`
          : 'Thank you — your quote request was sent. We’ll be in touch shortly.',
      })
      setWizard(initialWizardState())
      setStep(1)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setLastQuoteData(null)
      const msg = err?.text || err?.message || 'Something went wrong.'
      setFeedback({ type: 'error', text: typeof msg === 'string' ? msg : 'Submit failed.' })
    } finally {
      setSubmitting(false)
    }
  }, [breakdown, settings, serviceType, quoteRef, wizard, buildQuotePayloadForSave])

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
    fileInputRef,
    lineItems,
    heavyItemCount,
    totalM3,
    breakdown,
    customSizeM3,
    handleDistanceFromRoute,
    canGoNext,
    next,
    back,
    goToStep,
    buildQuotePayloadForSave,
    handlePay,
    handleSubmit,
  }

  return <QuoteWizardContext.Provider value={value}>{children}</QuoteWizardContext.Provider>
}
