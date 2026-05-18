import QuoteRouteMap from './QuoteRouteMap'
import {
  formatMoveSummaryArrival,
  formatMoveSummaryCrewSize,
  formatMoveSummaryFloorLabel,
  formatMoveSummaryLiftLabel,
} from '../../lib/moveSummaryDisplay'
import { formatDateUK } from '../../lib/formatDateDisplay'
import {
  formatCompactArrivalLine,
  formatWizardServiceExtrasSummary,
} from '../../lib/emailQuotePayload'

function truncate(s, max = 42) {
  if (!s) return '—'
  const t = s.trim()
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

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

/** Shared move summary panels (desktop sidebar + mobile accordion). */
export default function MoveSummaryBody({
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
  crewSettings,
  compact = false,
}) {
  const lineRowCount = inventoryLines.length
  const totalItemUnits = inventoryLines.reduce(
    (s, l) => s + Math.max(0, Number(l.quantity) || 0),
    0,
  )

  const cardPad = compact ? 'p-3' : 'p-2 shadow-card ring-1 ring-slate-100 xxs:p-2.5 xs:rounded-2xl sm:p-5'
  const cardRound = compact ? 'rounded-xl' : 'rounded-lg xxs:rounded-2xl'
  const hideRefCardOnMobileStep1 = step === 1 ? 'hidden md:block' : ''

  const pickupFloorSummary = formatMoveSummaryFloorLabel(pickupFloor)
  const deliveryFloorSummary = formatMoveSummaryFloorLabel(deliveryFloor)

  return (
    <>
      <div className={`min-w-0 border border-slate-200 bg-white ${cardRound} ${cardPad} ${hideRefCardOnMobileStep1}`}>
        <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">Quote reference</p>
        <p className="mt-0.5 font-mono text-sm font-bold text-brand-800">{quoteRef}</p>
        {!compact ? <p className="mt-2 text-xs text-slate-500">Keep this handy when you speak to us.</p> : null}
      </div>

      <QuoteRouteMap
        pickupLng={pickupLng}
        pickupLat={pickupLat}
        deliveryLng={deliveryLng}
        deliveryLat={deliveryLat}
        distanceMiles={distanceMiles}
        onDistanceFromRoute={onDistanceFromRoute}
      />

      <div
        className={`min-w-0 border border-slate-200 bg-gradient-to-br from-slate-50 to-white ${cardRound} ${cardPad}`}
      >
        <h3 className="text-xs font-bold text-slate-900">Move summary</h3>
        <dl className={`mt-2 space-y-2 text-xs ${compact ? '' : 'xxs:mt-2.5 xxs:space-y-2.5 sm:mt-4 sm:space-y-4 sm:text-sm'}`}>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-brand-700">Service</dt>
            <dd className="mt-0.5 font-medium text-slate-800">{serviceType}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Pickup</dt>
            <dd className="mt-0.5 text-slate-700">{truncate(pickupAddress, compact ? 80 : 120) || '—'}</dd>
            {step >= 1 && pickupAddress && (
              <dd className="mt-1 text-[11px] text-slate-500">
                {pickupPropertyType}
                {pickupFloorSummary ? ` · ${pickupFloorSummary}` : ''}
                {` · ${formatMoveSummaryLiftLabel(pickupLift)}`}
              </dd>
            )}
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Delivery</dt>
            <dd className="mt-0.5 text-slate-700">{truncate(deliveryAddress, compact ? 80 : 120) || '—'}</dd>
            {step >= 1 && deliveryAddress && (
              <dd className="mt-1 text-[11px] text-slate-500">
                {deliveryPropertyType}
                {deliveryFloorSummary ? ` · ${deliveryFloorSummary}` : ''}
                {` · ${formatMoveSummaryLiftLabel(deliveryLift)}`}
              </dd>
            )}
          </div>
          {step >= 1 && moveDate && (
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Move date</dt>
              <dd className="mt-0.5 text-slate-800">{formatDateUK(moveDate)}</dd>
            </div>
          )}
          {step >= 1 && wizard && formatMoveSummaryArrival(wizard) && (
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Arrival window
              </dt>
              <dd className="mt-0.5 text-slate-800">{formatMoveSummaryArrival(wizard)}</dd>
            </div>
          )}
          {step >= 2 && wizard?.crewSize != null && Number(wizard.crewSize) >= 1 && (
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Crew size</dt>
              <dd className="mt-0.5 text-slate-800">
                {formatMoveSummaryCrewSize(wizard.crewSize, crewSettings)}
              </dd>
            </div>
          )}
          {step >= 1 && (
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Distance</dt>
              <dd className="mt-0.5 tabular-nums text-slate-800">
                {Number(distanceMiles) > 0 ? `${Number(distanceMiles).toFixed(1)}` : '—'} miles
              </dd>
            </div>
          )}
          {step >= 2 && (
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Inventory</dt>
              <dd className="mt-0.5 text-slate-800">
                {totalItemUnits} {totalItemUnits === 1 ? 'item' : 'items'} ·{' '}
                <span className="font-semibold text-brand-800">{totalM3.toFixed(2)} m³</span>
              </dd>
              {lineRowCount > 0 && !compact && (
                <div className="mt-2 max-h-28 overflow-auto rounded-lg border border-slate-200 bg-white p-2 sm:max-h-56">
                  <ul className="space-y-1.5 text-xs leading-snug text-slate-700">
                    {inventoryLines.map((line) => {
                      const formatted = formatInventorySummaryLine(line)
                      return (
                        <li
                          key={line.lineId}
                          className="flex items-start justify-between gap-2 border-b border-slate-100 pb-1 last:border-b-0"
                        >
                          <span className="min-w-0 flex-1">
                            {formatted.label} <span className="font-semibold">× {formatted.qty}</span>
                          </span>
                          <span className="shrink-0 tabular-nums text-slate-600">{formatted.volumeLabel}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
          {step >= 3 && wizard && formatWizardServiceExtrasSummary(wizard) && (
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Extras</dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-700">
                {formatWizardServiceExtrasSummary(wizard)}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {showPricing && breakdown && (
        <div className="min-w-0 rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50/90 to-white p-3 ring-1 ring-emerald-100/80 sm:p-5">
          <h3 className="text-sm font-bold text-slate-900">Estimated total</h3>
          <p className="mt-1 text-xl font-bold tracking-tight text-emerald-700 sm:text-2xl">
            £{breakdown.estimatedTotal.toFixed(2)}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
            Updates as you add details. Final price confirmed by ShiftMyHome.
          </p>
        </div>
      )}
    </>
  )
}
