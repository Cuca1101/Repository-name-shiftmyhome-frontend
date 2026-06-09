import { useMemo } from 'react'

import { Calendar, Check, Lock } from 'lucide-react'

import { collectBreakdownDisplayLines } from '../../lib/pricingBreakdownDisplay'

import {

  buildQuoteReviewPriceOptions,

  formatReviewCalendarDate,

  formatReviewShortTimeLabel,

  getQuoteReviewSelectedOptionId,

} from '../../lib/quoteReviewPriceOptions'
import QuotePromoPriceReduction from './QuotePromoPriceReduction'
const panel =

  'rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-100/80 md:rounded-2xl md:p-4'



function scrollToPayment() {

  document.getElementById('quote-wizard-payment')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

}



function handlePayCta(onContinueToPayment) {

  if (typeof onContinueToPayment === 'function') {

    onContinueToPayment()

    return

  }

  scrollToPayment()

}



function useSelectedSlot({
  wizard,
  breakdown,
  pricingSettings,
  serviceType,
  lineItems,
  heavyItemCount,
  priceWithoutPromo = null,
}) {

  const options = useMemo(

    () =>

      buildQuoteReviewPriceOptions({

        settings: pricingSettings,

        serviceType,

        wizard,

        lineItems,

        heavyItemCount,

      }),

    [pricingSettings, serviceType, wizard, lineItems, heavyItemCount],

  )



  const selectedId = useMemo(() => getQuoteReviewSelectedOptionId(wizard), [wizard])

  const selected = options.find((o) => o.id === selectedId) || options[0]



  const moveDateLabel = selected?.dateLabel || (wizard?.moveDate ? formatReviewCalendarDate(wizard.moveDate) : '—')

  const dayNameLabel = selected?.dayName || ''

  const timeLabel = selected?.timeLabel || formatReviewShortTimeLabel(wizard)



  const total =

    breakdown?.estimatedTotal != null && Number.isFinite(breakdown.estimatedTotal)

      ? breakdown.estimatedTotal

      : selected?.estimatedTotal

  const totalFormatted = total != null ? `£${total.toFixed(2)}` : '—'



  return {
    selected,
    moveDateLabel,
    dayNameLabel,
    timeLabel,
    total,
    totalFormatted,
    breakdownRows: collectBreakdownDisplayLines(breakdown).slice(0, 6),
    priceWithoutPromo,
  }
}



/** Step 3 sidebar — date/time only (above quote reference). */

export function QuoteReviewSelectedSlot(props) {

  const { moveDateLabel, dayNameLabel, timeLabel, className = '' } = useSelectedSlot(props)



  return (

    <div

      className={`${panel} ${className}`.trim()}

      aria-labelledby="quote-review-selected-heading"

    >

      <div className="rounded-lg border border-emerald-200/90 bg-emerald-50/50 px-3 py-2.5">

        <div className="flex items-start gap-2">

          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">

            <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />

          </span>

          <div className="min-w-0">

            <p

              id="quote-review-selected-heading"

              className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800"

            >

              You selected

            </p>

            {dayNameLabel ? (

              <p className="text-sm font-bold text-slate-900">{dayNameLabel}</p>

            ) : null}

            <p className="text-sm font-bold text-slate-900">{moveDateLabel}</p>

            <p className="mt-0.5 text-xs text-slate-600">{timeLabel}</p>

          </div>

        </div>

      </div>

    </div>

  )

}



/** Step 3 sidebar — pay CTA below move summary. */

export function QuoteReviewPayCta({ onContinueToPayment, className = '' }) {
  return (
    <div className={`${panel} ${className}`.trim()}>
      <button
        type="button"
        onClick={() => handlePayCta(onContinueToPayment)}
        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:from-brand-700 hover:to-emerald-700 active:scale-[0.99]"
      >
        <Lock className="h-4 w-4" aria-hidden />
        Continue to payment →
      </button>
    </div>
  )
}



/**

 * Step 4 — full selected quote summary + pay CTA (desktop below summary / mobile inline).

 */

export default function QuoteReviewStickyPanel({

  wizard,

  breakdown,

  pricingSettings,

  serviceType,

  lineItems,

  heavyItemCount,

  priceWithoutPromo = null,

  onContinueToPayment,

  className = '',

  sticky = false,

}) {

  const { moveDateLabel, dayNameLabel, timeLabel, total, totalFormatted, breakdownRows } =
    useSelectedSlot({
    wizard,

    breakdown,

    pricingSettings,

    serviceType,

    lineItems,

    heavyItemCount,

    priceWithoutPromo,

  })



  return (

    <aside

      className={`${panel} ${sticky ? 'md:sticky md:top-24' : ''} ${className}`.trim()}

      aria-labelledby="quote-review-sticky-heading"

    >

      <h3 id="quote-review-sticky-heading" className="text-xs font-bold text-slate-900 md:text-sm">

        Selected quote

      </h3>



      <div className="mt-3 rounded-lg border border-emerald-200/90 bg-emerald-50/50 px-3 py-2.5">

        <div className="flex items-start gap-2">

          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">

            <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />

          </span>

          <div className="min-w-0">

            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800">Your slot</p>

            {dayNameLabel ? (

              <p className="text-[11px] font-semibold text-emerald-900/90">{dayNameLabel}</p>

            ) : null}

            <p className="text-sm font-bold text-slate-900">{moveDateLabel}</p>

            <p className="mt-0.5 text-xs text-slate-600">{timeLabel}</p>

          </div>

        </div>

      </div>



      {breakdownRows.length > 0 ? (

        <ul className="mt-3 space-y-1.5 text-[11px] md:text-xs">

          {breakdownRows.map((row, i) => (

            <li key={`${row.label}-${i}`} className="flex justify-between gap-2">

              <span className="min-w-0 text-slate-600">{row.label}</span>

              <span

                className={`shrink-0 tabular-nums font-medium ${

                  row.isDiscount ? 'text-emerald-700' : 'text-slate-900'

                }`}

              >

                {row.isDiscount ? '−' : ''}£{Math.abs(row.amount).toFixed(2)}

              </span>

            </li>

          ))}

        </ul>

      ) : null}



      <div className="mt-3 border-t border-slate-100 pt-3">

        <div className="flex items-end justify-between gap-2">

          <span className="text-xs font-semibold text-slate-700">Total (estimate)</span>

          <span className="text-xl font-bold tabular-nums text-emerald-700 md:text-2xl">{totalFormatted}</span>

        </div>

        <QuotePromoPriceReduction
          promoCode={wizard?.promoCode}
          pricingSettings={pricingSettings}
          priceWithPromo={total}
          priceWithoutPromo={priceWithoutPromo}
          className="mt-2"
          size="sm"
          showPromoCode
        />

      </div>



      <button

        type="button"

        onClick={() => handlePayCta(onContinueToPayment)}

        className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:from-brand-700 hover:to-emerald-700 active:scale-[0.99]"

      >

        <Lock className="h-4 w-4" aria-hidden />

        Continue to payment

      </button>



      <p className="mt-2 text-center text-[10px] leading-snug text-slate-500 md:text-xs">

        Secure checkout powered by Stripe. We&apos;ll confirm your exact arrival time the day before your move.

      </p>



      <p className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-slate-400">

        <Calendar className="h-3 w-3" aria-hidden />

        <span>Prices include applicable premiums where selected</span>

      </p>

    </aside>

  )

}

