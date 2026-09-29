import { Box, Calendar, Clock, Lock, MapPin, Users } from 'lucide-react'
import { cityFromAddress } from '../../lib/journeyPlannerDisplay'
import { formatMoveSummaryCrewForPricing } from '../../lib/moveSummaryDisplay'
import { formatReviewShortTimeLabel, parseIsoDateParts } from '../../lib/quoteReviewPriceOptions'
import QuotePromoPriceReduction from './QuotePromoPriceReduction'

function placeLabel(address) {
  const city = cityFromAddress(address)
  if (city) return city
  const first = String(address || '')
    .split(',')
    .map((part) => part.trim())
    .find(Boolean)
  return first || '—'
}

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
  className = '',
  sticky = false,
}) {
  const total =
    breakdown?.estimatedTotal != null && Number.isFinite(breakdown.estimatedTotal)
      ? breakdown.estimatedTotal
      : null
  const totalFormatted = total != null ? `£${total.toFixed(2)}` : '—'
  const crew = formatMoveSummaryCrewForPricing(
    wizard?.crewSize,
    breakdown?.crewSizeUsedInPricing,
    pricingSettings,
  )
  const arrival = formatReviewShortTimeLabel(wizard)
  const rows = [
    { icon: MapPin, label: `${placeLabel(wizard?.pickupAddress)} → ${placeLabel(wizard?.deliveryAddress)}` },
    { icon: Calendar, label: formatSelectedMoveDate(wizard?.moveDate) },
    { icon: Clock, label: arrival || '—' },
    { icon: Users, label: crew || '—' },
    { icon: Box, label: formatVolume(totalM3) },
  ]

  return (
    <aside
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ${
        sticky ? 'md:sticky md:top-24' : ''
      } ${className}`.trim()}
      aria-labelledby="quote-your-move-heading"
    >
      <h3 id="quote-your-move-heading" className="text-base font-bold text-slate-900">
        Your move
      </h3>
      <ul className="mt-3 space-y-2.5">
        {rows.map((row) => {
          const Icon = row.icon
          return (
            <li key={row.label} className="flex items-start gap-2.5 text-sm text-slate-800">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
              <span className="min-w-0 leading-snug">{row.label}</span>
            </li>
          )
        })}
      </ul>
      <dl className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-slate-600">Move price</dt>
          <dd className="font-semibold tabular-nums text-slate-900">
            {breakdown?.quoteBaseTotal != null && Number.isFinite(breakdown.quoteBaseTotal)
              ? `£${breakdown.quoteBaseTotal.toFixed(2)}`
              : totalFormatted}
          </dd>
        </div>
        {breakdown?.servicePackageFee > 0 ? (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-slate-600">{breakdown.servicePackageUpgradeLabel || 'Package upgrade'}</dt>
            <dd className="font-semibold tabular-nums text-slate-900">£{breakdown.servicePackageFee.toFixed(2)}</dd>
          </div>
        ) : null}
        <div className="flex items-end justify-between gap-3 pt-1">
          <dt className="font-semibold text-slate-800">Total</dt>
          <dd className="text-2xl font-bold tabular-nums text-slate-900">{totalFormatted}</dd>
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
      <button
        type="button"
        onClick={() => onContinueToPayment?.()}
        className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-blue-700"
      >
        Continue to payment →
      </button>
      <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-slate-500">
        <Lock className="h-3.5 w-3.5" aria-hidden />
        Secure checkout
      </p>
    </aside>
  )
}
