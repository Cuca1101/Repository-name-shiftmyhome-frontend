import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Step2Inventory from '../quote-wizard/steps/Step2Inventory'
import FloorSelect, { floorNeedsLiftQuestion } from '../quote-wizard/FloorSelect'
import AdminAccessDetailsSection from './AdminAccessDetailsSection'
import AdminQuotePriceBreakdown from './AdminQuotePriceBreakdown'
import { SERVICE_TYPES } from '../../constants/serviceTypes'
import { fetchPricingSettings } from '../../lib/data/pricingSettingsRepository'
import { onPricingSettingsUpdated } from '../../lib/pricingSettingsEvents'
import { calculateQuote } from '../../lib/pricingCalculator'
import { buildQuoteEngineInput } from '../../lib/buildQuoteEngineInput'
import { getQuoteCrewRestrictions } from '../../lib/crewPricingRules'
import {
  adminPhoneBookingErrorsByField,
  collectAdminPhoneBookingFieldErrors,
  resolveAdminPhoneBookingFinalPrice,
} from '../../lib/adminPhoneBooking'
import { isMoveDateOnOrAfterToday } from '../../lib/moveDateLocal'
import {
  HALF_HOUR_SLOTS_TO_20,
  halfHourSlotsAfter,
} from '../../lib/arrivalTimeSlots'
import {
  computeAdminEditBookingChanges,
  fetchBookingForAdminEdit,
  sendBookingUpdatedCustomerEmail,
  updateAdminBookingFromWizard,
} from '../../lib/adminEditBooking'
import { formatGbp } from '../../lib/adminAgreedPrice'
import { supabase } from '../../lib/supabase'
import { initialWizardState } from '../../lib/quoteWizardDefaults'
import { applyWizardPatch } from '../../lib/wizardStateUpdate'

const inputClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25'
const labelClass = 'block text-xs font-semibold uppercase tracking-wide text-slate-500'

function cloneWizard(wizard) {
  try {
    return structuredClone(wizard)
  } catch {
    return JSON.parse(JSON.stringify(wizard))
  }
}

function normalizeDateInputValue(raw) {
  const s = String(raw || '').trim()
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : ''
}

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

function collectEditBookingFieldErrors(wizard, baselineWizard) {
  return collectAdminPhoneBookingFieldErrors(wizard, { requireAddressConfirmation: false }).filter(
    (e) => {
      if (e.field !== 'moveDate') return true
      if (!wizard.moveDate) return true
      const baselineDate = String(baselineWizard?.moveDate || '').trim()
      const currentDate = String(wizard.moveDate || '').trim()
      if (baselineDate && currentDate === baselineDate && !isMoveDateOnOrAfterToday(currentDate)) {
        return false
      }
      return true
    },
  )
}

function LiftYesNo({ label, name, value, onChange }) {
  return (
    <fieldset>
      <legend className={labelClass}>{label}</legend>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
          <input
            type="radio"
            name={name}
            checked={value === true}
            onChange={() => onChange(true)}
          />
          Yes
        </label>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
          <input
            type="radio"
            name={name}
            checked={value === false}
            onChange={() => onChange(false)}
          />
          No
        </label>
      </div>
    </fieldset>
  )
}

/**
 * Dedicated admin Edit Booking form — not the phone-booking wizard.
 * @param {{
 *   quoteId: string,
 *   backHref?: string,
 *   backLabel?: string,
 *   onSaved?: (result: { id: string, quote_ref: string }) => void,
 * }} props
 */
export default function AdminEditBookingForm({
  quoteId,
  backHref = '/admin/available-jobs',
  backLabel = 'Back to job',
  onSaved,
}) {
  const [wizard, setWizard] = useState(() => initialWizardState())
  const [baselineWizard, setBaselineWizard] = useState(() => initialWizardState())
  const [baselinePrice, setBaselinePrice] = useState(/** @type {number | null} */ (null))
  const [baselineServiceType, setBaselineServiceType] = useState(SERVICE_TYPES[0])
  const [existing, setExisting] = useState(/** @type {Record<string, unknown> | null} */ (null))
  const [serviceType, setServiceType] = useState(SERVICE_TYPES[0])
  const [quoteRef, setQuoteRef] = useState('')
  const [settings, setSettings] = useState(null)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [useCalculatedPrice, setUseCalculatedPrice] = useState(true)
  const [finalPriceOverride, setFinalPriceOverride] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [adminNote, setAdminNote] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [emailBusy, setEmailBusy] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState(/** @type {Record<string, string>} */ ({}))
  const [saveResult, setSaveResult] = useState(
    /** @type {{ id: string, quote_ref: string, changeSetId: string, changes: Array<{label:string,previous:string,next:string}>, email?: string } | null} */ (
      null
    ),
  )
  const [emailStatus, setEmailStatus] = useState(
    /** @type {{ state: 'idle' | 'sent' | 'failed' | 'skipped', message: string } } */ ({
      state: 'idle',
      message: '',
    }),
  )
  const pristineRef = useRef(true)

  function markEdited() {
    pristineRef.current = false
  }

  const patchWizard = useCallback((patch) => {
    markEdited()
    applyWizardPatch(setWizard, patch)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingEdit(true)
      setError('')
      pristineRef.current = true
      try {
        const loaded = await fetchBookingForAdminEdit(quoteId)
        if (cancelled) return
        const w = {
          ...loaded.wizard,
          moveDate: normalizeDateInputValue(loaded.wizard.moveDate),
          pickupAddressConfirmed: true,
          deliveryAddressConfirmed: true,
        }
        setExisting(loaded.existing)
        setWizard(w)
        setBaselineWizard(cloneWizard(w))
        setBaselinePrice(loaded.baselinePrice ?? null)
        setBaselineServiceType(loaded.serviceType)
        setServiceType(loaded.serviceType)
        setQuoteRef(loaded.quote_ref)
        setUseCalculatedPrice(loaded.useCalculatedPrice)
        setFinalPriceOverride(loaded.finalPriceOverride || '')
        setOverrideReason(loaded.overrideReason || '')
        setAdminNote(loaded.adminNote || '')
        setConfirmOpen(false)
        setSaveResult(null)
        setEmailStatus({ state: 'idle', message: '' })
        pristineRef.current = true
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Could not load booking for edit.')
      } finally {
        if (!cancelled) setLoadingEdit(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [quoteId])

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

  const lineItems = useMemo(
    () =>
      (wizard.inventoryLines || []).map((l) => ({
        name: l.name,
        quantity: l.quantity,
        volumePerUnitM3: l.m3,
        handlingMultiplier: Number.isFinite(Number(l.mult)) && Number(l.mult) > 0 ? Number(l.mult) : 1,
        weightType: l.weightType,
        heavyFee: l.heavyFee,
        appliesHeavyHandlingFee: l.heavyFee,
        isCustom: l.isCustom,
      })),
    [wizard.inventoryLines],
  )

  const heavyItemCount = useMemo(() => {
    let n = 0
    for (const l of wizard.inventoryLines || []) {
      if (l.weightType === 'heavy') n += l.quantity
    }
    return n
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

  const changePreview = useMemo(
    () =>
      computeAdminEditBookingChanges({
        baselineWizard,
        baselinePrice,
        baselineServiceType,
        wizard,
        serviceType,
        finalPrice: priceResolution.final,
      }),
    [
      baselineWizard,
      baselinePrice,
      baselineServiceType,
      wizard,
      serviceType,
      priceResolution.final,
    ],
  )

  useEffect(() => {
    if (!saveResult) return
    if (changePreview.hasChanges) {
      setSaveResult(null)
      setEmailStatus({ state: 'idle', message: '' })
    }
  }, [changePreview.hasChanges, saveResult])

  useEffect(() => {
    if (loadingEdit || !pristineRef.current || !settings) return
    // Keep wizard baseline in sync with auto-hydration, but never replace the
    // stored booking total with a live engine recalculation (paid jobs especially).
    setBaselineWizard(cloneWizard(wizard))
    setBaselineServiceType(serviceType)

    if (
      baselinePrice != null &&
      Number.isFinite(baselinePrice) &&
      priceResolution.calculated != null &&
      Number.isFinite(priceResolution.calculated) &&
      Math.abs(baselinePrice - priceResolution.calculated) > 0.009 &&
      useCalculatedPrice
    ) {
      // Customer already has a booking total — keep showing that until admin changes price mode.
      setUseCalculatedPrice(false)
      setFinalPriceOverride(Number(baselinePrice).toFixed(2))
    }
  }, [
    loadingEdit,
    settings,
    wizard,
    serviceType,
    baselinePrice,
    priceResolution.calculated,
    useCalculatedPrice,
  ])

  const untilSlots = halfHourSlotsAfter(wizard.flexibleArrivalFrom)
  const arrivalMode = wizard.arrivalWindow === 'exact' ? 'exact' : 'flex_window'

  function openConfirm() {
    setError('')
    const validationErrorList = collectEditBookingFieldErrors(wizard, baselineWizard)
    if (validationErrorList.length) {
      setFieldErrors(adminPhoneBookingErrorsByField(validationErrorList))
      setError(validationErrorList[0].message)
      return
    }
    setFieldErrors({})
    if (!breakdown) {
      setError('Pricing is not ready yet.')
      return
    }
    if (priceResolution.invalid) {
      setError('Enter a valid final price override, or use the calculated price.')
      return
    }
    if (!changePreview.hasChanges) {
      setError('No changes to save. Update a field first.')
      return
    }
    setConfirmOpen(true)
    window.requestAnimationFrame(() => {
      document.getElementById('admin-edit-booking-confirm')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })
  }

  async function notifyCustomer(result) {
    setEmailBusy(true)
    try {
      const data = await sendBookingUpdatedCustomerEmail({
        quoteId: result.id,
        changeSetId: result.changeSetId,
        changes: result.changes,
        quoteRef: result.quote_ref,
      })
      if (data?.skipped && data?.reason === 'already_sent') {
        setEmailStatus({
          state: 'sent',
          message: 'Customer email was already sent for these changes (duplicate skipped).',
        })
      } else if (data?.skipped) {
        setEmailStatus({
          state: 'skipped',
          message: data?.error || data?.reason || 'Customer email was skipped.',
        })
      } else {
        setEmailStatus({
          state: 'sent',
          message: `Customer notified at ${result.email || 'their email'}.`,
        })
      }
    } catch (err) {
      setEmailStatus({
        state: 'failed',
        message: err?.message || 'Booking saved, but the customer email failed.',
      })
    } finally {
      setEmailBusy(false)
    }
  }

  async function handleSaveAndNotify() {
    if (submitting || !existing) return
    setSubmitting(true)
    setError('')
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const editedBy = String(sessionData.session?.user?.email || '').trim() || 'admin'
      const saved = await updateAdminBookingFromWizard({
        quoteId,
        existing,
        wizard: {
          ...wizard,
          pickupAddressConfirmed: true,
          deliveryAddressConfirmed: true,
        },
        baselineWizard,
        baselinePrice,
        baselineServiceType,
        serviceType,
        breakdown,
        useCalculatedPrice,
        finalPrice: priceResolution.final,
        finalPriceOverride,
        overrideReason,
        adminNote,
        editedBy,
      })
      setSaveResult(saved)
      setBaselineWizard(cloneWizard(wizard))
      setBaselinePrice(priceResolution.final)
      setBaselineServiceType(serviceType)
      setConfirmOpen(false)
      onSaved?.(saved)
      await notifyCustomer(saved)
    } catch (err) {
      setError(err?.message || 'Could not save booking.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRetryEmail() {
    if (!saveResult || emailBusy || emailStatus.state === 'sent') return
    await notifyCustomer(saveResult)
  }

  const calculatedDisplay =
    priceResolution.calculated != null ? formatGbp(priceResolution.calculated) : '—'
  const finalDisplay =
    priceResolution.final != null ? formatGbp(priceResolution.final) : calculatedDisplay
  const baselineDisplay = baselinePrice != null ? formatGbp(baselinePrice) : '—'

  if (loadingEdit) {
    return (
      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        Loading booking for edit…
      </p>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <nav className="mb-2 flex flex-wrap items-center gap-2 text-sm">
          <Link to={backHref} className="font-semibold text-brand-700 hover:underline">
            ← {backLabel}
          </Link>
          <span className="text-slate-300">/</span>
          <span className="font-mono text-xs text-slate-600">{quoteRef || quoteId}</span>
        </nav>
        <h2 className="text-2xl font-bold text-slate-900">Edit booking</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Change any customer-facing detail below. Payments and booking reference stay the same. Price
          updates live from the pricing engine.
        </p>
      </div>

      {saveResult ? (
        <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-950">
          <p className="font-semibold">Booking {saveResult.quote_ref} saved successfully.</p>
          {emailStatus.state === 'sent' ? <p>{emailStatus.message}</p> : null}
          {emailStatus.state === 'failed' ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-950">
              <p className="flex-1">{emailStatus.message}</p>
              <button
                type="button"
                disabled={emailBusy}
                onClick={() => void handleRetryEmail()}
                className="rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800 disabled:opacity-60"
              >
                {emailBusy ? 'Retrying…' : 'Retry customer email'}
              </button>
            </div>
          ) : null}
          {emailStatus.state === 'skipped' ? <p className="text-slate-700">{emailStatus.message}</p> : null}
          <Link to={backHref} className="inline-block font-semibold text-brand-700 hover:underline">
            Return to job details
          </Link>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
          {error}
        </p>
      ) : null}

      <AdminSection title="Move date & arrival time" description="Change the booking date and preferred arrival.">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2 sm:max-w-xs">
            <span className={labelClass}>Move date</span>
            <input
              type="date"
              className={inputClass}
              value={normalizeDateInputValue(wizard.moveDate)}
              onChange={(e) => patchWizard({ moveDate: e.target.value })}
            />
            {fieldErrors.moveDate ? (
              <p className="mt-1 text-sm font-medium text-red-700">{fieldErrors.moveDate}</p>
            ) : null}
          </label>

          <div className="sm:col-span-2">
            <span className={labelClass}>Arrival</span>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  patchWizard({
                    arrivalWindow: 'flex_window',
                    exactArrivalTime: '',
                    flexibleArrivalFrom: wizard.flexibleArrivalFrom || '08:00',
                    flexibleArrivalUntil: wizard.flexibleArrivalUntil || '12:00',
                  })
                }
                className={`rounded-xl border px-3 py-3 text-left text-sm ${
                  arrivalMode === 'flex_window'
                    ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500/25'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <span className="block font-semibold text-slate-900">Flexible window</span>
                <span className="mt-0.5 block text-xs text-slate-500">Collection between two times</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  patchWizard({
                    arrivalWindow: 'exact',
                    flexibleArrivalFrom: '',
                    flexibleArrivalUntil: '',
                    exactArrivalTime: wizard.exactArrivalTime || '09:00',
                  })
                }
                className={`rounded-xl border px-3 py-3 text-left text-sm ${
                  arrivalMode === 'exact'
                    ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500/25'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <span className="block font-semibold text-slate-900">Exact time</span>
                <span className="mt-0.5 block text-xs text-slate-500">Specific arrival (premium)</span>
              </button>
            </div>

            {arrivalMode === 'flex_window' ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>From</span>
                  <select
                    className={inputClass}
                    value={wizard.flexibleArrivalFrom || ''}
                    onChange={(e) => {
                      const from = e.target.value
                      const patch = { flexibleArrivalFrom: from, arrivalWindow: 'flex_window' }
                      if (
                        wizard.flexibleArrivalUntil &&
                        from &&
                        !halfHourSlotsAfter(from).includes(wizard.flexibleArrivalUntil)
                      ) {
                        patch.flexibleArrivalUntil = ''
                      }
                      patchWizard(patch)
                    }}
                  >
                    <option value="">Select…</option>
                    {HALF_HOUR_SLOTS_TO_20.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={labelClass}>Until</span>
                  <select
                    className={inputClass}
                    value={wizard.flexibleArrivalUntil || ''}
                    onChange={(e) =>
                      patchWizard({
                        flexibleArrivalUntil: e.target.value,
                        arrivalWindow: 'flex_window',
                      })
                    }
                  >
                    <option value="">Select…</option>
                    {untilSlots.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : (
              <label className="mt-3 block max-w-xs">
                <span className={labelClass}>Exact arrival time</span>
                <select
                  className={inputClass}
                  value={wizard.exactArrivalTime || ''}
                  onChange={(e) =>
                    patchWizard({ exactArrivalTime: e.target.value, arrivalWindow: 'exact' })
                  }
                >
                  <option value="">Select…</option>
                  {HALF_HOUR_SLOTS_TO_20.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {fieldErrors.arrivalWindow ? (
              <p className="mt-2 text-sm font-medium text-red-700">{fieldErrors.arrivalWindow}</p>
            ) : null}
          </div>
        </div>
      </AdminSection>

      <AdminSection title="Addresses" description="Collection and delivery addresses.">
        <div className="grid gap-4">
          <label className="block">
            <span className={labelClass}>Collection address</span>
            <textarea
              rows={2}
              className={`${inputClass} min-h-[72px] resize-y`}
              value={wizard.pickupAddress || ''}
              onChange={(e) => patchWizard({ pickupAddress: e.target.value })}
            />
            {fieldErrors.pickupAddress ? (
              <p className="mt-1 text-sm font-medium text-red-700">{fieldErrors.pickupAddress}</p>
            ) : null}
          </label>
          <label className="block">
            <span className={labelClass}>Delivery address</span>
            <textarea
              rows={2}
              className={`${inputClass} min-h-[72px] resize-y`}
              value={wizard.deliveryAddress || ''}
              onChange={(e) => patchWizard({ deliveryAddress: e.target.value })}
            />
            {fieldErrors.deliveryAddress ? (
              <p className="mt-1 text-sm font-medium text-red-700">{fieldErrors.deliveryAddress}</p>
            ) : null}
          </label>
          <label className="block max-w-xs">
            <span className={labelClass}>Distance (miles)</span>
            <input
              type="number"
              min="0"
              step="0.1"
              className={inputClass}
              value={wizard.distanceMiles === 0 ? '' : wizard.distanceMiles ?? ''}
              onChange={(e) => {
                const v = e.target.value
                patchWizard({
                  distanceMiles: v === '' ? 0 : parseFloat(v) || 0,
                })
              }}
            />
            {fieldErrors.distanceMiles ? (
              <p className="mt-1 text-sm font-medium text-red-700">{fieldErrors.distanceMiles}</p>
            ) : null}
          </label>
        </div>
      </AdminSection>

      <AdminSection title="Floors & lifts">
        <div className="grid gap-4 sm:grid-cols-2">
          <FloorSelect
            label="Collection floor"
            value={wizard.pickupFloor}
            onChange={(v) =>
              patchWizard(
                floorNeedsLiftQuestion(v)
                  ? { pickupFloor: v }
                  : { pickupFloor: v, pickupLift: null },
              )
            }
          />
          {floorNeedsLiftQuestion(wizard.pickupFloor) ? (
            <LiftYesNo
              label="Lift at collection"
              name="edit-pickup-lift"
              value={wizard.pickupLift}
              onChange={(v) => patchWizard({ pickupLift: v })}
            />
          ) : null}
          <FloorSelect
            label="Delivery floor"
            value={wizard.deliveryFloor}
            onChange={(v) =>
              patchWizard(
                floorNeedsLiftQuestion(v)
                  ? { deliveryFloor: v }
                  : { deliveryFloor: v, deliveryLift: null },
              )
            }
          />
          {floorNeedsLiftQuestion(wizard.deliveryFloor) ? (
            <LiftYesNo
              label="Lift at delivery"
              name="edit-delivery-lift"
              value={wizard.deliveryLift}
              onChange={(v) => patchWizard({ deliveryLift: v })}
            />
          ) : null}
        </div>
      </AdminSection>

      <AdminSection title="Parking, walking & stairs">
        <AdminAccessDetailsSection
          data={wizard}
          onChange={(next) => {
            markEdited()
            setWizard((prev) => (typeof next === 'function' ? next(prev) : { ...prev, ...next }))
          }}
        />
      </AdminSection>

      <AdminSection title="Customer & contacts">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className={labelClass}>Customer name</span>
            <input
              className={inputClass}
              value={wizard.fullName || ''}
              onChange={(e) => patchWizard({ fullName: e.target.value })}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Email</span>
            <input
              type="email"
              className={inputClass}
              value={wizard.email || ''}
              onChange={(e) => patchWizard({ email: e.target.value })}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Phone</span>
            <input
              className={inputClass}
              value={wizard.phone || ''}
              onChange={(e) => patchWizard({ phone: e.target.value })}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Pickup contact name</span>
            <input
              className={inputClass}
              value={wizard.pickupContactName || ''}
              onChange={(e) => patchWizard({ pickupContactName: e.target.value })}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Pickup contact phone</span>
            <input
              className={inputClass}
              value={wizard.pickupContactPhone || ''}
              onChange={(e) => patchWizard({ pickupContactPhone: e.target.value })}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Delivery contact name</span>
            <input
              className={inputClass}
              value={wizard.deliveryContactName || ''}
              onChange={(e) => patchWizard({ deliveryContactName: e.target.value })}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Delivery contact phone</span>
            <input
              className={inputClass}
              value={wizard.deliveryContactPhone || ''}
              onChange={(e) => patchWizard({ deliveryContactPhone: e.target.value })}
            />
          </label>
        </div>
      </AdminSection>

      <AdminSection
        title="Items & movers"
        description="Add, remove or change quantities. Price updates automatically."
      >
        <label className="mb-4 block max-w-xs">
          <span className={labelClass}>Service type</span>
          <select
            className={inputClass}
            value={serviceType}
            onChange={(e) => {
              markEdited()
              setServiceType(e.target.value)
            }}
          >
            {SERVICE_TYPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        {loadingSettings ? (
          <p className="text-sm text-slate-600">Loading pricing settings…</p>
        ) : (
          <Step2Inventory
            layoutVariant="admin"
            lines={wizard.inventoryLines}
            onLinesChange={(inventoryLines) => patchWizard({ inventoryLines })}
            customSizeM3={settings?.customSizeM3}
            crewSize={wizard.crewSize}
            onCrewSizeChange={(crewSize) => patchWizard({ crewSize })}
            crewSettings={settings}
            crewRestrictions={crewRestrictions}
            pricingSettings={settings}
            breakdown={breakdown}
            priceWithoutPromo={priceWithoutPromo}
            quoteRef={quoteRef}
            data={wizard}
            onChange={(next) => {
              markEdited()
              setWizard((prev) => (typeof next === 'function' ? next(prev) : { ...prev, ...next }))
            }}
          />
        )}
        {fieldErrors.inventoryLines ? (
          <p className="mt-2 text-sm font-medium text-red-700">{fieldErrors.inventoryLines}</p>
        ) : null}
      </AdminSection>

      <AdminSection title="Service options & instructions">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={Boolean(wizard.packing)}
              onChange={(e) => patchWizard({ packing: e.target.checked })}
            />
            Packing service
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={Boolean(wizard.packingMaterials)}
              onChange={(e) => patchWizard({ packingMaterials: e.target.checked })}
            />
            Packing materials
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={Boolean(wizard.dismantling)}
              onChange={(e) => patchWizard({ dismantling: e.target.checked })}
            />
            Dismantling
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={Boolean(wizard.reassembly)}
              onChange={(e) => patchWizard({ reassembly: e.target.checked })}
            />
            Reassembly
          </label>
          {wizard.packing ? (
            <label className="block sm:col-span-2">
              <span className={labelClass}>Packing details</span>
              <input
                className={inputClass}
                value={wizard.packingWhat || ''}
                onChange={(e) => patchWizard({ packingWhat: e.target.value })}
              />
            </label>
          ) : null}
          {wizard.dismantling ? (
            <label className="block sm:col-span-2">
              <span className={labelClass}>Dismantling details</span>
              <input
                className={inputClass}
                value={wizard.dismantlingWhat || ''}
                onChange={(e) => patchWizard({ dismantlingWhat: e.target.value })}
              />
            </label>
          ) : null}
          {wizard.reassembly ? (
            <label className="block sm:col-span-2">
              <span className={labelClass}>Reassembly details</span>
              <input
                className={inputClass}
                value={wizard.reassemblyWhat || ''}
                onChange={(e) => patchWizard({ reassemblyWhat: e.target.value })}
              />
            </label>
          ) : null}
          <label className="block sm:col-span-2">
            <span className={labelClass}>Booking instructions (customer-facing)</span>
            <textarea
              rows={3}
              className={`${inputClass} min-h-[80px] resize-y`}
              value={wizard.specialInstructions || ''}
              onChange={(e) => patchWizard({ specialInstructions: e.target.value })}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className={labelClass}>Admin note (internal — not emailed)</span>
            <textarea
              rows={2}
              className={`${inputClass} min-h-[72px] resize-y`}
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
            />
          </label>
        </div>
      </AdminSection>

      <AdminSection
        title="Price"
        description="Keeps the booking total the customer already has. Switch to calculated only if you want the engine to replace it."
      >
        <div className="mb-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
          <p>
            Booking total (current):{' '}
            <span className="font-semibold tabular-nums">{baselineDisplay}</span>
            {Number(existing?.amount_paid) > 0 ? (
              <span className="ml-2 text-xs text-slate-500">
                (paid {formatGbp(Number(existing.amount_paid))}
                {String(existing.payment_status || '')
                  .toLowerCase()
                  .includes('paid')
                  ? ` · ${String(existing.payment_status).replace(/_/g, ' ')}`
                  : ''}
                )
              </span>
            ) : null}
          </p>
          <p>
            Engine recalculated:{' '}
            <span className="font-semibold tabular-nums">{calculatedDisplay}</span>
            <span className="mx-2 text-slate-300">·</span>
            Total after edit:{' '}
            <span className="font-semibold tabular-nums text-emerald-700">{finalDisplay}</span>
          </p>
        </div>
        <div className="space-y-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3">
            <input
              type="radio"
              name="edit_price_mode"
              checked={useCalculatedPrice}
              onChange={() => {
                markEdited()
                setUseCalculatedPrice(true)
              }}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">
                Use newly calculated price
              </span>
              <span className="block text-xs text-slate-600">
                Replace the booking total with {calculatedDisplay}
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3">
            <input
              type="radio"
              name="edit_price_mode"
              checked={!useCalculatedPrice}
              onChange={() => {
                markEdited()
                setUseCalculatedPrice(false)
                if (!finalPriceOverride && baselinePrice != null) {
                  setFinalPriceOverride(Number(baselinePrice).toFixed(2))
                }
              }}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">
                Keep / set booking total
              </span>
              <span className="block text-xs text-slate-600">
                Recommended when the customer has already paid — default is the current booking total.
              </span>
            </span>
          </label>
          {!useCalculatedPrice ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Final price (£)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputClass}
                  value={finalPriceOverride}
                  onChange={(e) => {
                    markEdited()
                    setFinalPriceOverride(e.target.value)
                  }}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Override reason (internal)</span>
                <input
                  className={inputClass}
                  value={overrideReason}
                  onChange={(e) => {
                    markEdited()
                    setOverrideReason(e.target.value)
                  }}
                />
              </label>
            </div>
          ) : null}
        </div>
        {breakdown ? (
          <div className="mt-4">
            <AdminQuotePriceBreakdown
              breakdown={breakdown}
              serviceType={serviceType}
              wizard={wizard}
              crewSettings={settings}
              compact
            />
          </div>
        ) : null}
      </AdminSection>

      {confirmOpen ? (
        <section
          id="admin-edit-booking-confirm"
          className="rounded-2xl border border-brand-200 bg-brand-50/40 p-5 shadow-sm sm:p-6"
        >
          <h3 className="text-sm font-bold text-slate-900">Confirm changes</h3>
          <p className="mt-1 text-xs text-slate-600">
            Only these fields will be emailed to the customer, with booking reference {quoteRef}.
          </p>
          <ul className="mt-4 divide-y divide-slate-200/80 rounded-xl border border-slate-200 bg-white">
            {changePreview.changes.map((c, i) => (
              <li key={`${c.label}-${i}`} className="px-4 py-3 text-sm">
                <p className="font-semibold text-slate-900">{c.label}</p>
                <p className="mt-1 text-slate-600">
                  <span className="text-slate-500">{c.previous}</span>
                  <span className="mx-2 text-slate-300">→</span>
                  <span className="font-medium text-slate-900">{c.next}</span>
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleSaveAndNotify()}
              className="inline-flex min-h-[48px] items-center rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-brand-700 disabled:opacity-60"
            >
              {submitting ? 'Saving…' : 'Save changes and notify customer'}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => setConfirmOpen(false)}
              className="inline-flex min-h-[48px] items-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Keep editing
            </button>
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 pb-8">
        <Link
          to={backHref}
          className="inline-flex min-h-[48px] items-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Cancel
        </Link>
        {!confirmOpen ? (
          <button
            type="button"
            disabled={loadingSettings || Boolean(saveResult)}
            onClick={openConfirm}
            className="inline-flex min-h-[48px] items-center rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-brand-700 disabled:opacity-60"
          >
            Review changes
          </button>
        ) : null}
        {changePreview.hasChanges ? (
          <p className="w-full text-xs text-slate-500 sm:w-auto">
            {changePreview.changes.length} pending change
            {changePreview.changes.length === 1 ? '' : 's'}
          </p>
        ) : null}
      </div>
    </div>
  )
}
