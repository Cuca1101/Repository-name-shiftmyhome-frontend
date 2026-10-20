import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, Check, ChevronLeft, ChevronRight, Tag } from 'lucide-react'
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
import { findCheaperReviewDate } from '../../lib/reviewDateSavings'
import { packageFeeForBase, resolveServicePackages } from '../../lib/servicePackages'
import MobileStep1ArrivalWindow from './MobileStep1ArrivalWindow'
import { isCalendarBestPriceDate, resolveDaySlotAvailability } from '../../lib/calendarDayPricing'
import { useQuoteDaySlotCounts } from '../../hooks/useQuoteDaySlotCounts'
import { useQuoteMoveWeather } from '../../hooks/useQuoteMoveWeather'
import QuotePromoPriceReduction from './QuotePromoPriceReduction'
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
      wizard?.packingMaterialsQuantities,
      wizard?.packingMaterialsDetail,
      wizard?.packingWhat,
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
  const { counts: slotCounts, loaded: slotCountsLoaded } = useQuoteDaySlotCounts(
    weekDates[0] || '',
    weekEnd,
    pricingSettings,
  )

  function slotFor(iso) {
    const booked = slotCountsLoaded ? slotCounts[iso] || 0 : 0
    const slot = resolveDaySlotAvailability(pricingSettings, iso, booked)
    if (!slotCountsLoaded && slot.limited && slot.capacity > 0) {
      return { ...slot, full: false, remaining: slot.capacity }
    }
    return slot
  }

  function slotLabelFor(iso) {
    const slot = slotFor(iso)
    if (!slot.limited) return ''
    if (slot.full) return 'Full'
    return slotCountsLoaded ? `${slot.remaining} left` : `${slot.capacity} slots`
  }

  useEffect(() => {
    if (weekGrid || !compact || !scrollRef.current) return
    scrollRef.current
      .querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [weekGrid, compact, selectedOptionId, options.length])

  const selectedTotal =
    breakdown?.quoteBaseTotal != null && Number.isFinite(breakdown.quoteBaseTotal)
      ? breakdown.quoteBaseTotal
      : breakdown?.estimatedTotal != null && Number.isFinite(breakdown.estimatedTotal)
        ? breakdown.estimatedTotal
        : null

  const showPriceLabels = pricingSettings?.showCalendarBestPrice !== false
  const totalFormatted =
    selectedTotal != null ? `£${selectedTotal.toFixed(2)}` : breakdown ? 'Calculating…' : '—'

  function handleSelect(option) {
    if (typeof onWizardChange !== 'function' || !option) return
    if (slotFor(option.moveDate).full) return
    onWizardChange((prev) => applyQuoteReviewPriceSelection(prev, option.arrivalPatch))
  }

  if (weekGrid) {
    const optionByDate = new Map(options.map((option) => [option.moveDate, option]))
    const currentMonday = mondayOnOrBeforeIso(todayIso)
    const prevStart = addDaysToIsoDate(windowStart, -28)
    const canGoBack = Boolean(prevStart && addDaysToIsoDate(prevStart, 27) >= todayIso)
    const maxStart = currentMonday ? addDaysToIsoDate(currentMonday, 28 * 6) : ''
    const canGoForward = Boolean(maxStart && windowStart < maxStart)
    const selectedHeading = formatSelectedDateHeading(wizard?.moveDate)
    const selectedHeadingPrice =
      selectedTotal != null
        ? selectedTotal
        : options.find((option) => option.id === selectedOptionId)?.estimatedTotal
    const packageId = breakdown?.servicePackageId || wizard?.packageTier || 'standard'
    const selectedPackage = resolveServicePackages(pricingSettings)[packageId] || resolveServicePackages(pricingSettings).standard
    const cheaperDate = findCheaperReviewDate(
      options.map((option) => {
        const base = Number(option.estimatedTotal)
        const slot = slotFor(option.moveDate)
        const inclusive = Number.isFinite(base) ? Math.round((base + packageFeeForBase(base, selectedPackage)) * 100) / 100 : null
        return {
          moveDate: option.moveDate,
          total: inclusive,
          past: option.moveDate < todayIso,
          full: slot.full,
        }
      }),
      String(wizard?.moveDate || ''),
    )

    return (
      <section
        className={`min-w-0 max-w-full overflow-x-hidden ${className}`.trim()}
        aria-labelledby="quote-review-price-calendar-heading"
      >
        <div className="mb-3">
          <h3 id="quote-review-price-calendar-heading" className="text-base font-bold text-slate-900">
            Choose your moving date
          </h3>
        </div>

        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={!canGoBack}
            onClick={() => prevStart && setWindowStart(prevStart)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Previous four weeks"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <p className="min-w-0 flex-1 text-center text-sm font-bold leading-tight text-slate-900 min-[420px]:text-base">{formatWeekWindowLabel(windowStart, weekEnd)}</p>
          <button
            type="button"
            disabled={!canGoForward}
            onClick={() => {
              const next = addDaysToIsoDate(windowStart, 28)
              if (next) setWindowStart(next)
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
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
          <div className="quote-review-week-grid min-w-0" style={{ touchAction: 'pan-x pan-y pinch-zoom' }}>
            <div className="mx-auto mb-1 grid w-full max-w-xl grid-cols-7 gap-0.5 text-center text-[9px] font-semibold leading-none text-slate-500 min-[420px]:gap-1 min-[420px]:text-[10px]" aria-hidden>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="mx-auto grid w-full max-w-xl grid-cols-7 gap-0.5 min-[420px]:gap-1" role="listbox" aria-label="Move date prices">
            {weekDates.map((iso) => {
              const option = optionByDate.get(iso)
              const parts = formatReviewCalendarParts(iso)
              const past = iso < todayIso
              const selected = Boolean(option && option.id === selectedOptionId)
              const price = selected && selectedTotal != null ? selectedTotal : option?.estimatedTotal
              const isBest = Boolean(option && isCalendarBestPriceDate(pricingSettings, iso))
              const isWeekend = isReviewWeekendIso(iso)
              const slot = slotFor(iso)
              const disabled = past || !option || slot.full
              const slotText = !slot.limited || !option || past
                ? ''
                : slot.full
                  ? 'Full'
                  : `${slotCountsLoaded ? slot.remaining : slot.capacity} slots`
              return (
                <button
                  key={iso}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-disabled={disabled}
                  disabled={disabled}
                  onClick={() => option && handleSelect(option)}
                  className={`relative flex min-h-[4.5rem] min-w-0 flex-col items-center justify-center overflow-hidden rounded-lg border px-0 py-1 text-center transition min-[420px]:rounded-xl min-[420px]:px-0.5 ${
                    selected
                      ? 'border-blue-700 bg-blue-600 text-white shadow-sm'
                      : isWeekend && option && !past
                        ? 'border-red-100 bg-red-50 text-slate-900 hover:border-red-200'
                        : isBest
                          ? 'border-emerald-200 bg-emerald-50 text-slate-900 hover:border-emerald-300'
                          : option && !past
                            ? 'border-slate-200 bg-white text-slate-900 hover:border-slate-300'
                            : 'border-slate-200 bg-slate-50 text-slate-400'
                  } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  {selected ? (
                    <Check className="absolute right-0 top-0 h-2.5 w-2.5 text-white min-[420px]:right-0.5 min-[420px]:top-0.5 min-[420px]:h-3 min-[420px]:w-3" aria-hidden />
                  ) : null}
                  <span className={`text-[13px] font-extrabold leading-none min-[420px]:text-[15px] ${selected ? 'text-white' : past ? 'text-slate-300' : 'text-slate-900'}`}>
                    {parts.dayNum}
                  </span>
                  {price != null && Number.isFinite(price) ? (
                    <span className={`mt-0.5 max-w-full truncate text-[8px] font-bold tabular-nums leading-none tracking-tight min-[420px]:mt-1 min-[420px]:text-[9px] ${
                      selected ? 'text-white' : isWeekend ? 'text-red-800' : isBest ? 'text-emerald-700' : 'text-slate-600'
                    }`}>
                      £{price.toFixed(2)}
                    </span>
                  ) : null}
                  {slotText ? (
                    <span className={`mt-0.5 max-w-full truncate text-[7px] font-semibold leading-none min-[420px]:text-[8px] ${selected ? 'text-white' : 'text-slate-700'}`}>
                      {slotText}
                    </span>
                  ) : null}
                </button>
              )
            })}
            </div>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-[11px] font-semibold text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden />
            Best price
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600" aria-hidden />
            Selected
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" aria-hidden />
            Weekend
          </span>
        </div>
        {selectedHeading ? (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold text-slate-900 sm:text-base">
              <CalendarDays className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
              <span>{formatSelectedDateLong(wizard?.moveDate)}</span>
              {selectedHeadingPrice != null && Number.isFinite(Number(selectedHeadingPrice)) ? (
                <span className="text-lg font-bold text-blue-700 sm:text-xl">
                  Estimated price{' '}
                  <span className="text-xl tabular-nums sm:text-2xl">£{Number(selectedHeadingPrice).toFixed(2)}</span>
                </span>
              ) : null}
            </p>
            <div className="mt-2">
              <MobileStep1ArrivalWindow
                data={wizard}
                onChange={onWizardChange}
                triggerId="review-arrival-window"
                hideLabel
                chevronDown
                variant="mobile-card"
              />
            </div>
            {cheaperDate ? (
              <button
                type="button"
                onClick={() => {
                  const option = optionByDate.get(cheaperDate.moveDate)
                  if (option) handleSelect(option)
                }}
                className="mt-2 flex w-full items-center justify-between gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-left text-sm font-semibold text-emerald-800"
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  <Tag className="h-4 w-4 shrink-0" aria-hidden />
                  <span>Save £{cheaperDate.save.toFixed(2)} on {formatSavingsDate(cheaperDate.moveDate)}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
              </button>
            ) : null}
          </div>
        ) : null}
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
      priceTone={
        isCalendarBestPriceDate(pricingSettings, option.moveDate)
          ? 'best'
          : isReviewWeekendIso(option.moveDate)
            ? 'weekend'
            : 'standard'
      }
      slotsLeftLabel={slotLabelFor(option.moveDate)}
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

function formatSelectedDateLong(isoDate) {
  const parts = parseIsoDateParts(isoDate)
  if (!parts) return ''
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(parts.year, parts.month, parts.day))
}

function formatSavingsDate(isoDate) {
  const parts = parseIsoDateParts(isoDate)
  if (!parts) return ''
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(parts.year, parts.month, parts.day))
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
