import { useEffect, useMemo, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  applyQuoteReviewPriceSelection,
  buildQuoteReviewPriceOptions,
  buildQuoteReviewPriceOptionsForCompact,
  formatReviewCalendarMonthLabel,
  formatReviewCalendarYear,
  getQuoteCalendarPricingKey,
  getQuoteReviewSelectedOptionId,
  parseIsoDateParts,
} from '../../lib/quoteReviewPriceOptions'
import { useQuoteMoveWeather } from '../../hooks/useQuoteMoveWeather'
import QuotePromoPriceReduction from './QuotePromoPriceReduction'
import QuoteReviewPriceCard from './QuoteReviewPriceCard'

/** Calendar-style date/time price cards for Step 3 review. */
export default function QuoteReviewPriceCalendar({
  wizard,
  onWizardChange,
  breakdown,
  pricingSettings,
  serviceType,
  lineItems,
  heavyItemCount,
  priceWithoutPromo = null,
  className = '',
  compact = false,
  showSelectedTotal = true,
}) {
  const scrollRef = useRef(null)
  const { byDate: weatherByDate } = useQuoteMoveWeather(wizard?.pickupLat, wizard?.pickupLng)

  const compactMonthLabel = useMemo(() => {
    const parts = parseIsoDateParts(wizard?.moveDate)
    if (!parts) return ''
    return `${formatReviewCalendarMonthLabel(parts.year, parts.month)} ${formatReviewCalendarYear(parts.year)}`
  }, [wizard?.moveDate])

  const calendarPricingKey = useMemo(
    () => getQuoteCalendarPricingKey(wizard, lineItems, heavyItemCount, serviceType),
    [
      wizard?.moveDate,
      wizard?.arrivalWindow,
      wizard?.exactArrivalTime,
      wizard?.flexibleArrivalFrom,
      wizard?.flexibleArrivalUntil,
      wizard?.distanceMiles,
      wizard?.mapboxRouteDurationSeconds,
      wizard?.pickupFloor,
      wizard?.deliveryFloor,
      wizard?.pickupLift,
      wizard?.deliveryLift,
      wizard?.walkingDistance,
      wizard?.parkingDistance,
      wizard?.stairsFlights,
      wizard?.packing,
      wizard?.packingApproxBoxes,
      wizard?.packingFragile,
      wizard?.packingMaterials,
      wizard?.dismantling,
      wizard?.dismantlingItemCount,
      wizard?.reassembly,
      wizard?.reassemblyItemCount,
      wizard?.reassemblySameAsDismantling,
      wizard?.promoCode,
      wizard?.packageTier,
      wizard?.crewSize,
      lineItems,
      heavyItemCount,
      serviceType,
    ],
  )

  const options = useMemo(() => {
    if (!pricingSettings) return []
    try {
      if (compact) {
        return buildQuoteReviewPriceOptionsForCompact({
          settings: pricingSettings,
          serviceType,
          wizard,
          lineItems,
          heavyItemCount,
        })
      }
      return buildQuoteReviewPriceOptions({
        settings: pricingSettings,
        serviceType,
        wizard,
        lineItems,
        heavyItemCount,
      })
    } catch (err) {
      if (import.meta.env?.DEV) console.error('[QuoteReviewPriceCalendar]', err)
      return []
    }
  }, [compact, pricingSettings, serviceType, lineItems, heavyItemCount, calendarPricingKey])

  const selectedOptionId = useMemo(() => getQuoteReviewSelectedOptionId(wizard), [wizard])

  useEffect(() => {
    if (!compact || !scrollRef.current) return
    scrollRef.current
      .querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [compact, selectedOptionId, options.length])

  const selectedTotal =
    breakdown?.estimatedTotal != null && Number.isFinite(breakdown.estimatedTotal)
      ? breakdown.estimatedTotal
      : null
  const totalFormatted =
    selectedTotal != null ? `£${selectedTotal.toFixed(2)}` : breakdown ? 'Calculating…' : '—'

  function handleSelect(option) {
    if (typeof onWizardChange !== 'function') return
    onWizardChange((prev) => applyQuoteReviewPriceSelection(prev, option.arrivalPatch))
  }

  function scrollDays(direction) {
    const el = scrollRef.current
    if (!el) return
    const card = el.querySelector('.quote-review-price-card')
    const cardWidth = card?.offsetWidth || 132
    el.scrollBy({ left: direction * (cardWidth * 2 + 8), behavior: 'smooth' })
  }

  const cardGridClass =
    'quote-review-calendar-compact quote-review-calendar-compact__track flex min-w-0 flex-1 gap-1 overflow-x-auto overscroll-x-contain pb-1 snap-x snap-mandatory [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'

  const cardProps = {
    wizard,
    weatherByDate,
    pricingSettings,
    onSelect: handleSelect,
  }

  const cards = options.map((option) => (
    <QuoteReviewPriceCard
      key={option.id}
      option={option}
      selected={option.id === selectedOptionId}
      {...cardProps}
    />
  ))

  return (
    <section
      className={`min-w-0 max-w-full ${compact ? 'quote-review-calendar-section space-y-2' : 'space-y-4'} ${className}`.trim()}
      aria-labelledby="quote-review-price-calendar-heading"
    >
      <div className="quote-review-calendar-header">
        <div className="flex items-start justify-between gap-1.5">
          <h3
            id="quote-review-price-calendar-heading"
            className="min-w-0 flex-1 text-xs font-bold text-slate-900 md:text-base"
          >
            Choose your preferred date
          </h3>
          {compact ? (
            <QuotePromoPriceReduction
              promoCode={wizard?.promoCode}
              pricingSettings={pricingSettings}
              priceWithPromo={selectedTotal}
              priceWithoutPromo={priceWithoutPromo}
              className="quote-review-calendar-promo max-w-[10.25rem] shrink-0 self-start"
              size="sm"
              showPromoCode
              align="end"
            />
          ) : null}
        </div>

        {!compact ? (
          <p className="mt-0.5 text-xs leading-relaxed text-slate-600 md:text-sm">
            Compare dates and arrival windows. Your total updates when you select an option.
          </p>
        ) : (
          <p className="mt-0.5 text-[10px] leading-snug text-slate-500">
            Tap a date to update your quote total.
          </p>
        )}

        {compact && compactMonthLabel ? (
          <p className="quote-review-calendar-month-label mt-1.5 text-center">
            {compactMonthLabel}
          </p>
        ) : null}
      </div>

      {showSelectedTotal && !compact ? (
        <div
          className="rounded-2xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50/70 to-white px-4 py-3 shadow-sm md:px-5 md:py-4"
          aria-live="polite"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Selected quote total
          </p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-emerald-700 md:text-3xl">
            {totalFormatted}
          </p>
          <QuotePromoPriceReduction
            promoCode={wizard?.promoCode}
            pricingSettings={pricingSettings}
            priceWithPromo={selectedTotal}
            priceWithoutPromo={priceWithoutPromo}
            className="mt-2"
            size="sm"
            showPromoCode
          />
        </div>
      ) : null}

      {options.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 md:px-4 md:py-3 md:text-sm">
          {compact && wizard?.moveDate
            ? 'No bookable dates available. Check your move date on step 1.'
            : 'Add a valid move date on step 1 to see price options here.'}
        </p>
      ) : compact ? (
        <div className="quote-review-calendar-carousel mt-1 flex min-w-0 items-stretch gap-0.5 md:mt-1.5 md:gap-2">
          <button
            type="button"
            onClick={() => scrollDays(-1)}
            className="inline-flex h-7 w-6 shrink-0 items-center justify-center self-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-brand-200 hover:bg-brand-50/50 active:scale-95 md:h-8 md:w-8"
            aria-label="Scroll dates left"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <div
            ref={scrollRef}
            className={cardGridClass}
            role="listbox"
            aria-label="Move date and time price options"
          >
            {cards}
          </div>
          <button
            type="button"
            onClick={() => scrollDays(1)}
            className="inline-flex h-7 w-6 shrink-0 items-center justify-center self-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-brand-200 hover:bg-brand-50/50 active:scale-95 md:h-8 md:w-8"
            aria-label="Scroll dates right"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : (
        <div className={cardGridClass} role="listbox" aria-label="Move date and time price options">
          {cards}
        </div>
      )}

      {!compact ? (
        <p className="text-[11px] leading-relaxed text-slate-500 md:text-xs">
          Prices use the same estimate as your quote details. Bank holidays, weekends, same-day,
          and exact-time premiums are included where they apply.
        </p>
      ) : null}
    </section>
  )
}
