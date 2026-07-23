import { useCallback, useEffect, useMemo, useState } from 'react'
import { PACKING_MATERIALS_CATALOG } from '../lib/packingMaterialsCatalog'
import { SERVICE_TYPES } from '../constants/serviceTypes'
import { VOLUME_MULTIPLIER_BANDS } from '../lib/volumePricingMultiplier'
import { fetchPricingSettings, savePricingSettings } from '../lib/data/pricingSettingsRepository'
import { getDefaultPricingSettings } from '../lib/defaultPricingSettings'
import { labelForPricingSettingKey } from '../lib/pricingEngineFieldLabels'
import DriverAppExtraChargePricingPanel from './admin/DriverAppExtraChargePricingPanel'
import { listUpcomingScottishBankHolidays } from '../lib/ukBankHolidays'

/** Do not calculate pricing in UI components. Use shared pricing engine only. */

function Field({ label, children, helper }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {helper ? <p className="mb-2 text-xs leading-relaxed text-slate-500">{helper}</p> : null}
      {children}
    </label>
  )
}

export default function PricingEngineAdmin() {
  const [settings, setSettings] = useState(() => getDefaultPricingSettings())
  const fallbackDefaults = getDefaultPricingSettings()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  /** @type {[string[], (keys: string[]) => void]} */
  const [missingDbKeys, setMissingDbKeys] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchPricingSettings({ includeMissingKeys: true })
      if (result && typeof result === 'object' && 'settings' in result) {
        setSettings(result.settings)
        setMissingDbKeys(result.missingKeys || [])
      } else {
        setSettings(result)
        setMissingDbKeys([])
      }
    } catch (e) {
      setMessage({ type: 'error', text: e?.message || 'Failed to load settings.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function setNum(key, value) {
    const n = parseFloat(value)
    setSettings((prev) => ({ ...prev, [key]: Number.isFinite(n) ? n : 0 }))
  }

  function setBase(service, value) {
    const n = parseFloat(value)
    setSettings((prev) => ({
      ...prev,
      basePriceByService: {
        ...prev.basePriceByService,
        [service]: Number.isFinite(n) ? n : 0,
      },
    }))
  }

  function setDisplayPrice(service, value) {
    const trimmed = String(value).trim()
    const n = parseFloat(trimmed)
    setSettings((prev) => {
      const next = { ...(prev.displayPriceByService || {}) }
      if (trimmed === '' || !Number.isFinite(n) || n <= 0) {
        delete next[service]
      } else {
        next[service] = n
      }
      return { ...prev, displayPriceByService: next }
    })
  }

  function displayPriceInputValue(service) {
    const map = settings.displayPriceByService
    if (!map || !Object.prototype.hasOwnProperty.call(map, service)) return ''
    const v = map[service]
    return typeof v === 'number' && Number.isFinite(v) ? String(v) : ''
  }

  function setCustomSize(key, value) {
    const n = parseFloat(value)
    setSettings((prev) => ({
      ...prev,
      customSizeM3: {
        ...prev.customSizeM3,
        [key]: Number.isFinite(n) ? n : 0,
      },
    }))
  }

  function setBool(key, checked) {
    setSettings((prev) => ({ ...prev, [key]: Boolean(checked) }))
  }

  const PROMO_SLOTS = 5

  /** @param {import('../lib/pricingCalculator.js').PricingSettings} src */
  function promoRowsFrom(src) {
    const rows = [...(src.promoCodes || [])]
    while (rows.length < PROMO_SLOTS) {
      rows.push({ code: '', discountType: 'percentage', discountValue: 0 })
    }
    return rows.slice(0, PROMO_SLOTS)
  }

  const promoDisplayRows = promoRowsFrom(settings)

  const upcomingBankHolidays = useMemo(() => listUpcomingScottishBankHolidays(6), [])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setMessage({ type: '', text: '' })
    try {
      const toSave = {
        ...settings,
        promoCodes: (settings.promoCodes || []).filter((r) => String(r.code || '').trim().length > 0),
      }
      await savePricingSettings(toSave)
      const reloaded = await fetchPricingSettings({ includeMissingKeys: true })
      if (reloaded && typeof reloaded === 'object' && 'settings' in reloaded) {
        setSettings(reloaded.settings)
        setMissingDbKeys(reloaded.missingKeys || [])
      } else {
        setSettings(reloaded)
        setMissingDbKeys([])
      }
      setMessage({ type: 'success', text: 'Your pricing engine was saved successfully.' })
    } catch (err) {
      setMessage({
        type: 'error',
        text: 'Pricing engine could not be saved. Please try again.',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-slate-600">Loading pricing settings…</p>
  }

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30'
  const displayInputClass =
    'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Pricing Engine</h2>
        <p className="mt-1 text-sm text-slate-600">
          All website quotes use these values. Adjust anytime — no code deploy required.
        </p>
      </div>

      {message.text && (
        <div
          role="alert"
          className={`rounded-xl border px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {message.text}
        </div>
      )}

      {missingDbKeys.length > 0 ? (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          <p className="font-semibold">Some saved settings were missing — defaults are shown until you Save</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-900/90">
            These fields were not in your database record and are using built-in fallbacks in quotes until you save
            again:{' '}
            {missingDbKeys.map((k) => labelForPricingSettingKey(k)).join(', ')}.
          </p>
        </div>
      ) : null}

      <form onSubmit={handleSave} className="space-y-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <h3 className="text-lg font-semibold text-slate-900">Minimum service threshold per service type</h3>
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              checked={Boolean(settings.basePricePerMan)}
              onChange={(e) => setBool('basePricePerMan', e.target.checked)}
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">Base price is per crew member</span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-600">
                Legacy admin option — kept for compatibility. Quote calculations use a flat service minimum threshold
                plus per-crew base thresholds; this toggle no longer multiplies the service threshold by crew size.
              </span>
            </span>
          </label>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Homepage display prices only change the service card &ldquo;From £&hellip;&rdquo; text. They do not affect
            quote calculations. Minimum service thresholds below are floors applied only when the calculated quote
            subtotal (after volume scaling) is lower.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICE_TYPES.map((s) => (
              <div
                key={s}
                className="rounded-xl border border-slate-100 bg-slate-50/50 p-4"
              >
                <p className="text-sm font-semibold text-slate-900">{s}</p>
                <label className="mt-3 block">
                  <span className="text-xs font-medium text-slate-700">Minimum service threshold</span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">
                    Floor for small jobs (with crew base thresholds) — not hard-added when quote is higher
                  </span>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-slate-500">£</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className={inputClass}
                      value={settings.basePriceByService?.[s] ?? 0}
                      onChange={(e) => setBase(s, e.target.value)}
                    />
                  </div>
                </label>
                <label className="mt-3 block">
                  <span className="text-xs font-medium text-slate-600">Homepage display price</span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">Card &ldquo;From £&hellip;&rdquo; only — never used in quotes</span>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-sm text-slate-400">£</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="—"
                      className={displayInputClass}
                      value={displayPriceInputValue(s)}
                      onChange={(e) => setDisplayPrice(s, e.target.value)}
                    />
                  </div>
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <h3 className="text-lg font-semibold text-slate-900">Distance, volume & minimum</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Price per mile (£)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.pricePerMile}
                onChange={(e) => setNum('pricePerMile', e.target.value)}
              />
            </Field>
            <Field label="Price per cubic metre (£)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.pricePerCubicMetre}
                onChange={(e) => setNum('pricePerCubicMetre', e.target.value)}
              />
            </Field>
            <Field label="Minimum job price — fallback (£)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.minimumJobPrice}
                onChange={(e) => setNum('minimumJobPrice', e.target.value)}
              />
            </Field>
            <Field label="Minimum — 1 Man (£)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.minimumJobPriceOneMan ?? settings.minimumJobPrice ?? 0}
                onChange={(e) => setNum('minimumJobPriceOneMan', e.target.value)}
              />
            </Field>
            <Field label="Minimum — 2 Men (£)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.minimumJobPriceTwoMen ?? settings.minimumJobPrice ?? 0}
                onChange={(e) => setNum('minimumJobPriceTwoMen', e.target.value)}
              />
            </Field>
            <Field label="Minimum — 3+ Men (£)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.minimumJobPriceThreeMen ?? settings.minimumJobPrice ?? 0}
                onChange={(e) => setNum('minimumJobPriceThreeMen', e.target.value)}
              />
            </Field>
          </div>
          <p className="mt-2 text-xs text-slate-600">
            Per-crew minimums prevent 1 Man and 2 Men collapsing to the same price on short jobs. Mileage and fuel are
            never multiplied by crew size.
          </p>
          <div className="mt-6 border-t border-slate-100 pt-6">
            <h4 className="text-sm font-semibold text-slate-900">Fuel surcharge</h4>
            <p className="mt-1 text-xs text-slate-600">
              Added in addition to price per mile (distance × fuel rate). Disabled or £0 per mile = no charge.
            </p>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600"
                checked={Boolean(settings.fuelSurchargeEnabled)}
                onChange={(e) => setBool('fuelSurchargeEnabled', e.target.checked)}
              />
              Enable fuel surcharge
            </label>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Fuel surcharge per mile (£)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputClass}
                  value={settings.fuelSurchargePerMile ?? 0}
                  onChange={(e) => setNum('fuelSurchargePerMile', e.target.value)}
                />
              </Field>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <h3 className="text-lg font-semibold text-slate-900">Volume scaling multipliers</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Applied to the calculated quote subtotal (after surcharges, before discounts). Band boundaries are fixed;
            only the multiplier values are editable here. Does not affect homepage display prices or minimum thresholds.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...VOLUME_MULTIPLIER_BANDS].reverse().map((band) => (
              <Field
                key={band.key}
                label={`${band.bandLabel} multiplier`}
                helper={`Default fallback: ×${fallbackDefaults[band.key] ?? 1}`}
              >
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className={inputClass}
                  value={settings[band.key] ?? fallbackDefaults[band.key] ?? 1}
                  onChange={(e) => setNum(band.key, e.target.value)}
                />
              </Field>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <h3 className="text-lg font-semibold text-slate-900">Access charges</h3>
          <p className="mt-1 text-sm text-slate-600">
            Used on the quote form for floors, lift access, stairs, parking, and heavy items.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Floor charge per floor (£)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.floorChargePerFloor ?? 0}
                onChange={(e) => setNum('floorChargePerFloor', e.target.value)}
              />
            </Field>
            <Field label="No lift charge (£)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.noLiftCharge ?? 0}
                onChange={(e) => setNum('noLiftCharge', e.target.value)}
              />
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                One-off supplement per end when the customer is above ground floor and selects lift{' '}
                <strong className="font-medium text-slate-700">No</strong>. Not applied on ground floor.
              </p>
            </Field>
            <Field label="Yes lift charge per end (£)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.yesLiftChargePerEnd ?? 0}
                onChange={(e) => setNum('yesLiftChargePerEnd', e.target.value)}
              />
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                Per end when floor is above ground and customer explicitly selects lift{' '}
                <strong className="font-medium text-slate-700">Yes</strong>. £0 = disabled.
              </p>
            </Field>
            <Field label="Stairs charge per flight (£)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.stairsChargePerFlight ?? 0}
                onChange={(e) => setNum('stairsChargePerFlight', e.target.value)}
              />
            </Field>
            <Field label="Long walking distance (£)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.longWalkingDistanceCharge}
                onChange={(e) => setNum('longWalkingDistanceCharge', e.target.value)}
              />
            </Field>
            <Field label="Parking charge (£)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.parkingCharge}
                onChange={(e) => setNum('parkingCharge', e.target.value)}
              />
            </Field>
            <Field label="Heavy item handling per item (£)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.heavyItemHandlingCharge}
                onChange={(e) => setNum('heavyItemHandlingCharge', e.target.value)}
              />
            </Field>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-brand-200 bg-gradient-to-br from-brand-50/60 to-white p-6 shadow-card">
          <h3 className="text-lg font-semibold text-slate-900">Calendar peak dates (quote wizard)</h3>
          <p className="mt-1 text-sm text-slate-600">
            These percentages change the price shown on each date in the Step 3 calendar — like airline
            peak-day pricing. Set to 0 to disable a rule.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Same day booking surcharge (%)">
              <input
                type="number"
                step="0.1"
                min="0"
                className={inputClass}
                value={settings.sameDaySurchargePercent}
                onChange={(e) => setNum('sameDaySurchargePercent', e.target.value)}
              />
            </Field>
            <Field label="Saturday surcharge (%)">
              <input
                type="number"
                step="0.1"
                min="0"
                className={inputClass}
                value={settings.saturdaySurchargePercent ?? settings.weekendSurchargePercent ?? 0}
                onChange={(e) => setNum('saturdaySurchargePercent', e.target.value)}
              />
            </Field>
            <Field label="Sunday surcharge (%)">
              <input
                type="number"
                step="0.1"
                min="0"
                className={inputClass}
                value={settings.sundaySurchargePercent ?? settings.weekendSurchargePercent ?? 0}
                onChange={(e) => setNum('sundaySurchargePercent', e.target.value)}
              />
            </Field>
            <Field label="Bank holiday surcharge (%) — Scottish bank holidays">
              <input
                type="number"
                step="0.1"
                min="0"
                className={inputClass}
                value={settings.bankHolidaySurchargePercent ?? fallbackDefaults.bankHolidaySurchargePercent ?? 0}
                onChange={(e) => setNum('bankHolidaySurchargePercent', e.target.value)}
              />
            </Field>
          </div>
          <div className="mt-4 rounded-xl border border-brand-100 bg-white/80 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Upcoming Scottish bank holidays
            </p>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {upcomingBankHolidays.map((h) => (
                <li key={h.date} className="flex flex-wrap gap-x-2 gap-y-0.5">
                  <span className="font-medium tabular-nums text-slate-900">{h.date}</span>
                  <span className="text-slate-600">{h.name}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Bank holiday surcharge replaces the Saturday/Sunday surcharge on the same day. Same-day
              surcharge still applies when the customer books for today.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <h3 className="text-lg font-semibold text-slate-900">Extras & surcharges</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Waiting time (£ per hour)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.waitingTimePricePerHour}
                onChange={(e) => setNum('waitingTimePricePerHour', e.target.value)}
              />
            </Field>
            <Field label="Extra helper (£ each)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.extraHelperPrice}
                onChange={(e) => setNum('extraHelperPrice', e.target.value)}
              />
            </Field>
            <Field label="Packing — price per box/item (£)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.packingPricePerBoxOrItem ?? settings.packingServicePrice ?? 0}
                onChange={(e) => setNum('packingPricePerBoxOrItem', e.target.value)}
              />
            </Field>
            <Field label="Dismantling — price per item (£)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.dismantlingPricePerItem ?? settings.dismantlingPrice ?? 0}
                onChange={(e) => setNum('dismantlingPricePerItem', e.target.value)}
              />
            </Field>
            <Field label="Reassembly — price per item (£)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.reassemblyPricePerItem ?? settings.reassemblyPrice ?? 0}
                onChange={(e) => setNum('reassemblyPricePerItem', e.target.value)}
              />
            </Field>
            <Field label="Fragile packing surcharge (£) — one-off when customer selects fragile">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.fragilePackingSurcharge ?? 0}
                onChange={(e) => setNum('fragilePackingSurcharge', e.target.value)}
              />
            </Field>
            <Field label="Packing materials fee (£) — one-off when materials required">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.packingMaterialsFee ?? 0}
                onChange={(e) => setNum('packingMaterialsFee', e.target.value)}
              />
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                Used only when per-item material pricing is off. When per-item is on, this flat fee is not applied.
              </p>
            </Field>
            <Field label="Exact arrival time premium (£)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.exactArrivalPremiumGbp}
                onChange={(e) => setNum('exactArrivalPremiumGbp', e.target.value)}
              />
            </Field>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <h3 className="text-lg font-semibold text-slate-900">Packing materials — per item</h3>
          <p className="mt-1 text-sm text-slate-600">
            When enabled with prices above £0, quote Step 3 material quantities are priced per line (flat packing
            materials fee is skipped).
          </p>
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
              checked={Boolean(settings.packingMaterialPerItemEnabled)}
              onChange={(e) => setBool('packingMaterialPerItemEnabled', e.target.checked)}
            />
            Enable per-item packing material pricing
          </label>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PACKING_MATERIALS_CATALOG.map((m) => {
              const adminLabel =
                m.id === 'bubble'
                  ? 'Bubble wrap (£ per 10m roll)'
                  : m.id === 'paper'
                    ? 'Packing paper (£ per 50-sheet pack)'
                    : m.id === 'tape'
                      ? 'Packing tape (£ per roll)'
                      : m.id === 'mattress'
                        ? 'Mattress cover (£ per cover)'
                        : `${m.label} (£ per box)`
              return (
                <Field key={m.id} label={adminLabel} helper={m.adminHelper}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={inputClass}
                    value={settings[m.priceKey] ?? 0}
                    onChange={(e) => setNum(m.priceKey, e.target.value)}
                  />
                </Field>
              )
            })}
            <Field
              label="Legacy moving boxes price (£ per box)"
              helper="Kept for older saved settings. Used as medium box price when medium price is £0."
            >
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.packingMaterialPriceBoxes ?? 0}
                onChange={(e) => setNum('packingMaterialPriceBoxes', e.target.value)}
              />
            </Field>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <h3 className="text-lg font-semibold text-slate-900">Reservation fee & promo codes</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Reservation fee (£)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.depositAmount}
                onChange={(e) => setNum('depositAmount', e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-500">
                Amount charged when customers choose &quot;Reserve your move&quot; on the online quote
                (Step 4). Stripe minimum is about £0.30.
              </p>
            </Field>
          </div>
          <div className="mt-6 border-t border-slate-100 pt-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600"
                checked={Boolean(settings.promoCodesEnabled)}
                onChange={(e) => setBool('promoCodesEnabled', e.target.checked)}
              />
              Enable promo codes on quote form
            </label>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Codes are validated against this list (loaded from admin settings). Server-side payment validation is
              recommended for production fraud protection.
            </p>
            <ul className="mt-4 space-y-3">
              {promoDisplayRows.map((row, i) => (
                <li
                  key={i}
                  className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3 sm:grid-cols-[1fr_auto_auto]"
                >
                  <input
                    type="text"
                    placeholder="CODE"
                    className={inputClass}
                    value={row.code || ''}
                    onChange={(e) =>
                      setSettings((prev) => {
                        const rows = promoRowsFrom(prev)
                        rows[i] = {
                          ...rows[i],
                          code: e.target.value,
                          discountType: rows[i].discountType || 'percentage',
                          discountValue: rows[i].discountValue ?? 0,
                        }
                        return {
                          ...prev,
                          promoCodes: rows,
                        }
                      })
                    }
                  />
                  <select
                    className={inputClass}
                    value={row.discountType === 'fixed' ? 'fixed' : 'percentage'}
                    onChange={(e) =>
                      setSettings((prev) => {
                        const rows = promoRowsFrom(prev)
                        rows[i] = {
                          ...rows[i],
                          discountType: e.target.value === 'fixed' ? 'fixed' : 'percentage',
                        }
                        return { ...prev, promoCodes: rows }
                      })
                    }
                  >
                    <option value="percentage">%</option>
                    <option value="fixed">£ fixed</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={inputClass}
                    value={row.discountValue ?? 0}
                    onChange={(e) =>
                      setSettings((prev) => {
                        const rows = promoRowsFrom(prev)
                        const n = parseFloat(e.target.value)
                        rows[i] = {
                          ...rows[i],
                          discountValue: Number.isFinite(n) ? n : 0,
                        }
                        return { ...prev, promoCodes: rows }
                      })
                    }
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <h3 className="text-lg font-semibold text-slate-900">Crew pricing & availability</h3>
          <p className="mt-1 text-sm text-slate-600">
            Every crew size includes travel labour (Mapbox route duration when available; miles ÷ fallback speed
            otherwise). Service base is separate from crew labour. Mileage and fuel are per-mile charges in addition to
            labour. Parking, waiting, packing, and heavy handling are never multiplied by crew size. House removals and
            heavy inventory require at least 2 men.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Fallback speed if Mapbox duration unavailable (mph)">
              <input
                type="number"
                step="1"
                min="1"
                className={inputClass}
                value={settings.fallbackSpeedMph ?? settings.averageSpeedMph}
                onChange={(e) => {
                  const n = parseFloat(e.target.value)
                  const v = Number.isFinite(n) && n > 0 ? n : fallbackDefaults.fallbackSpeedMph
                  setSettings((s) => ({ ...s, fallbackSpeedMph: v, averageSpeedMph: v }))
                }}
              />
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                Helper labour always uses live Mapbox route duration from the quote map. This speed is only for manual
                distance or when routing fails.
              </p>
            </Field>
            <Field label="First man — base fee (£)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.firstManBaseFee}
                onChange={(e) => setNum('firstManBaseFee', e.target.value)}
              />
            </Field>
            <Field label="First man — hourly rate (£/hr)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.firstManHourlyRate}
                onChange={(e) => setNum('firstManHourlyRate', e.target.value)}
              />
            </Field>
            <Field label="Legacy flat 1st man fee (£) — if hourly rates are 0">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.firstManLabourFee}
                onChange={(e) => setNum('firstManLabourFee', e.target.value)}
              />
            </Field>
            <Field label="Second man — base fee (£)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.secondManBaseFee}
                onChange={(e) => setNum('secondManBaseFee', e.target.value)}
              />
            </Field>
            <Field label="Second man — hourly rate (£/hr)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.secondManHourlyRate}
                onChange={(e) => setNum('secondManHourlyRate', e.target.value)}
              />
            </Field>
            <Field label="Third man — base fee (£)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.thirdManBaseFee}
                onChange={(e) => setNum('thirdManBaseFee', e.target.value)}
              />
            </Field>
            <Field label="Third man — hourly rate (£/hr)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.thirdManHourlyRate}
                onChange={(e) => setNum('thirdManHourlyRate', e.target.value)}
              />
            </Field>
            <Field label="Fourth man — base fee (£)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.fourthManBaseFee ?? settings.thirdManBaseFee ?? 0}
                onChange={(e) => setNum('fourthManBaseFee', e.target.value)}
              />
            </Field>
            <Field label="Fourth man — hourly rate (£/hr)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.fourthManHourlyRate ?? settings.thirdManHourlyRate ?? 0}
                onChange={(e) => setNum('fourthManHourlyRate', e.target.value)}
              />
            </Field>
            <Field label="Legacy flat 2nd man fee (£) — if hourly rates are 0">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.secondManLabourFee}
                onChange={(e) => setNum('secondManLabourFee', e.target.value)}
              />
            </Field>
            <Field label="Legacy flat 3rd man fee (£)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.thirdManLabourFee}
                onChange={(e) => setNum('thirdManLabourFee', e.target.value)}
              />
            </Field>
            <Field label="Legacy flat 4th man fee (£)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.fourthManLabourFee}
                onChange={(e) => setNum('fourthManLabourFee', e.target.value)}
              />
            </Field>
            <Field
              label="Legacy crew surcharge per extra member (£)"
              helper="Used only when all hourly crew rates are £0. Normally use Extra helper or hourly rates above."
            >
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.crewSurchargePerExtraMember ?? settings.extraHelperPrice ?? 0}
                onChange={(e) => setNum('crewSurchargePerExtraMember', e.target.value)}
              />
            </Field>
            <Field label="One-man labour discount (%) — flat base mode">
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                className={inputClass}
                value={settings.oneManLabourDiscountPercent}
                onChange={(e) => setNum('oneManLabourDiscountPercent', e.target.value)}
              />
            </Field>
            <Field label="Large move threshold (m³)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.largeMoveVolumeThresholdM3}
                onChange={(e) => setNum('largeMoveVolumeThresholdM3', e.target.value)}
              />
            </Field>
            <Field label="Minimum crew for large moves">
              <select
                className={inputClass}
                value={settings.minimumCrewForLargeMoves}
                onChange={(e) => setNum('minimumCrewForLargeMoves', e.target.value)}
              >
                <option value={1}>1 Man</option>
                <option value={2}>2 Men</option>
                <option value={3}>3 Men</option>
                <option value={4}>4 Men</option>
              </select>
            </Field>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <input type="checkbox" checked={Boolean(settings.crewSizeOneEnabled)} onChange={(e) => setBool('crewSizeOneEnabled', e.target.checked)} />
              <span>Enable 1 Man</span>
            </label>
            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <input type="checkbox" checked={Boolean(settings.crewSizeTwoEnabled ?? true)} onChange={(e) => setBool('crewSizeTwoEnabled', e.target.checked)} />
              <span>Enable 2 Men</span>
            </label>
            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <input type="checkbox" checked={Boolean(settings.crewSizeThreeEnabled ?? true)} onChange={(e) => setBool('crewSizeThreeEnabled', e.target.checked)} />
              <span>Enable 3 Men</span>
            </label>
            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <input type="checkbox" checked={Boolean(settings.crewSizeFourEnabled)} onChange={(e) => setBool('crewSizeFourEnabled', e.target.checked)} />
              <span>Enable 4 Men</span>
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <h3 className="text-lg font-semibold text-slate-900">Custom item size bands (m³)</h3>
          <p className="mt-1 text-sm text-slate-600">
            Used when customers add a manual item (small / medium / large / heavy).
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(['small', 'medium', 'large', 'heavy']).map((k) => (
              <Field key={k} label={k.charAt(0).toUpperCase() + k.slice(1)}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputClass}
                  value={settings.customSizeM3?.[k] ?? 0}
                  onChange={(e) => setCustomSize(k, e.target.value)}
                />
              </Field>
            ))}
          </div>
        </div>

        <DriverAppExtraChargePricingPanel
          websiteSettings={settings}
          onMainFieldChange={(key, raw) => setNum(key, raw)}
        />

        <button
          type="submit"
          disabled={saving}
          className="inline-flex min-h-[48px] items-center rounded-xl bg-brand-600 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save pricing settings'}
        </button>
      </form>
    </div>
  )
}
