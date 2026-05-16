import QuoteRouteMap from './QuoteRouteMap'
import { formatFloorLabel } from './FloorSelect'
import { formatDateUK } from '../../lib/formatDateDisplay'
import { formatWizardArrivalTitle, formatWizardServiceExtrasSummary } from '../../lib/emailQuotePayload'

function truncate(s, max = 42) {
  if (!s) return '—'
  const t = s.trim()
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

/**
 * @param {{ name?: string, quantity?: number, isCustom?: boolean, m3?: number, mult?: number }} line
 */
function formatInventorySummaryLine(line) {
  const qty = Math.max(0, Number(line.quantity) || 0)
  const name = (line.name || 'Item').trim() || 'Item'
  const lineVolume = qty * Math.max(0, Number(line.m3) || 0) * Math.max(0, Number(line.mult) || 1)
  const volumeLabel = Number.isFinite(lineVolume) ? `${lineVolume.toFixed(2)} m³` : '—'
  if (line.isCustom) {
    return { label: `Custom item: ${name}`, qty, volumeLabel }
  }
  return { label: name, qty, volumeLabel }
}

export default function MoveSummary({
  quoteRef,
  step,
  wizard,
  onDistanceFromRoute,
  pickupLng,
  pickupLat,
  deliveryLng,
  deliveryLat,
  pickupAddress,
  deliveryAddress,
  pickupPropertyType,
  deliveryPropertyType,
  pickupFloor,
  deliveryFloor,
  pickupLift,
  deliveryLift,
  distanceMiles,
  moveDate,
  arrivalWindow,
  exactArrivalTime,
  inventoryLines,
  totalM3,
  showPricing,
  breakdown,
  serviceType,
}) {
  const lineRowCount = inventoryLines.length
  /** Total catalogue/custom units (sum of quantities), not number of rows */
  const totalItemUnits = inventoryLines.reduce(
    (s, l) => s + Math.max(0, Number(l.quantity) || 0),
    0,
  )

  return (
    <aside className="flex w-full min-w-0 flex-col gap-4 lg:sticky lg:top-24">
      <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-card ring-1 ring-slate-100 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quote reference</p>
        <p className="mt-1 font-mono text-lg font-bold text-brand-800">{quoteRef}</p>
        <p className="mt-2 text-xs text-slate-500">Keep this handy when you speak to us.</p>
      </div>

      <QuoteRouteMap
        pickupLng={pickupLng}
        pickupLat={pickupLat}
        deliveryLng={deliveryLng}
        deliveryLat={deliveryLat}
        distanceMiles={distanceMiles}
        onDistanceFromRoute={onDistanceFromRoute}
      />

      <div className="min-w-0 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3 shadow-card ring-1 ring-slate-100 sm:p-5">
        <h3 className="text-sm font-bold text-slate-900">Move summary</h3>
        <dl className="mt-4 space-y-4 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-brand-700">Service</dt>
            <dd className="mt-0.5 font-medium text-slate-800">{serviceType}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Pickup</dt>
            <dd className="mt-0.5 text-slate-700">{truncate(pickupAddress, 120) || '—'}</dd>
            {step >= 1 && pickupAddress && (
              <dd className="mt-1 text-xs text-slate-500">
                {pickupPropertyType} · {formatFloorLabel(pickupFloor)} · Lift{' '}
                {pickupLift ? 'yes' : 'no'}
              </dd>
            )}
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Delivery</dt>
            <dd className="mt-0.5 text-slate-700">{truncate(deliveryAddress, 120) || '—'}</dd>
            {step >= 1 && deliveryAddress && (
              <dd className="mt-1 text-xs text-slate-500">
                {deliveryPropertyType} · {formatFloorLabel(deliveryFloor)} · Lift{' '}
                {deliveryLift ? 'yes' : 'no'}
              </dd>
            )}
          </div>
          {step >= 1 && moveDate && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Move date</dt>
              <dd className="mt-0.5 text-slate-800">{formatDateUK(moveDate)}</dd>
              <dt className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Arrival</dt>
              <dd className="mt-0.5 text-xs leading-snug text-slate-600">
                {formatWizardArrivalTitle({ arrivalWindow, exactArrivalTime })}
              </dd>
              {arrivalWindow === 'exact' && (
                <dd className="mt-1 text-[11px] leading-snug text-amber-800/90">
                  Exact time requests are subject to route availability
                </dd>
              )}
            </div>
          )}
          {step >= 1 && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Distance (estimate)</dt>
              <dd className="mt-0.5 tabular-nums text-slate-800">
                {Number(distanceMiles) > 0 ? `${Number(distanceMiles).toFixed(1)}` : '—'} miles
              </dd>
            </div>
          )}
          {step >= 2 && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Crew size</dt>
              <dd className="mt-0.5 text-slate-800">
                {Number(wizard.crewSize) > 0 ? `${Number(wizard.crewSize)} ${Number(wizard.crewSize) === 1 ? 'Man' : 'Men'}` : '—'}
              </dd>
            </div>
          )}
          {step >= 2 && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Inventory</dt>
              <dd className="mt-0.5 text-slate-800">
                {totalItemUnits} {totalItemUnits === 1 ? 'item' : 'items'} ·{' '}
                <span className="font-semibold text-brand-800">{totalM3.toFixed(2)} m³</span>
              </dd>
              {lineRowCount > 0 && (
                <>
                  <div className="mt-2 hidden max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white p-2 md:block">
                    <ul className="space-y-1.5 text-xs leading-snug text-slate-700">
                      {inventoryLines.map((line) => {
                        const formatted = formatInventorySummaryLine(line)
                        return (
                          <li key={line.lineId} className="flex items-start justify-between gap-2 border-b border-slate-100 pb-1 last:border-b-0">
                            <span className="min-w-0 flex-1">
                              {formatted.label} <span className="font-semibold">× {formatted.qty}</span>
                            </span>
                            <span className="shrink-0 tabular-nums text-slate-600">{formatted.volumeLabel}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                  <details className="mt-2 rounded-lg border border-slate-200 bg-white md:hidden">
                    <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-slate-700">
                      View full inventory ({lineRowCount})
                    </summary>
                    <div className="max-h-64 overflow-auto border-t border-slate-100 p-2">
                      <ul className="space-y-1.5 text-xs leading-snug text-slate-700">
                        {inventoryLines.map((line) => {
                          const formatted = formatInventorySummaryLine(line)
                          return (
                            <li key={line.lineId} className="flex items-start justify-between gap-2 border-b border-slate-100 pb-1 last:border-b-0">
                              <span className="min-w-0 flex-1">
                                {formatted.label} <span className="font-semibold">× {formatted.qty}</span>
                              </span>
                              <span className="shrink-0 tabular-nums text-slate-600">{formatted.volumeLabel}</span>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  </details>
                </>
              )}
            </div>
          )}
          {step >= 3 && wizard && formatWizardServiceExtrasSummary(wizard) && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Extra services</dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
                {formatWizardServiceExtrasSummary(wizard)}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {showPricing && breakdown && (
        <div className="min-w-0 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/90 to-white p-3 shadow-card ring-1 ring-emerald-100/80 sm:p-5">
          <h3 className="text-sm font-bold text-slate-900">Estimated total</h3>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-700 sm:text-3xl">
            £{breakdown.estimatedTotal.toFixed(2)}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            Updates as you complete details. Final price confirmed by ShiftMyHome.
          </p>
        </div>
      )}
    </aside>
  )
}
