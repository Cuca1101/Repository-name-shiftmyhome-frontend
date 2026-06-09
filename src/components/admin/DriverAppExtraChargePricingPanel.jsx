import { VOLUME_MULTIPLIER_BANDS } from '../../lib/volumePricingMultiplier'
import { formatEnginePriceGbp } from '../../lib/extraChargeMobileApi'
import {
  getDriverAppExtraChargeMode,
  previewDriverAppRatesForAdmin,
} from '../../lib/driverExtraChargePricingSettings'

function Field({ label, children, helper }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {helper ? <p className="mb-2 text-xs leading-relaxed text-slate-500">{helper}</p> : null}
      {children}
    </label>
  )
}

const inputClass =
  'w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'

const MOBILE_RATE_LABELS = {
  pricePerCubicMetre: 'Price per m³',
  heavyItemHandlingCharge: 'Heavy item (each)',
  floorChargePerFloor: 'Extra floor (each)',
  noLiftCharge: 'No lift supplement',
  yesLiftChargePerEnd: 'Lift access (yes + floors)',
  stairsChargePerFlight: 'Stairs (per flight)',
  longWalkingDistanceCharge: 'Long walking distance',
  parkingCharge: 'Parking / access',
  waitingTimePricePerHour: 'Waiting time (per hour)',
  dismantlingPricePerItem: 'Dismantling (per item)',
  reassemblyPricePerItem: 'Reassembly (per item)',
  extraHelperPrice: 'Extra helper (each)',
}

/**
 * Driver app extra charges — always synced with main Pricing Engine (same DB fields).
 * @param {{
 *   websiteSettings: Record<string, unknown>,
 *   onMainFieldChange?: (key: string, raw: string) => void,
 * }} props
 */
export default function DriverAppExtraChargePricingPanel({
  websiteSettings,
  onMainFieldChange,
}) {
  const liveRates = previewDriverAppRatesForAdmin(websiteSettings)
  const legacyCustomInDb = getDriverAppExtraChargeMode(websiteSettings) === 'custom'

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-5 shadow-card sm:p-6">
      <div className="min-w-0">
        <h3 className="text-lg font-semibold text-emerald-950">Driver mobile app — extra charges</h3>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-emerald-900/85">
          The driver app (add items, access charges, waiting) uses the{' '}
          <strong>same rates as this Pricing Engine</strong> — Access charges, £/m³, volume multipliers,
          dismantling, and waiting above. After you click <strong>Save pricing settings</strong>, mobile
          picks up the new values automatically.
        </p>
      </div>

      {legacyCustomInDb ? (
        <p
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-950"
          role="status"
        >
          Older &ldquo;custom driver-only&rdquo; values were stored in the database but are{' '}
          <strong>not used on mobile</strong> anymore (prevents stale £/floor etc.). Save once to align
          everything with the main engine.
        </p>
      ) : null}

      <div className="mt-5 rounded-xl border border-emerald-100 bg-white p-4 sm:p-5">
        <p className="text-sm font-semibold text-emerald-900">Quick edit (same fields as main engine)</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Changes here update the sections above and what the driver app will charge after Save.
        </p>
        <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Price per m³ (£)">
            <input
              type="number"
              step="0.01"
              min="0"
              className={inputClass}
              value={liveRates.pricePerCubicMetre ?? 0}
              onChange={(e) => onMainFieldChange?.('pricePerCubicMetre', e.target.value)}
            />
          </Field>
          <Field label="Heavy item handling (£ each)">
            <input
              type="number"
              step="0.01"
              min="0"
              className={inputClass}
              value={liveRates.heavyItemHandlingCharge ?? 0}
              onChange={(e) => onMainFieldChange?.('heavyItemHandlingCharge', e.target.value)}
            />
          </Field>
          <Field label="Extra floor (£ per floor)">
            <input
              type="number"
              step="0.01"
              min="0"
              className={inputClass}
              value={liveRates.floorChargePerFloor ?? 0}
              onChange={(e) => onMainFieldChange?.('floorChargePerFloor', e.target.value)}
            />
          </Field>
          <Field label="No lift supplement (£)">
            <input
              type="number"
              step="0.01"
              min="0"
              className={inputClass}
              value={liveRates.noLiftCharge ?? 0}
              onChange={(e) => onMainFieldChange?.('noLiftCharge', e.target.value)}
            />
          </Field>
          <Field label="Waiting time (£ per hour)">
            <input
              type="number"
              step="0.01"
              min="0"
              className={inputClass}
              value={liveRates.waitingTimePricePerHour ?? 0}
              onChange={(e) => onMainFieldChange?.('waitingTimePricePerHour', e.target.value)}
            />
          </Field>
          <Field label="Stairs (£ per flight)">
            <input
              type="number"
              step="0.01"
              min="0"
              className={inputClass}
              value={liveRates.stairsChargePerFlight ?? 0}
              onChange={(e) => onMainFieldChange?.('stairsChargePerFlight', e.target.value)}
            />
          </Field>
        </div>
      </div>

      <div className="mt-4 min-w-0 rounded-xl border border-emerald-100 bg-white p-4 sm:p-5">
        <p className="text-sm font-semibold text-slate-900">All rates the mobile app will use (after Save)</p>
        <ul className="mt-3 min-w-0 divide-y divide-slate-100 rounded-lg border border-slate-100">
          {Object.entries(MOBILE_RATE_LABELS).map(([key, label]) => (
            <li
              key={key}
              className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 px-3 py-2.5 text-sm"
            >
              <span className="min-w-0 break-words text-slate-700">{label}</span>
              <span className="shrink-0 tabular-nums font-medium text-slate-900">
                {formatEnginePriceGbp(liveRates[key])}
              </span>
            </li>
          ))}
          {VOLUME_MULTIPLIER_BANDS.map((band) => (
            <li
              key={band.key}
              className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 px-3 py-2.5 text-sm"
            >
              <span className="min-w-0 break-words text-slate-700">Volume {band.bandLabel} (×)</span>
              <span className="shrink-0 tabular-nums font-medium text-slate-900">
                ×{Number(liveRates[band.key] ?? 1).toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Edit volume multipliers under &ldquo;Volume scaling multipliers&rdquo;, parking and dismantling
          under &ldquo;Access charges&rdquo; / &ldquo;Extras &amp; surcharges&rdquo; — then Save.
        </p>
      </div>
    </div>
  )
}
