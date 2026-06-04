import { ArrowRight, Pencil } from 'lucide-react'
import {
  formatMoveSummaryFloorLabel,
  formatMoveSummaryLiftLabel,
} from '../../lib/moveSummaryDisplay'
import { formatDateUK } from '../../lib/formatDateDisplay'
import { formatReviewShortTimeLabel } from '../../lib/quoteReviewPriceOptions'

const card = 'rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:p-4'

function truncate(s, max = 72) {
  if (!s) return '—'
  const t = String(s).trim()
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

function LocationColumn({ label, address, propertyType, floor, lift, accent }) {
  const floorLabel = formatMoveSummaryFloorLabel(floor)
  const access = [
    propertyType,
    floorLabel,
    `Lift: ${formatMoveSummaryLiftLabel(lift)}`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="min-w-0 flex-1">
      <p
        className={`text-[10px] font-bold uppercase tracking-wide ${
          accent === 'pickup' ? 'text-brand-700' : 'text-emerald-700'
        }`}
      >
        {label}
      </p>
      <p className="mt-1 text-xs font-medium leading-snug text-slate-900 md:text-sm">
        {truncate(address, 90)}
      </p>
      {access ? <p className="mt-1 text-[10px] leading-snug text-slate-500 md:text-xs">{access}</p> : null}
    </div>
  )
}

/**
 * Compact move summary for Step 3 (pickup / delivery columns).
 */
export default function QuoteReviewMoveSummaryCompact({
  wizard,
  serviceType,
  moveDate,
  totalM3,
  inventoryLines = [],
  onGoToStep,
}) {
  const itemCount = inventoryLines.reduce((s, l) => s + Math.max(0, Number(l.quantity) || 0), 0)
  const arrival = formatReviewShortTimeLabel(wizard)

  return (
    <section className={card} aria-labelledby="quote-review-move-summary-heading">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 id="quote-review-move-summary-heading" className="text-xs font-bold text-slate-900 md:text-sm">
            Move details summary
          </h3>
          <p className="mt-0.5 text-[10px] text-slate-500 md:text-xs">
            {serviceType}
            {moveDate ? ` · ${formatDateUK(moveDate)}` : ''}
            {itemCount > 0 ? ` · ${itemCount} items` : ''}
            {totalM3 > 0 ? ` · ${totalM3.toFixed(2)} m³` : ''}
          </p>
        </div>
        {onGoToStep ? (
          <button
            type="button"
            onClick={() => onGoToStep(1)}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-brand-800 shadow-sm hover:bg-slate-50 md:text-xs"
          >
            <Pencil className="h-3 w-3" aria-hidden />
            Edit
          </button>
        ) : null}
      </div>

      <div className="mt-3 flex items-start gap-2 md:gap-3">
        <LocationColumn
          label="Pickup"
          address={wizard?.pickupAddress}
          propertyType={wizard?.pickupPropertyType}
          floor={wizard?.pickupFloor}
          lift={wizard?.pickupLift}
          accent="pickup"
        />
        <div className="flex shrink-0 items-center self-center pt-4 text-slate-300" aria-hidden>
          <ArrowRight className="h-4 w-4 md:h-5 md:w-5" />
        </div>
        <LocationColumn
          label="Delivery"
          address={wizard?.deliveryAddress}
          propertyType={wizard?.deliveryPropertyType}
          floor={wizard?.deliveryFloor}
          lift={wizard?.deliveryLift}
          accent="delivery"
        />
      </div>

      {arrival ? (
        <p className="mt-3 border-t border-slate-100 pt-2 text-[10px] text-slate-600 md:text-xs">
          <span className="font-semibold text-slate-700">Arrival:</span> {arrival}
        </p>
      ) : null}
    </section>
  )
}
