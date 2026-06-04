import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Step1Address from '../quote-wizard/steps/Step1Address'
import Step2Inventory from '../quote-wizard/steps/Step2Inventory'
import Step3Details from '../quote-wizard/steps/Step3Details'
import MoveSummary from '../quote-wizard/MoveSummary'
import AdminQuotePriceBreakdown from './AdminQuotePriceBreakdown'
import AdminAccessDetailsSection from './AdminAccessDetailsSection'
import AdminPhoneBookingProgress from './AdminPhoneBookingProgress'
import { SERVICE_TYPES } from '../../constants/serviceTypes'
import { fetchPricingSettings } from '../../lib/data/pricingSettingsRepository'
import { calculateQuote, isWeekendDate } from '../../lib/pricingCalculator'
import { parsePackingMaterialQuantities } from '../../lib/packingMaterialsCatalog'
import { getQuoteCrewRestrictions } from '../../lib/crewPricingRules'
import { getLocalDateYYYYMMDD } from '../../lib/moveDateLocal'
import {
  bootstrapAdminPhoneBookingFormState,
  clearAdminPhoneBookingDraft,
  freshAdminPhoneBookingFormState,
  saveAdminPhoneBookingDraft,
} from '../../lib/adminPhoneBookingDraftStorage'
import {
  insertAdminPhoneBookingFromWizard,
  resolveAdminPhoneBookingFinalPrice,
  validateAdminPhoneBooking,
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
 * @param {{ onBookingCreated?: (saved: { id: string, quote_ref: string }) => void }} props
 */
export default function AdminPhoneBookingForm({ onBookingCreated }) {
  const skipAutosaveRef = useRef(true)
  const [boot] = useState(() => bootstrapAdminPhoneBookingFormState())
  const [wizard, setWizard] = useState(boot.wizard)
  const [serviceType, setServiceType] = useState(boot.serviceType)
  const [quoteRef, setQuoteRef] = useState(boot.quoteRef)
  const [customQuoteRef, setCustomQuoteRef] = useState(boot.customQuoteRef)
  const [settings, setSettings] = useState(null)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [useCalculatedPrice, setUseCalculatedPrice] = useState(boot.useCalculatedPrice)
  const [finalPriceOverride, setFinalPriceOverride] = useState(boot.finalPriceOverride)
  const [overrideReason, setOverrideReason] = useState(boot.overrideReason)
  const [adminNote, setAdminNote] = useState(boot.adminNote)
  const [step, setStep] = useState(boot.step)
  const [draftNotice, setDraftNotice] = useState(() => {
    if (boot.draftRestored) {
      return boot.dateWasReset
        ? 'Draft restored. Move date was in the past — please pick a new date.'
        : 'Draft restored — your progress is saved on this device.'
    }
    return ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    skipAutosaveRef.current = false
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const s = await fetchPricingSettings()
        if (!cancelled) setSettings(s)
      } catch {
        if (!cancelled) setError('Could not load pricing settings.')
      } finally {
        if (!cancelled) setLoadingSettings(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (skipAutosaveRef.current) return undefined
    const hasProgress =
      step > 1 ||
      wizard.pickupAddress.trim().length > 2 ||
      wizard.deliveryAddress.trim().length > 2 ||
      wizard.inventoryLines.length > 0 ||
      wizard.fullName.trim().length > 0 ||
      wizard.phone.trim().length > 0 ||
      wizard.email.trim().length > 0 ||
      customQuoteRef.trim().length > 0 ||
      adminNote.trim().length > 0 ||
      overrideReason.trim().length > 0 ||
      finalPriceOverride.trim().length > 0 ||
      !useCalculatedPrice
    if (!hasProgress) return undefined

    const timer = window.setTimeout(() => {
      saveAdminPhoneBookingDraft({
        step,
        wizard,
        serviceType,
        quoteRef,
        customQuoteRef,
        useCalculatedPrice,
        finalPriceOverride,
        overrideReason,
        adminNote,
      })
    }, 400)
    return () => window.clearTimeout(timer)
  }, [
    step,
    wizard,
    serviceType,
    quoteRef,
    customQuoteRef,
    useCalculatedPrice,
    finalPriceOverride,
    overrideReason,
    adminNote,
  ])

  const handleDiscardDraft = useCallback(() => {
    if (!window.confirm('Discard saved draft and start a new phone booking?')) return
    clearAdminPhoneBookingDraft()
    const fresh = freshAdminPhoneBookingFormState()
    setWizard(fresh.wizard)
    setServiceType(fresh.serviceType)
    setQuoteRef(fresh.quoteRef)
    setCustomQuoteRef(fresh.customQuoteRef)
    setUseCalculatedPrice(fresh.useCalculatedPrice)
    setFinalPriceOverride(fresh.finalPriceOverride)
    setOverrideReason(fresh.overrideReason)
    setAdminNote(fresh.adminNote)
    setStep(fresh.step)
    setDraftNotice('')
    setError('')
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
    const moveDate = wizard.moveDate
    const today = getLocalDateYYYYMMDD()
    const sameDay = moveDate === today
    const weekend = isWeekendDate(moveDate)
    const packingMaterialQuantities = parsePackingMaterialQuantities(wizard)

    return calculateQuote(settings, {
      serviceType,
      distanceMiles: Number(wizard.distanceMiles) || 0,
      mapboxRouteDurationSeconds:
        wizard.mapboxRouteDurationSeconds != null && wizard.mapboxRouteDurationSeconds !== ''
          ? Number(wizard.mapboxRouteDurationSeconds)
          : undefined,
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
        packageTier: wizard.packageTier || 'standard',
      },
      crewSize:
        wizard.crewSize != null && wizard.crewSize !== '' ? Number(wizard.crewSize) : undefined,
      moveDate,
    })
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

  const goToStep = useCallback((n) => {
    setStep(n)
    setError('')
    window.requestAnimationFrame(() => {
      document.getElementById('admin-phone-booking-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

  const handleNext = useCallback(() => {
    const errors = validateAdminPhoneBookingStep(wizard, /** @type {1|2|3} */ (step))
    if (errors.length) {
      setError(errors[0])
      return
    }
    if (step < 3) goToStep(step + 1)
  }, [wizard, step, goToStep])

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
    onInventoryLinesChange: (inventoryLines) => setWizard((w) => ({ ...w, inventoryLines })),
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

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitting) return
    setError('')

    const validationErrors = validateAdminPhoneBooking(wizard)
    if (validationErrors.length) {
      setError(validationErrors[0])
      return
    }

    if (!breakdown) {
      setError('Pricing is not ready yet. Wait for settings to load or add inventory.')
      return
    }

    if (priceResolution.invalid) {
      setError('Enter a valid final price override, or use the calculated price.')
      return
    }

    if (!useCalculatedPrice && priceResolution.final == null) {
      setError('Enter the final price to charge.')
      return
    }

    setSubmitting(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const createdBy = await resolveAdminCreatorLabel(sessionData.session?.user?.email)

      const saved = await insertAdminPhoneBookingFromWizard({
        wizard,
        serviceType,
        quoteRef: customQuoteRef.trim() || quoteRef,
        breakdown,
        useCalculatedPrice,
        finalPrice: priceResolution.final,
        overrideReason,
        adminNote,
        createdBy,
      })

      clearAdminPhoneBookingDraft()
      const fresh = freshAdminPhoneBookingFormState()
      setWizard(fresh.wizard)
      setServiceType(fresh.serviceType)
      setQuoteRef(fresh.quoteRef)
      setCustomQuoteRef(fresh.customQuoteRef)
      setUseCalculatedPrice(fresh.useCalculatedPrice)
      setFinalPriceOverride(fresh.finalPriceOverride)
      setOverrideReason(fresh.overrideReason)
      setAdminNote(fresh.adminNote)
      setStep(fresh.step)
      setDraftNotice('')
      onBookingCreated?.(saved)
      window.requestAnimationFrame(() => {
        document.getElementById('admin-phone-booking-my-jobs')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      })
      setError('')
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

  const priceReviewPanel = (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="text-sm font-bold text-slate-900">Price review</h3>
      <p className="mt-0.5 text-xs text-slate-600">Live breakdown from the quote pricing engine.</p>
      {breakdown ? (
        <div className="mt-3 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex w-full shrink-0 flex-row gap-2 sm:w-[8.75rem] sm:flex-col">
            <div className="min-w-0 flex-1 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/90 to-white p-3 ring-1 ring-emerald-100/80">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                Estimated total
              </p>
              <p className="mt-1 font-mono text-xl font-bold tabular-nums tracking-tight text-emerald-700">
                {calculatedDisplay}
              </p>
            </div>
            {!useCalculatedPrice ? (
              <div className="min-w-0 flex-1 rounded-xl border border-amber-200 bg-amber-50/90 p-3 ring-1 ring-amber-100/80">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                  Final (override)
                </p>
                <p className="mt-1 font-mono text-xl font-bold tabular-nums tracking-tight text-amber-900">
                  {finalDisplay}
                </p>
              </div>
            ) : null}
          </div>
          <div className="min-h-0 min-w-0 flex-1 sm:max-h-[min(70vh,720px)] sm:overflow-y-auto sm:pr-0.5">
            <AdminQuotePriceBreakdown
              breakdown={breakdown}
              serviceType={serviceType}
              wizard={wizard}
              crewSettings={settings}
              compact
            />
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-600">
          Add inventory and confirm the route on the map to see the price breakdown.
        </p>
      )}
    </section>
  )

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-6xl space-y-6">
      <div id="admin-phone-booking-top">
        <AdminPhoneBookingProgress step={step} />
      </div>

      {draftNotice ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50/80 px-4 py-3 text-sm text-brand-950">
          <p>{draftNotice}</p>
          <button
            type="button"
            onClick={handleDiscardDraft}
            className="shrink-0 rounded-lg border border-brand-300 bg-white px-3 py-1.5 text-xs font-semibold text-brand-900 hover:bg-brand-50"
          >
            Discard draft
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
                  onChange={setWizard}
                  quoteRef={effectiveQuoteRef}
                  serviceType={serviceType}
                  serviceTypeOptions={[...SERVICE_TYPES]}
                  onServiceTypeChange={setServiceType}
                />
              </AdminSection>
              <AdminSection
                title="Access details"
                description="Parking, walking distance, stairs and access notes — affect pricing."
              >
                <AdminAccessDetailsSection data={wizard} onChange={setWizard} />
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
                  onLinesChange={(inventoryLines) => setWizard((w) => ({ ...w, inventoryLines }))}
                  customSizeM3={settings?.customSizeM3}
                  crewSize={wizard.crewSize}
                  onCrewSizeChange={(crewSize) => setWizard((w) => ({ ...w, crewSize }))}
                  crewSettings={settings}
                  crewRestrictions={crewRestrictions}
                  quoteRef={effectiveQuoteRef}
                  data={wizard}
                  onChange={setWizard}
                />
              )}
            </AdminSection>
          ) : null}

          {step === 3 ? (
            <>
              <AdminSection
                title="Step 3 — Contacts, extras & price"
                description="Pickup/delivery contacts, packing, dismantling, address confirmation."
              >
                <Step3Details
                  data={wizard}
                  onChange={setWizard}
                  pricingSettings={settings}
                  onGoToStep={(n) => goToStep(Math.min(3, Math.max(1, Number(n) || 1)))}
                  quoteRef={effectiveQuoteRef}
                  hideContactSection
                />
              </AdminSection>

              <div className="lg:hidden">{priceReviewPanel}</div>

              <AdminSection
                title="Admin override"
                description="Optional manual final price. Customer pays later — no Stripe checkout."
              >
                <div className="space-y-4">
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3">
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
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3">
                    <input
                      type="radio"
                      name="price_mode"
                      checked={!useCalculatedPrice}
                      onChange={() => setUseCalculatedPrice(false)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">Custom final price</span>
                      <span className="block text-xs text-slate-600">
                        Original calculated: {calculatedDisplay}
                      </span>
                    </span>
                  </label>
                  {!useCalculatedPrice ? (
                    <div>
                      <label className={labelClass} htmlFor="apb-final-price">
                        Final price (£) <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="apb-final-price"
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
                  <div>
                    <label className={labelClass} htmlFor="apb-override-reason">
                      Discount / override reason
                    </label>
                    <input
                      id="apb-override-reason"
                      className={inputClass}
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="e.g. matched competitor, loyalty discount"
                    />
                  </div>
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
                  clearAdminPhoneBookingDraft()
                  const fresh = freshAdminPhoneBookingFormState()
                  setWizard(fresh.wizard)
                  setServiceType(fresh.serviceType)
                  setQuoteRef(fresh.quoteRef)
                  setCustomQuoteRef(fresh.customQuoteRef)
                  setUseCalculatedPrice(fresh.useCalculatedPrice)
                  setFinalPriceOverride(fresh.finalPriceOverride)
                  setOverrideReason(fresh.overrideReason)
                  setAdminNote(fresh.adminNote)
                  setStep(fresh.step)
                  setDraftNotice('')
                  setError('')
                }}
              >
                Clear form
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
                  type="submit"
                  disabled={submitting || loadingSettings}
                  className="inline-flex min-h-[48px] items-center rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-brand-700 disabled:opacity-60"
                >
                  {submitting ? 'Creating…' : 'Create phone booking'}
                </button>
              )}
            </div>
          </div>
        </div>

        <aside className="hidden w-full min-w-0 shrink-0 lg:block lg:w-[min(100%,340px)]">
          <div className="sticky top-4 flex flex-col gap-4">
            <MoveSummary {...summaryProps} />
            {step === 3 ? priceReviewPanel : null}
          </div>
        </aside>
      </div>

      {step >= 2 ? (
        <div className="space-y-4 lg:hidden">
          <MoveSummary {...summaryProps} />
          {step === 3 ? priceReviewPanel : null}
        </div>
      ) : null}
    </form>
  )
}
