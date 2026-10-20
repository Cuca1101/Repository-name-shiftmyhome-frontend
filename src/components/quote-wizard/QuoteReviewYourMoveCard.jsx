import { Calendar, CreditCard, FileText, Lock, MapPin, ShieldCheck, Users } from 'lucide-react'
import { PACKING_MATERIALS_CATALOG } from '../../lib/packingMaterialsCatalog'
import { formatMoveSummaryCrewForPricing } from '../../lib/moveSummaryDisplay'
import { placeSummary } from './ReviewMoveSummaries'
import { formatReviewShortTimeLabel, parseIsoDateParts } from '../../lib/quoteReviewPriceOptions'
import QuotePromoPriceReduction from './QuotePromoPriceReduction'
import QuoteReferenceCard from './QuoteReferenceCard'
import QuoteRouteMap from './QuoteRouteMap'
import MakeAnOfferPanel from './MakeAnOfferPanel'
import { WHATSAPP_URL } from '../../config'

function formatSelectedMoveDate(isoDate) {
  const parts = parseIsoDateParts(isoDate)
  if (!parts) return '—'
  const dt = new Date(parts.year, parts.month, parts.day)
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
    .format(dt)
    .replace(',', '')
}

function isCustomerOptionalExtraLine(label) {
  const text = String(label || '')
  return (
    /^Packing \(/i.test(text) ||
    /^Fragile packing/i.test(text) ||
    text === 'Packing materials' ||
    /^Dismantling \(/i.test(text) ||
    /^Reassembly \(/i.test(text) ||
    /^Waiting time \(/i.test(text) ||
    /^Extra helper/i.test(text) ||
    PACKING_MATERIALS_CATALOG.some((item) => text.startsWith(`${item.label} (`))
  )
}

function optionalExtrasAmount(breakdown) {
  const lines = Array.isArray(breakdown?.extrasLines) ? breakdown.extrasLines : []
  const sum = lines.reduce(
    (total, line) => (isCustomerOptionalExtraLine(line?.label) ? total + (Number(line.amount) || 0) : total),
    0,
  )
  return Math.round(sum * 100) / 100
}

function formatVolume(totalM3) {
  const n = Number(totalM3)
  if (!Number.isFinite(n) || n <= 0) return '—'
  return `${n.toFixed(1)} m³`
}

/**
 * Step 3 sidebar — live move facts and the checkout total.
 * The total is always `breakdown.estimatedTotal`, the same figure payment uses.
 */
export default function QuoteReviewYourMoveCard({
  wizard,
  breakdown,
  pricingSettings = null,
  totalM3 = 0,
  priceWithoutPromo = null,
  onContinueToPayment,
  onBack,
  continueDisabled = false,
  hideContinue = false,
  quoteRef = '',
  onDistanceFromRoute,
  showReference = true,
  showMap = true,
  className = '',
  showOffer = false,
  continueLabel = 'Continue to payment',
  headingId = 'quote-your-move-heading',
}) {
  const total =
    breakdown?.estimatedTotal != null && Number.isFinite(breakdown.estimatedTotal)
      ? breakdown.estimatedTotal
      : null
  const totalFormatted = total != null ? `£${total.toFixed(2)}` : '—'
  const ref = String(quoteRef || '').trim()
  const crew = formatMoveSummaryCrewForPricing(
    wizard?.crewSize,
    breakdown?.crewSizeUsedInPricing,
    pricingSettings,
  )
  const arrival = formatReviewShortTimeLabel(wizard)
  const extras = optionalExtrasAmount(breakdown)
  const movePrice =
    breakdown?.quoteBaseTotal != null && Number.isFinite(breakdown.quoteBaseTotal)
      ? Math.round((breakdown.quoteBaseTotal - extras) * 100) / 100
      : null
  const packageFee = Number.isFinite(Number(breakdown?.servicePackageFee)) ? Number(breakdown.servicePackageFee) : 0
  const packageLabel = breakdown?.servicePackageUpgradeLabel || 'Package upgrade'
  const crewCount = Number(breakdown?.crewSizeUsedInPricing || wizard?.crewSize)
  const crewLine = Number.isFinite(crewCount) && crewCount >= 1
    ? `${crewCount} mover${crewCount === 1 ? '' : 's'}`
    : crew
  const rows = [
    { key: 'pickup', icon: MapPin, label: 'Pickup: ' + placeSummary(wizard, 'pickup') },
    { key: 'delivery', icon: MapPin, label: 'Delivery: ' + placeSummary(wizard, 'delivery') },
    { key: 'when', icon: Calendar, label: [formatSelectedMoveDate(wizard?.moveDate), arrival].filter(Boolean).join(' · ') },
    { key: 'crew', icon: Users, label: [crewLine, formatVolume(totalM3)].filter((part) => part && part !== '—').join(' · ') || '—' },
  ]

  return (
    <div
      className={`flex min-w-0 flex-col gap-4 ${className}`.trim()}
    >
      {showReference ? <QuoteReferenceCard quoteRef={ref} /> : null}

      {showMap ? (
        <div className="quote-sidebar-route-map overflow-hidden rounded-xl shadow-sm ring-1 ring-slate-100 md:rounded-2xl [&_.relative]:!h-[12rem] [&_.relative]:!min-h-[12rem] [&_.relative]:!max-h-[12rem] md:[&_.relative]:!h-[15rem] md:[&_.relative]:!min-h-[15rem] md:[&_.relative]:!max-h-[15rem] [&_.quote-route-map]:rounded-xl [&_.quote-route-map]:border-0 [&_.quote-route-map]:shadow-none md:[&_.quote-route-map]:rounded-2xl">
          <QuoteRouteMap
            variant="review"
            pickupLng={wizard?.pickupLng}
            pickupLat={wizard?.pickupLat}
            deliveryLng={wizard?.deliveryLng}
            deliveryLat={wizard?.deliveryLat}
            distanceMiles={wizard?.distanceMiles}
            onDistanceFromRoute={onDistanceFromRoute}
          />
        </div>
      ) : null}

    <aside
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]"
      aria-labelledby={headingId}
    >
      <h3 id={headingId} className="flex items-center gap-2 text-base font-bold text-slate-900">
        <FileText className="h-4 w-4 text-slate-500" aria-hidden />
        Your move
      </h3>
      <ul className="mt-3 space-y-2.5">
        {rows.map((row) => {
          const Icon = row.icon
          return (
            <li key={row.key} className="flex items-start gap-2.5 text-sm text-slate-800">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              <span className="min-w-0 break-words leading-snug">{row.label}</span>
            </li>
          )
        })}
      </ul>
      <dl className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-slate-600">Move price</dt>
          <dd className="font-semibold tabular-nums text-slate-900">
            {movePrice != null ? `£${movePrice.toFixed(2)}` : totalFormatted}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-slate-600">{packageLabel}</dt>
          <dd className="font-semibold tabular-nums text-slate-900">£{packageFee.toFixed(2)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-slate-600">Optional extras</dt>
          <dd className="font-semibold tabular-nums text-slate-900">£{extras.toFixed(2)}</dd>
        </div>
        <div className="flex items-end justify-between gap-3 pt-1">
          <dt className="font-semibold text-slate-800">Total</dt>
          <dd className="text-[1.75rem] font-extrabold leading-none tabular-nums text-blue-600">{totalFormatted}</dd>
        </div>
      </dl>
      <QuotePromoPriceReduction
        promoCode={wizard?.promoCode}
        pricingSettings={pricingSettings}
        priceWithPromo={total}
        priceWithoutPromo={priceWithoutPromo}
        className="mt-1"
        size="sm"
        showPromoCode
      />
      {hideContinue ? null : (
        <div className="mt-4 flex items-stretch gap-6 sm:gap-8">
          {typeof onBack === 'function' ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex min-h-[52px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 sm:min-w-[7.5rem] sm:px-6"
            >
              <span aria-hidden>←</span>
              Back
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onContinueToPayment?.()}
            disabled={continueDisabled}
            className="flex min-h-[52px] min-w-0 flex-1 items-center justify-center rounded-xl bg-blue-600 px-5 text-base font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:px-6"
          >
            {continueLabel} <span aria-hidden>›</span>
          </button>
        </div>
      )}
    </aside>
      {showOffer ? <MakeAnOfferPanel /> : null}
      <ul className="flex items-center justify-between gap-2 px-1 text-[11px] font-semibold text-slate-600 sm:text-xs">
        <li className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-slate-500" aria-hidden />Insured</li>
        <li className="inline-flex items-center gap-1.5"><Lock className="h-4 w-4 text-slate-500" aria-hidden />Secure payment</li>
        <li className="inline-flex items-center gap-1.5"><CreditCard className="h-4 w-4 text-slate-500" aria-hidden />No hidden fees</li>
      </ul>
      <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 self-center text-sm font-semibold text-emerald-600">
        <svg className="h-4 w-4 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
        Need help? Chat on WhatsApp <span aria-hidden>›</span>
      </a>
    </div>
  )
}
