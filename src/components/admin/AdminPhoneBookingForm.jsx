import { useCallback, useEffect, useMemo, useState } from 'react'
import Step1Address from '../quote-wizard/steps/Step1Address'
import Step2Inventory from '../quote-wizard/steps/Step2Inventory'
import Step3Details from '../quote-wizard/steps/Step3Details'
import MoveSummary from '../quote-wizard/MoveSummary'
import AdminQuotePriceBreakdown from './AdminQuotePriceBreakdown'
import AdminAccessDetailsSection from './AdminAccessDetailsSection'
import AdminPhoneBookingProgress from './AdminPhoneBookingProgress'
import { SERVICE_TYPES } from '../../constants/serviceTypes'
import { fetchPricingSettings } from '../../lib/data/pricingSettingsRepository'
import { onPricingSettingsUpdated } from '../../lib/pricingSettingsEvents'
import { calculateQuote } from '../../lib/pricingCalculator'
import { buildQuoteEngineInput } from '../../lib/buildQuoteEngineInput'
import { getQuoteCrewRestrictions } from '../../lib/crewPricingRules'
import {
  clearAdminPhoneBookingDraft,
  freshAdminPhoneBookingFormState,
} from '../../lib/adminPhoneBookingDraftStorage'
import {
  applyAddressChangeConfirmationReset,
  autoConfirmGeocodedAddresses,
} from '../../lib/addressConfirmation'
import {
  adminPhoneBookingErrorsByField,
  collectAdminPhoneBookingFieldErrors,
  fetchAdminPhoneBookingForEdit,
  insertAdminPhoneBookingFromWizard,
  resolveAdminPhoneBookingFinalPrice,
  updateAdminPhoneBookingFromWizard,
  validateAdminPhoneBookingStep,
} from '../../lib/adminPhoneBooking'
import { supabase } from '../../lib/supabase'

const inputClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25'
const labelClass = 'block text-xs font-semibold uppercase tracking-wide text-slate-500'

function AdminSection({ title, description, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 border-b border-slate-100 pb-3">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {description ? <p className="mt-1 text-xs text-slate-600">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

async function resolveAdminCreatorLabel(email) {
  const e = (email || '').trim()
  return e || 'admin'
}

/**
 * @param {{
 *   editQuoteId?: string | null,
 *   onBookingCreated?: (saved: { id: string, quote_ref: string }) => void,
 *   onBookingUpdated?: (saved: { id: string, quote_ref: string }) => void,
 * }} props
 */
export default function AdminPhoneBookingForm({
  editQuoteId = null,
  onBookingCreated,
  onBookingUpdated,
}) {
  const [wizard, setWizard] = useState(() => freshAdminPhoneBookingFormState().wizard)
  const [serviceType, setServiceType] = useState(() => freshAdminPhoneBookingFormState().serviceType)
  const [quoteRef, setQuoteRef] = useState(() => freshAdminPhoneBookingFormState().quoteRef)
  const [customQuoteRef, setCustomQuoteRef] = useState('')
  const [settings, setSettings] = useState(null)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [useCalculatedPrice, setUseCalculatedPrice] = useState(true)
  const [finalPriceOverride, setFinalPriceOverride] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [adminNote, setAdminNote] = useState('')
  const [step, setStep] = useState(1)
  const [savedQuoteId, setSavedQuoteId] = useState(/** @type {string | null} */ (null))
  const [savedNotice, setSavedNotice] = useState('')
  const [loadingEdit, setLoadingEdit] = useState(Boolean(editQuoteId))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState(/** @type {Record<string, string>} */ ({}))

  const applyFormState = useCallback((state) => {
    setWizard(state.wizard)
    setServiceType(state.serviceType)
    setQuoteRef(state.quoteRef)
    setCustomQuoteRef(state.customQuoteRef || '')
    setUseCalculatedPrice(state.useCalculatedPrice)
    setFinalPriceOverride(state.finalPriceOverride || '')
    setOverrideReason(state.overrideReason || '')
    setAdminNote(state.adminNote || '')
    setStep(state.step || 1)
  }, [])

  const startNewBooking = useCallback(() => {
    clearAdminPhoneBookingDraft()
    const fresh = freshAdminPhoneBookingFormState()
    applyFormState(fresh)
    setSavedQuoteId(null)
    setSavedNotice('')
    setError('')
    setFieldErrors({})
    setStep(1)
  }, [applyFormState])

  useEffect(() => {
    if (!editQuoteId) {
      setLoadingEdit(false)
      return undefined
    }
    let cancelled = false
    ;(async () => {
      setLoadingEdit(true)
      setError('')
      try {
        const loaded = await fetchAdminPhoneBookingForEdit(editQuoteId)
        if (cancelled) return
        applyFormState(loaded)
        setSavedQuoteId(loaded.id)
        setSavedNotice(`Editing booking ${loaded.quote_ref}. Change anything below, then click Save changes.`)
        setStep(loaded.step || 3)
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Could not load booking for edit.')
      } finally {
        if (!cancelled) setLoadingEdit(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [editQuoteId, applyFormState])

  useEffect(() => {
    let cancelled = false

    async function loadSettings() {
      try {
        const s = await fetchPricingSettings()
        if (!cancelled) setSettings(s)
      } catch {
        if (!cancelled) setError('Could not load pricing settings.')
      } finally {
        if (!cancelled) setLoadingSettings(false)
      }
    }

    void loadSettings()
    const unsubscribe = onPricingSettingsUpdated(() => {
      setLoadingSettings(true)
      void loadSettings()
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])


  const effectiveQuoteRef = customQuoteRef.trim() || quoteRef

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

  const crewRestrictions = useMemo(
    () => getQuoteCrewRestrictions({ serviceType, heavyItemCount }),
    [serviceType, heavyItemCount],
  )

  useEffect(() => {
    if (!crewRestrictions.oneManAllowed && Number(wizard.crewSize) === 1) {
      setWizard((w) => ({ ...w, crewSize: 2 }))
    }
  }, [crewRestrictions.oneManAllowed, wizard.crewSize])

  const breakdown = useMemo(() => {
    if (!settings) return null
    return calculateQuote(
      settings,
      buildQuoteEngineInput({ serviceType, wizard, lineItems, heavyItemCount }),
    )
  }, [settings, serviceType, wizard, lineItems, heavyItemCount])

  const priceWithoutPromo = useMemo(() => {
    if (!settings) return null
    return calculateQuote(
      settings,
      buildQuoteEngineInput({
        serviceType,
        wizard,
        lineItems,
        heavyItemCount,
        promoCode: '',
      }),
    ).estimatedTotal
  }, [settings, serviceType, wizard, lineItems, heavyItemCount])

  const priceResolution = useMemo(
    () =>
      resolveAdminPhoneBookingFinalPrice(breakdown, {
        useCalculatedPrice,
        finalPriceOverride,
      }),
    [breakdown, useCalculatedPrice, finalPriceOverride],
  )

  const handleDistanceFromRoute = useCallback((payload) => {
    if (payload?.type === 'ok' && typeof payload.miles === 'number') {
      const durationSeconds =
        typeof payload.durationSeconds === 'number' && payload.durationSeconds > 0
          ? payload.durationSeconds
          : null
      setWizard((w) => ({
        ...w,
        distanceMiles: payload.miles,
        mapboxRouteDurationSeconds: durationSeconds,
      }))
    }
  }, [])

  const handleWizardChange = useCallback((next) => {
    setWizard((prev) => {
      const merged =
        typeof next === 'function'
          ? next(prev)
          : { ...prev, ...next }
      return applyAddressChangeConfirmationReset(prev, merged)
    })
  }, [])

  useEffect(() => {
    if (step !== 3) return
    setWizard((w) => autoConfirmGeocodedAddresses(w))
  }, [
    step,
    wizard.pickupAddress,
    wizard.deliveryAddress,
    wizard.pickupLng,
    wizard.pickupLat,
    wizard.deliveryLng,
    wizard.deliveryLat,
  ])

  const goToStep = useCallback((n, { preserveErrors = false } = {}) => {
    setStep(n)
    if (!preserveErrors) {
      setError('')
      setFieldErrors({})
    }
    window.requestAnimationFrame(() => {
      document.getElementById('admin-phone-booking-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

  const applyValidationErrors = useCallback(
    (errors) => {
      if (!errors.length) {
        setFieldErrors({})
        setError('')
        return true
      }
      const byField = adminPhoneBookingErrorsByField(errors)
      setFieldErrors(byField)
      setError(errors[0].message)
      const firstStep = errors[0].step
      if (firstStep < step) goToStep(firstStep, { preserveErrors: true })
      return false
    },
    [step, goToStep],
  )

  const handleNext = useCallback(() => {
    const errors = collectAdminPhoneBookingFieldErrors(wizard).filter((e) => e.step === step)
    if (!applyValidationErrors(errors)) return
    if (step < 3) goToStep(step + 1)
  }, [wizard, step, goToStep, applyValidationErrors])

  const handleBack = useCallback(() => {
    if (step > 1) goToStep(step - 1)
  }, [step, goToStep])

  const summaryProps = {
    quoteRef: effectiveQuoteRef,
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
      handleWizardChange((w) => ({ ...w, inventoryLines })),
    totalM3,
    showPricing: true,
    breakdown,
    serviceType,
    crewSettings: settings,
    crewRestrictions,
    compact: false,
    mapVariant: 'default',
    hideEstimatedTotalCard: true,
  }

  function handleFormKeyDown(e) {
    if (e.key !== 'Enter' || step === 3) return
    const el = e.target
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLButtonElement) return
    if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
      e.preventDefault()
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (step !== 3) {
      setError('Use “Continue to review →” to reach step 3 before creating the booking.')
      return
    }
    if (submitting) return
    setError('')

    const validationErrorList = collectAdminPhoneBookingFieldErrors(wizard)
    if (!applyValidationErrors(validationErrorList)) {
      window.requestAnimationFrame(() => {
        const anchor =
          validationErrorList[0]?.field === 'pickupAddressConfirmed' ||
          validationErrorList[0]?.field === 'deliveryAddressConfirmed'
            ? document.getElementById('quote-wizard-address-confirmation')
            : null
        anchor?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
      return
    }

    if (!breakdown) {
      setError('Pricing is not ready yet. Wait for settings to load or add inventory.')
      return
    }

    if (priceResolution.invalid) {
      setFieldErrors({ finalPriceOverride: 'Enter a valid final price (0 or more).' })
      setError('Enter a valid final price override, or use the calculated price.')
      if (step !== 3) goToStep(3, { preserveErrors: true })
      return
    }

    if (!useCalculatedPrice && priceResolution.final == null) {
      setFieldErrors({ finalPriceOverride: 'Enter the final price to charge.' })
      setError('Enter the final price to charge.')
      if (step !== 3) goToStep(3, { preserveErrors: true })
      return
    }

    setSubmitting(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const createdBy = await resolveAdminCreatorLabel(sessionData.session?.user?.email)

      const payload = {
        wizard,
        serviceType,
        quoteRef: customQuoteRef.trim() || quoteRef,
        breakdown,
        useCalculatedPrice,
        finalPrice: priceResolution.final,
        finalPriceOverride,
        overrideReason,
        adminNote,
        createdBy,
      }

      const isUpdate = Boolean(savedQuoteId)
      const saved = isUpdate
        ? await updateAdminPhoneBookingFromWizard({ ...payload, quoteId: savedQuoteId })
        : await insertAdminPhoneBookingFromWizard(payload)

      setSavedQuoteId(saved.id)
      setQuoteRef(saved.quote_ref)
      setCustomQuoteRef('')
      setSavedNotice(
        `Booking ${saved.quote_ref} saved. You can keep editing below and click Save changes again.`,
      )
      clearAdminPhoneBookingDraft()
      if (isUpdate) {
        onBookingUpdated?.(saved)
      } else {
        onBookingCreated?.(saved)
      }
      setError('')
      setFieldErrors({})
    } catch (err) {
      setError(err?.message || 'Could not save booking.')
    } finally {
      setSubmitting(false)
    }
  }

  const calculatedDisplay =
    priceResolution.calculated != null ? `£${priceResolution.calculated.toFixed(2)}` : '—'
  const finalDisplay =
    priceResolution.final != null ? `£${priceResolution.final.toFixed(2)}` : calculatedDisplay

  const adminPriceOverridePanel = (
    <AdminSection
      title="Price & override"
      description="Use the calculated total or set a custom final price for this booking."
    >
      <div className="space-y-4">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500/30">
          <input
            type="radio"
            name="price_mode"
            checked={useCalculatedPrice}
            onChange={() => setUseCalculatedPrice(true)}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-semibold text-slate-900">Use calculated price</span>
            <span className="block text-xs text-slate-600">{calculatedDisplay}</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500/30">
          <input
            type="radio"
            name="price_mode"
            checked={!useCalculatedPrice}
            onChange={() => setUseCalculatedPrice(false)}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-semibold text-slate-900">Custom final price</span>
            <span className="block text-xs text-slate-600">Original calculated: {calculatedDisplay}</span>
          </span>
        </label>
        {!useCalculatedPrice ? (
          <div>
            <label className={labelClass} htmlFor="apb-final-price-sidebar">
              Final price (£) <span className="text-red-600">*</span>
            </label>
            <input
              id="apb-final-price-sidebar"
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              value={finalPriceOverride}
              onChange={(e) => setFinalPriceOverride(e.target.value)}
              placeholder={
                priceResolution.calculated != null
                  ? priceResolution.calculated.toFixed(2)
                  : '0.00'
              }
            />
          </div>
        ) : null}
        {!useCalculatedPrice ? (
          <div>
            <label className={labelClass} htmlFor="apb-override-reason-sidebar">
              Discount / override reason
            </label>
            <input
              id="apb-override-reason-sidebar"
              className={inputClass}
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="e.g. matched competitor, loyalty discount"
            />
          </div>
        ) : null}
        {fieldErrors.finalPriceOverride ? (
          <p className="text-sm font-medium text-red-700" role="alert">
            {fieldErrors.finalPriceOverride}
          </p>
        ) : null}
      </div>
    </AdminSection>
  )

  const priceBreakdownAfterSummary =
    step >= 2 ? (
      <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="text-sm font-bold text-slate-900">Price breakdown</h3>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
          Live breakdown from the quote pricing engine.
        </p>
        {breakdown ? (
          <div className="mt-3 flex min-w-0 flex-col gap-3">
            <div
              className={`grid min-w-0 gap-2 ${!useCalculatedPrice ? 'grid-cols-2' : 'grid-cols-1'}`}
            >
              <div className="min-w-0 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/90 to-white p-3 ring-1 ring-emerald-100/80">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                  Estimated total
                </p>
                <p className="mt-1 break-words text-lg font-bold tabular-nums text-emerald-700 sm:text-xl">
                  {calculatedDisplay}
                </p>
              </div>
              {!useCalculatedPrice ? (
                <div className="min-w-0 rounded-xl border border-amber-200 bg-amber-50/90 p-3 ring-1 ring-amber-100/80">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                    Final (override)
                  </p>
                  <p className="mt-1 break-words text-lg font-bold tabular-nums text-amber-900 sm:text-xl">
                    {finalDisplay}
                  </p>
                </div>
              ) : null}
            </div>
            <AdminQuotePriceBreakdown
              breakdown={breakdown}
              serviceType={serviceType}
              wizard={wizard}
              crewSettings={settings}
              compact
              sidebar
            />
          </div>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Add inventory and confirm the route on the map to see the price breakdown.
          </p>
        )}
      </section>
    ) : null

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-6xl space-y-6">
      <div id="admin-phone-booking-top">
        <AdminPhoneBookingProgress
          step={step}
          onStepClick={(n) => {
            if (n >= 1 && n <= 3 && n !== step) goToStep(n)
          }}
        />
        <p className="mt-2 text-xs text-slate-500">
          Step {step} of 3 — nothing is saved until you click{' '}
          {savedQuoteId ? 'Save changes' : 'Save phone booking'} at the end of step 3.
        </p>
      </div>

      {loadingEdit ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Loading booking for edit…
        </p>
      ) : null}

      {savedNotice ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-950">
          <p>{savedNotice}</p>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm('Start a new empty phone booking form?')) {
                return
              }
              startNewBooking()
            }}
            className="shrink-0 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50"
          >
            New booking
          </button>
        </div>
      ) : null}

      {error ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="flex min-w-0 flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-6">
          {step === 1 ? (
            <>
              <AdminSection
                title="Step 1 — Move details"
                description="Service, addresses, date, arrival and property access."
              >
                <Step1Address
                  data={wizard}
                  onChange={handleWizardChange}
                  quoteRef={effectiveQuoteRef}
                  serviceType={serviceType}
                  serviceTypeOptions={[...SERVICE_TYPES]}
                  onServiceTypeChange={setServiceType}
                />
                {fieldErrors.pickupAddress ? (
                  <p className="mt-2 text-sm font-medium text-red-700" role="alert" data-quote-field="pickup-address">
                    {fieldErrors.pickupAddress}
                  </p>
                ) : null}
                {fieldErrors.deliveryAddress ? (
                  <p className="mt-2 text-sm font-medium text-red-700" role="alert" data-quote-field="delivery-address">
                    {fieldErrors.deliveryAddress}
                  </p>
                ) : null}
                {fieldErrors.pickupFloor ? (
                  <p className="mt-2 text-sm font-medium text-red-700" role="alert">
                    {fieldErrors.pickupFloor}
                  </p>
                ) : null}
                {fieldErrors.deliveryFloor ? (
                  <p className="mt-2 text-sm font-medium text-red-700" role="alert">
                    {fieldErrors.deliveryFloor}
                  </p>
                ) : null}
                {fieldErrors.moveDate ? (
                  <p className="mt-2 text-sm font-medium text-red-700" role="alert" data-quote-field="move-date">
                    {fieldErrors.moveDate}
                  </p>
                ) : null}
                {fieldErrors.arrivalWindow ? (
                  <p className="mt-2 text-sm font-medium text-red-700" role="alert" data-quote-field="arrival">
                    {fieldErrors.arrivalWindow}
                  </p>
                ) : null}
                {fieldErrors.distanceMiles ? (
                  <p className="mt-2 text-sm font-medium text-red-700" role="alert">
                    {fieldErrors.distanceMiles}
                  </p>
                ) : null}
              </AdminSection>
              <AdminSection
                title="Access details"
                description="Parking, walking distance, stairs and access notes — affect pricing."
              >
                <AdminAccessDetailsSection data={wizard} onChange={handleWizardChange} />
              </AdminSection>
            </>
          ) : null}

          {step === 2 ? (
            <AdminSection
              title="Step 2 — Inventory & customer"
              description="Crew size, items, quantities, and customer contact."
            >
              {loadingSettings ? (
                <p className="text-sm text-slate-600">Loading pricing settings…</p>
              ) : (
                <Step2Inventory
                  layoutVariant="admin"
                  lines={wizard.inventoryLines}
                  onLinesChange={(inventoryLines) =>
                    handleWizardChange((w) => ({ ...w, inventoryLines }))
                  }
                  customSizeM3={settings?.customSizeM3}
                  crewSize={wizard.crewSize}
                  onCrewSizeChange={(crewSize) => handleWizardChange((w) => ({ ...w, crewSize }))}
                  crewSettings={settings}
                  crewRestrictions={crewRestrictions}
                  pricingSettings={settings}
                  breakdown={breakdown}
                  priceWithoutPromo={priceWithoutPromo}
                  quoteRef={effectiveQuoteRef}
                  data={wizard}
                  onChange={handleWizardChange}
                />
              )}
              {fieldErrors.fullName ? (
                <p className="mt-3 text-sm font-medium text-red-700" role="alert">
                  {fieldErrors.fullName}
                </p>
              ) : null}
              {fieldErrors.phone ? (
                <p className="mt-2 text-sm font-medium text-red-700" role="alert">
                  {fieldErrors.phone}
                </p>
              ) : null}
              {fieldErrors.email ? (
                <p className="mt-2 text-sm font-medium text-red-700" role="alert">
                  {fieldErrors.email}
                </p>
              ) : null}
              {fieldErrors.crewSize ? (
                <p className="mt-2 text-sm font-medium text-red-700" role="alert">
                  {fieldErrors.crewSize}
                </p>
              ) : null}
              {fieldErrors.inventoryLines ? (
                <p className="mt-2 text-sm font-medium text-red-700" role="alert">
                  {fieldErrors.inventoryLines}
                </p>
              ) : null}
            </AdminSection>
          ) : null}

          {step === 3 ? (
            <>
              <div className="lg:hidden">{adminPriceOverridePanel}</div>
              <AdminSection
                title="Step 3 — Contacts, extras & price"
                description="Pickup/delivery contacts, packing, dismantling, address confirmation."
              >
                <div className="mb-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => goToStep(1)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Edit move &amp; access
                  </button>
                  <button
                    type="button"
                    onClick={() => goToStep(2)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Edit inventory &amp; customer
                  </button>
                </div>
                <Step3Details
                  layoutVariant="admin"
                  data={wizard}
                  onChange={handleWizardChange}
                  pricingSettings={settings}
                  onGoToStep={(n) => goToStep(Math.min(3, Math.max(1, Number(n) || 1)))}
                  quoteRef={effectiveQuoteRef}
                  hideContactSection
                  fieldErrors={fieldErrors}
                />
              </AdminSection>

              <AdminSection
                title="Internal notes"
                description="Optional quote reference and staff notes."
              >
                <div className="space-y-4">
                  <div>
                    <label className={labelClass} htmlFor="apb-admin-note">
                      Admin note (internal)
                    </label>
                    <textarea
                      id="apb-admin-note"
                      rows={3}
                      className={`${inputClass} min-h-[80px] resize-y`}
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      placeholder="Anything staff should know about this phone booking"
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="apb-ref">
                      Quote reference{' '}
                      <span className="font-normal normal-case text-slate-400">(optional)</span>
                    </label>
                    <input
                      id="apb-ref"
                      className={inputClass}
                      value={customQuoteRef}
                      onChange={(e) => setCustomQuoteRef(e.target.value)}
                      placeholder={quoteRef}
                    />
                  </div>
                </div>
              </AdminSection>
            </>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={handleBack}
              disabled={step === 1}
              className="inline-flex min-h-[48px] items-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40"
            >
              ← Back
            </button>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="inline-flex min-h-[48px] items-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                onClick={() => {
                  if (!window.confirm('Clear the form and start a new phone booking?')) return
                  startNewBooking()
                }}
              >
                New booking
              </button>
              {step < 3 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={loadingSettings && step === 2}
                  className="inline-flex min-h-[48px] items-center rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-brand-700 disabled:opacity-60"
                >
                  {step === 1 ? 'Continue to inventory →' : 'Continue to review →'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting || loadingSettings}
                  onClick={(e) => handleSubmit(e)}
                  className="inline-flex min-h-[48px] items-center rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-brand-700 disabled:opacity-60"
                >
                  {submitting
                    ? 'Saving…'
                    : savedQuoteId
                      ? 'Save changes'
                      : 'Save phone booking'}
                </button>
              )}
            </div>
          </div>
        </div>

        <aside className="hidden w-full min-w-0 shrink-0 lg:block lg:w-[min(100%,22rem)] xl:w-[24rem]">
          <div
            className={
              step === 3
                ? 'sticky top-4 z-10 flex flex-col gap-4'
                : 'sticky top-4 z-10 flex max-h-[calc(100vh-2rem)] flex-col gap-4 overflow-y-auto overflow-x-hidden overscroll-contain'
            }
          >
            <MoveSummary {...summaryProps} afterSummary={priceBreakdownAfterSummary} />
            {step >= 2 ? adminPriceOverridePanel : null}
          </div>
        </aside>
      </div>

      {step >= 2 ? (
        <div className="space-y-4 lg:hidden">
          <MoveSummary {...summaryProps} afterSummary={priceBreakdownAfterSummary} />
          {step >= 2 ? adminPriceOverridePanel : null}
        </div>
      ) : null}
    </form>
  )
}
