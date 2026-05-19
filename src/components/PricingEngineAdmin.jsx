import { useCallback, useEffect, useState } from 'react'
import { SERVICE_TYPES } from '../constants/serviceTypes'
import { fetchPricingSettings, savePricingSettings } from '../lib/data/pricingSettingsRepository'
import { getDefaultPricingSettings } from '../lib/defaultPricingSettings'

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  )
}

export default function PricingEngineAdmin() {
  const [settings, setSettings] = useState(() => getDefaultPricingSettings())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const s = await fetchPricingSettings()
      setSettings(s)
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

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setMessage({ type: '', text: '' })
    try {
      await savePricingSettings(settings)
      setMessage({ type: 'success', text: 'Pricing settings saved.' })
    } catch (err) {
      setMessage({ type: 'error', text: err?.message || 'Save failed.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-slate-600">Loading pricing settings…</p>
  }

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30'

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

      <form onSubmit={handleSave} className="space-y-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <h3 className="text-lg font-semibold text-slate-900">Base price per service type</h3>
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
                When enabled, each service base price above is multiplied by the crew size from the customer quote
                (quote wizard Step 2). The separate “extra crew member” surcharge is not applied — crew is included in
                the base total.
              </span>
            </span>
          </label>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICE_TYPES.map((s) => (
              <Field key={s} label={s}>
                <div className="flex items-center gap-2">
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
              </Field>
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
            <Field label="Minimum job price (£)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.minimumJobPrice}
                onChange={(e) => setNum('minimumJobPrice', e.target.value)}
              />
            </Field>
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
            <Field label="Weekend surcharge (%)">
              <input
                type="number"
                step="0.1"
                min="0"
                className={inputClass}
                value={settings.weekendSurchargePercent}
                onChange={(e) => setNum('weekendSurchargePercent', e.target.value)}
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
            </Field>
            <Field label="Exact arrival time premium (£)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.exactArrivalPremiumGbp ?? 20}
                onChange={(e) => setNum('exactArrivalPremiumGbp', e.target.value)}
              />
            </Field>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <h3 className="text-lg font-semibold text-slate-900">Crew pricing & availability</h3>
          <p className="mt-1 text-sm text-slate-600">
            Configure which crew sizes customers can select and how additional crew impacts pricing.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Surcharge per extra crew member (£)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.crewSurchargePerExtraMember ?? settings.extraHelperPrice ?? 0}
                onChange={(e) => setNum('crewSurchargePerExtraMember', e.target.value)}
              />
            </Field>
            <Field label="Large move threshold (m³)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={settings.largeMoveVolumeThresholdM3 ?? 35}
                onChange={(e) => setNum('largeMoveVolumeThresholdM3', e.target.value)}
              />
            </Field>
            <Field label="Minimum crew for large moves">
              <select
                className={inputClass}
                value={settings.minimumCrewForLargeMoves ?? 3}
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
