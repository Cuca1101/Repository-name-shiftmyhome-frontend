import { VOLUME_MULTIPLIER_BANDS } from '../../lib/volumePricingMultiplier'
import { formatEnginePriceGbp } from '../../lib/extraChargeMobileApi'
import { copyWebsiteRatesToDriverAppExtraCharge } from '../../lib/driverExtraChargePricingSettings'

function Field({ label, children, helper }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {helper ? <p className="mb-2 text-xs leading-relaxed text-slate-500">{helper}</p> : null}
      {children}
    </label>
  )
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'

/**
 * @param {{
 *   mode: 'website' | 'custom',
 *   values: Record<string, number>,
 *   websiteSettings: Record<string, unknown>,
 *   onModeChange: (mode: 'website' | 'custom') => void,
 *   onChange: (next: Record<string, number>) => void,
 *   onMainFieldChange?: (key: string, raw: string) => void,
 * }} props
 */
export default function DriverAppExtraChargePricingPanel({
  mode = 'website',
  values,
  websiteSettings,
  onModeChange,
  onChange,
  onMainFieldChange,
}) {
  const v = values || {}
  const synced = mode !== 'custom'
  const livePreview = copyWebsiteRatesToDriverAppExtraCharge(websiteSettings)

  function setNum(key, raw) {
    const n = parseFloat(raw)
    onChange({
      ...v,
      [key]: Number.isFinite(n) ? n : 0,
    })
  }

  return (
    <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-6 shadow-card">
      <div>
        <h3 className="text-lg font-semibold text-emerald-950">Driver app — extra charge pricing</h3>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-emerald-900/80">
          The driver app and extra-charge links always use the <strong>main Pricing Engine</strong> above
          (Access charges, £/m³, waiting). Save after editing those sections — custom driver-only rates are
          not applied on mobile.
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <label className="flex flex-1 cursor-pointer items-start gap-3 rounded-xl border border-emerald-200 bg-white p-4">
          <input
            type="radio"
            name="driverAppExtraChargeMode"
            className="mt-1"
            checked={synced}
            onChange={() => onModeChange('website')}
          />
          <span>
            <span className="block text-sm font-semibold text-emerald-950">
              Same as main Pricing Engine
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-slate-600">
              Recommended. When you change £/m³, access, or waiting above and save, the driver app uses those
              rates automatically.
            </span>
          </span>
        </label>
        <label className="flex flex-1 cursor-pointer items-start gap-3 rounded-xl border border-emerald-200 bg-white p-4">
          <input
            type="radio"
            name="driverAppExtraChargeMode"
            className="mt-1"
            checked={!synced}
            onChange={() => onModeChange('custom')}
          />
          <span>
            <span className="block text-sm font-semibold text-emerald-950">Custom driver-only rates</span>
            <span className="mt-1 block text-xs leading-relaxed text-slate-600">
              Different prices on mobile only. Does not change website quotes.
            </span>
          </span>
        </label>
      </div>

      {synced ? (
        <div className="mt-4 rounded-xl border border-emerald-100 bg-white p-5">
          <p className="text-sm font-semibold text-emerald-900">Driver app rates (edit here or in Access charges above)</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            These fields update the main pricing engine and are what the driver app uses after Save.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Price per m³ (£)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={livePreview.pricePerCubicMetre ?? 0}
                onChange={(e) => onMainFieldChange?.('pricePerCubicMetre', e.target.value)}
              />
            </Field>
            <Field label="Extra floor (£ per floor)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={livePreview.floorChargePerFloor ?? 0}
                onChange={(e) => onMainFieldChange?.('floorChargePerFloor', e.target.value)}
              />
            </Field>
            <Field label="Waiting time (£ per hour)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={livePreview.waitingTimePricePerHour ?? 0}
                onChange={(e) => onMainFieldChange?.('waitingTimePricePerHour', e.target.value)}
              />
            </Field>
            <Field label="No lift supplement (£)">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={livePreview.noLiftCharge ?? 0}
                onChange={(e) => onMainFieldChange?.('noLiftCharge', e.target.value)}
              />
            </Field>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              className="rounded-xl border border-emerald-300 bg-white px-4 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50"
              onClick={() => onChange(copyWebsiteRatesToDriverAppExtraCharge(websiteSettings))}
            >
              Copy main engine rates as starting point
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-emerald-100 bg-white p-5">
            <h4 className="text-sm font-bold uppercase tracking-wide text-emerald-800">Extra inventory (items)</h4>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Price per m³ (£)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputClass}
                  value={v.pricePerCubicMetre ?? 0}
                  onChange={(e) => setNum('pricePerCubicMetre', e.target.value)}
                />
              </Field>
              <Field label="Heavy item handling per item (£)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputClass}
                  value={v.heavyItemHandlingCharge ?? 0}
                  onChange={(e) => setNum('heavyItemHandlingCharge', e.target.value)}
                />
              </Field>
            </div>
            <p className="mt-4 text-xs font-semibold text-slate-600">Volume band multipliers (driver app)</p>
            <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {VOLUME_MULTIPLIER_BANDS.map((band) => (
                <Field key={band.key} label={`${band.bandLabel} (×)`}>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className={inputClass}
                    value={v[band.key] ?? 1}
                    onChange={(e) => setNum(band.key, e.target.value)}
                  />
                </Field>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-emerald-100 bg-white p-5">
            <h4 className="text-sm font-bold uppercase tracking-wide text-emerald-800">
              Access &amp; time (Charges tab)
            </h4>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Extra floor (£ per floor)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputClass}
                  value={v.floorChargePerFloor ?? 0}
                  onChange={(e) => setNum('floorChargePerFloor', e.target.value)}
                />
              </Field>
              <Field label="No lift supplement (£)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputClass}
                  value={v.noLiftCharge ?? 0}
                  onChange={(e) => setNum('noLiftCharge', e.target.value)}
                />
              </Field>
              <Field label="Lift access (£, when lift yes + floors)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputClass}
                  value={v.yesLiftChargePerEnd ?? 0}
                  onChange={(e) => setNum('yesLiftChargePerEnd', e.target.value)}
                />
              </Field>
              <Field label="Stairs (£ per flight)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputClass}
                  value={v.stairsChargePerFlight ?? 0}
                  onChange={(e) => setNum('stairsChargePerFlight', e.target.value)}
                />
              </Field>
              <Field label="Long walking distance (£)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputClass}
                  value={v.longWalkingDistanceCharge ?? 0}
                  onChange={(e) => setNum('longWalkingDistanceCharge', e.target.value)}
                />
              </Field>
              <Field label="Parking / access (£)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputClass}
                  value={v.parkingCharge ?? 0}
                  onChange={(e) => setNum('parkingCharge', e.target.value)}
                />
              </Field>
              <Field label="Waiting time (£ per hour)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputClass}
                  value={v.waitingTimePricePerHour ?? 0}
                  onChange={(e) => setNum('waitingTimePricePerHour', e.target.value)}
                />
              </Field>
              <Field label="Dismantling (£ per item)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputClass}
                  value={v.dismantlingPricePerItem ?? 0}
                  onChange={(e) => setNum('dismantlingPricePerItem', e.target.value)}
                />
              </Field>
              <Field label="Reassembly (£ per item)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputClass}
                  value={v.reassemblyPricePerItem ?? 0}
                  onChange={(e) => setNum('reassemblyPricePerItem', e.target.value)}
                />
              </Field>
              <Field label="Extra helper (£ each)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputClass}
                  value={v.extraHelperPrice ?? 0}
                  onChange={(e) => setNum('extraHelperPrice', e.target.value)}
                />
              </Field>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
