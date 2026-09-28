import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { getLocalDateYYYYMMDD } from '../../lib/moveDateLocal'
import {
  addDaysToIsoDate,
  applyQuoteReviewPriceSelection,
  buildQuoteReviewPriceOptions,
  buildQuoteReviewPriceOptionsForCompact,
  buildQuoteReviewPriceOptionsForIsoDates,
  formatReviewCalendarMonthLabel,
  formatReviewCalendarParts,
  formatReviewCalendarYear,
  formatReviewShortTimeLabel,
  getQuoteCalendarPricingKey,
  getQuoteReviewSelectedOptionId,
  isReviewWeekendIso,
  listIsoDatesFrom,
  mondayOnOrBeforeIso,
  parseIsoDateParts,
} from '../../lib/quoteReviewPriceOptions'
import { alignReviewOptionsToLockedTotal } from '../../lib/quoteResumePriceLock'
import { useQuoteMoveWeather } from '../../hooks/useQuoteMoveWeather'
import QuotePromoPriceReduction, { QuotePromoCalendarPrice } from './QuotePromoPriceReduction'
import QuoteReviewPriceCard from './QuoteReviewPriceCard'
import { useQuoteWizard } from './QuoteWizardContext'

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
  weekGrid = false,
}) {
  const scrollRef = useRef(null)
  const { resumeLockedTotal } = useQuoteWizard()
  const { byDate: weatherByDate } = useQuoteMoveWeather(wizard?.pickupLat, wizard?.pickupLng)

  const todayIso = getLocalDateYYYYMMDD()
  const [windowStart, setWindowStart] = useState(
    () => mondayOnOrBeforeIso(wizard?.moveDate || todayIso) || mondayOnOrBeforeIso(todayIso),
  )
  const weekDates = useMemo(() => listIsoDatesFrom(windowStart, 28), [windowStart])
  const weekEnd = weekDates[weekDates.length - 1] || windowStart

  useEffect(() => {
    if (!weekGrid) return
    const selected = String(wizard?.moveDate || '')
    if (!selected) return
    const monday = mondayOnOrBeforeIso(selected)
    if (!monday) return
    setWindowStart((current) => {
      const end = addDaysToIsoDate(current, 27)
      if (selected >= current && selected <= end) return current
      return monday
    })
  }, [weekGrid, wizard?.moveDate])

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
      const raw = weekGrid
        ? buildQuoteReviewPriceOptionsForIsoDates({
            settings: pricingSettings,
            serviceType,
            wizard,
            lineItems,
            heavyItemCount,
            dates: weekDates,
          })
        : compact
          ? buildQuoteReviewPriceOptionsForCompact({
              settings: pricingSettings,
              serviceType,
              wizard,
              lineItems,
              heavyItemCount,
            })
          : buildQuoteReviewPriceOptions({
              settings: pricingSettings,
              serviceType,
              wizard,
              lineItems,
              heavyItemCount,
            })
      return alignReviewOptionsToLockedTotal(
        raw,
        resumeLockedTotal != null && Number.isFinite(resumeLockedTotal)
          ? resumeLockedTotal
          : null,
        getQuoteReviewSelectedOptionId(wizard),
      )
    } catch (err) {
      if (import.meta.env?.DEV) console.error('[QuoteReviewPriceCalendar]', err)
      return []
    }
  }, [
    compact,
    weekGrid,
    weekDates,
    pricingSettings,
    serviceType,
    lineItems,
    heavyItemCount,
    calendarPricingKey,
    resumeLockedTotal,
    wizard,
  ])

  const selectedOptionId = useMemo(() => getQuoteReviewSelectedOptionId(wizard), [wizard])

  useEffect(() => {
    if (weekGrid || !compact || !scrollRef.current) return
    scrollRef.current
      .querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [weekGrid, compact, selectedOptionId, options.length])

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

  if (weekGrid) {
    const optionByDate = new Map(options.map((option) => [option.moveDate, option]))
    const arrivalLabel = formatReviewShortTimeLabel(wizard, { compact: true })
    const currentMonday = mondayOnOrBeforeIso(todayIso)
    const prevStart = addDaysToIsoDate(windowStart, -28)
    const canGoBack = Boolean(prevStart && addDaysToIsoDate(prevStart, 27) >= todayIso)
    const maxStart = currentMonday ? addDaysToIsoDate(currentMonday, 28 * 6) : ''
    const canGoForward = Boolean(maxStart && windowStart < maxStart)
    const selectedHeading = formatSelectedDateHeading(wizard?.moveDate)

    return (
      <section
        className={`min-w-0 max-w-full overflow-x-hidden ${className}`.trim()}
        aria-labelledby="quote-review-price-calendar-heading"
      >
        <div className="mb-3">
          <h3 id="quote-review-price-calendar-heading" className="text-xl font-bold text-slate-900 sm:text-2xl">
            Choose your moving date
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Compare available dates and select the price that works for you.
          </p>
        </div>

        {selectedHeading ? (
          <p className="mb-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-slate-900 md:hidden">
            {selectedHeading}
            {arrivalLabel ? <span className="font-medium text-slate-600"> · {arrivalLabel}</span> : null}
          </p>
        ) : null}

        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={!canGoBack}
            onClick={() => prevStart && setWindowStart(prevStart)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Previous four weeks"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <p className="text-sm font-bold text-slate-900 sm:text-base">{formatWeekWindowLabel(windowStart, weekEnd)}</p>
          <button
            type="button"
            disabled={!canGoForward}
            onClick={() => {
              const next = addDaysToIsoDate(windowStart, 28)
              if (next) setWindowStart(next)
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Next four weeks"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {options.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Add a valid move date on step 1 to see price options here.
          </p>
        ) : (
          <div className="grid grid-cols-7 gap-1 sm:gap-2" role="listbox" aria-label="Move date prices">
            {weekDates.map((iso) => {
              const option = optionByDate.get(iso)
              const parts = formatReviewCalendarParts(iso)
              const past = iso < todayIso
              const selected = Boolean(option && option.id === selectedOptionId)
              const weekend = isReviewWeekendIso(iso)
              const price = selected && selectedTotal != null ? selectedTotal : option?.estimatedTotal
              const disabled = past || !option
              return (
                <button
                  key={iso}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-disabled={disabled}
                  disabled={disabled}
                  onClick={() => option && handleSelect(option)}
                  className={`relative flex min-h-[52px] min-w-0 flex-col items-center justify-center overflow-hidden rounded-xl border px-0.5 py-1 text-center transition md:min-h-[108px] md:rounded-2xl md:px-1.5 md:py-2 ${
                    selected
                      ? 'border-blue-600 bg-blue-50 shadow-sm ring-1 ring-blue-600'
                      : weekend
                        ? 'border-slate-200 bg-slate-50 hover:border-blue-200'
                        : 'border-slate-200 bg-white hover:border-blue-200'
                  } ${disabled ? 'cursor-not-allowed opacity-50 hover:border-slate-200' : ''}`}
                >
                  {selected ? (
                    <Check className="absolute right-1 top-1 h-3.5 w-3.5 text-blue-600 md:h-4 md:w-4" aria-hidden />
                  ) : null}
                  <span className="text-[9px] font-semibold leading-none text-slate-500 md:text-[11px]">
                    {parts.weekdayShort}
                  </span>
                  <span className={`mt-0.5 text-sm font-bold leading-none md:text-lg ${past ? 'text-slate-300' : 'text-slate-900'}`}>
                    {parts.dayNum}
                  </span>
                  <span className="mt-0.5 hidden text-[11px] font-medium text-slate-500 md:block">{parts.monthShort}</span>
                  <span className="mt-1 hidden text-[10px] leading-tight text-slate-500 md:block">{arrivalLabel}</span>
                  {price != null && Number.isFinite(price) ? (
                    <span className="mt-1 w-full">
                      {selected ? (
                        <span className="block text-[10px] font-extrabold tabular-nums text-emerald-700 md:text-sm">
                          £{price.toFixed(2)}
                        </span>
                      ) : (
                        <QuotePromoCalendarPrice
                          promoCode={wizard?.promoCode}
                          pricingSettings={pricingSettings}
                          priceWithPromo={option?.estimatedTotal}
                          priceWithoutPromo={option?.estimatedTotalWithoutPromo}
                          selected={false}
                          className="text-[10px] font-extrabold text-emerald-700 md:text-sm"
                        />
                      )}
                    </span>
                  ) : null}
                  {selected ? (
                    <span className="mt-1 hidden w-full rounded-md bg-blue-600 py-0.5 text-[9px] font-bold tracking-wide text-white md:block">
                      SELECTED
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        )}
      </section>
    )
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

function formatWeekWindowLabel(startIso, endIso) {
  const a = parseIsoDateParts(startIso)
  const b = parseIsoDateParts(endIso)
  if (!a || !b) return ''
  const startMonth = formatReviewCalendarMonthLabel(a.year, a.month)
  const endMonth = formatReviewCalendarMonthLabel(b.year, b.month)
  const yearA = formatReviewCalendarYear(a.year)
  const yearB = formatReviewCalendarYear(b.year)
  if (a.year === b.year && a.month === b.month) return `${startMonth} ${yearA}`
  if (a.year === b.year) return `${startMonth} – ${endMonth} ${yearA}`
  return `${startMonth} ${yearA} – ${endMonth} ${yearB}`
}

function formatSelectedDateHeading(isoDate) {
  const parts = parseIsoDateParts(isoDate)
  if (!parts) return ''
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
