import { useEffect, useMemo, useState } from 'react'

import { Check, ChevronLeft, ChevronRight } from 'lucide-react'

import { getLocalDateYYYYMMDD } from '../../lib/moveDateLocal'

import {

  addMonthsToDate,

  applyQuoteReviewPriceSelection,

  buildQuoteReviewPriceOptions,

  buildQuoteReviewPriceOptionsForMonth,

  formatReviewCalendarMonthLabel,

  formatReviewCalendarParts,

  formatReviewCalendarYear,

  formatReviewShortTimeLabel,

  getQuoteCalendarPricingKey,

  getQuoteReviewSelectedOptionId,

  parseIsoDateParts,

  startOfMonthDate,

} from '../../lib/quoteReviewPriceOptions'



const MAX_CALENDAR_MONTHS_AHEAD = 24



function initialViewMonth(moveDate) {

  const parts = parseIsoDateParts(moveDate)

  if (parts) return startOfMonthDate(parts.year, parts.month)

  const today = getLocalDateYYYYMMDD()

  const t = parseIsoDateParts(today)

  if (t) return startOfMonthDate(t.year, t.month)

  const now = new Date()

  return startOfMonthDate(now.getFullYear(), now.getMonth())

}



function monthStartFromToday() {

  const today = getLocalDateYYYYMMDD()

  const t = parseIsoDateParts(today)

  if (t) return startOfMonthDate(t.year, t.month)

  const now = new Date()

  return startOfMonthDate(now.getFullYear(), now.getMonth())

}



function maxViewMonth() {

  return addMonthsToDate(monthStartFromToday(), MAX_CALENDAR_MONTHS_AHEAD)

}



/**

 * Calendar-style date/time price cards for Step 3 review.

 */

export default function QuoteReviewPriceCalendar({

  wizard,

  onWizardChange,

  breakdown,

  pricingSettings,

  serviceType,

  lineItems,

  heavyItemCount,

  className = '',

  compact = false,

  showSelectedTotal = true,

}) {

  const [viewMonth, setViewMonth] = useState(() => initialViewMonth(wizard?.moveDate))



  useEffect(() => {

    const parts = parseIsoDateParts(wizard?.moveDate)

    if (!parts) return

    setViewMonth((prev) => {

      if (prev.getFullYear() === parts.year && prev.getMonth() === parts.month) return prev

      return startOfMonthDate(parts.year, parts.month)

    })

  }, [wizard?.moveDate])



  const minViewMonth = useMemo(() => monthStartFromToday(), [])

  const maxViewMonthDate = useMemo(() => maxViewMonth(), [])



  const canGoPrevMonth =

    viewMonth.getFullYear() > minViewMonth.getFullYear() ||

    (viewMonth.getFullYear() === minViewMonth.getFullYear() &&

      viewMonth.getMonth() > minViewMonth.getMonth())



  const canGoNextMonth =

    viewMonth.getFullYear() < maxViewMonthDate.getFullYear() ||

    (viewMonth.getFullYear() === maxViewMonthDate.getFullYear() &&

      viewMonth.getMonth() < maxViewMonthDate.getMonth())



  const viewYear = viewMonth.getFullYear()

  const viewMonthIndex = viewMonth.getMonth()



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

        return buildQuoteReviewPriceOptionsForMonth({

          settings: pricingSettings,

          serviceType,

          wizard,

          lineItems,

          heavyItemCount,

          year: viewYear,

          month: viewMonthIndex,

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

  }, [

    compact,

    pricingSettings,

    serviceType,

    lineItems,

    heavyItemCount,

    calendarPricingKey,

    viewYear,

    viewMonthIndex,

  ])



  const selectedOptionId = useMemo(() => getQuoteReviewSelectedOptionId(wizard), [wizard])



  const selectedTotal =

    breakdown?.estimatedTotal != null && Number.isFinite(breakdown.estimatedTotal)

      ? breakdown.estimatedTotal

      : null

  const totalFormatted =

    selectedTotal != null ? `£${selectedTotal.toFixed(2)}` : breakdown ? 'Calculating…' : '—'



  function handleSelect(option) {

    if (typeof onWizardChange !== 'function') return

    if (typeof onWizardChange === 'function') {

      onWizardChange((prev) => applyQuoteReviewPriceSelection(prev, option.arrivalPatch))

    }

  }



  const cardGridClass = compact

    ? 'quote-review-calendar-compact flex max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-1 snap-x snap-mandatory [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'

    : 'grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-2 xl:grid-cols-3'



  return (

    <section

      className={`min-w-0 max-w-full ${compact ? 'space-y-2 overflow-hidden' : 'space-y-4'} ${className}`.trim()}

      aria-labelledby="quote-review-price-calendar-heading"

    >

      <div>

        <h3

          id="quote-review-price-calendar-heading"

          className={`font-bold text-slate-900 ${compact ? 'text-xs md:text-sm' : 'text-sm md:text-base'}`}

        >

          Choose your preferred date

        </h3>

        {!compact ? (

          <p className="mt-0.5 text-xs leading-relaxed text-slate-600 md:text-sm">

            Compare dates and arrival windows. Your total updates when you select an option.

          </p>

        ) : (

          <p className="mt-0.5 text-[10px] leading-snug text-slate-500 md:text-xs">

            Tap a date to update your quote total.

          </p>

        )}

        {compact ? (

          <div className="mt-2 space-y-1">

            <p className="text-center text-sm font-bold tabular-nums text-slate-900 md:text-base">

              {formatReviewCalendarYear(viewYear)}

            </p>

            <div className="flex items-center justify-between gap-2">

              <button

                type="button"

                disabled={!canGoPrevMonth}

                onClick={() => canGoPrevMonth && setViewMonth((m) => addMonthsToDate(m, -1))}

                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-brand-200 hover:bg-brand-50/50 disabled:cursor-not-allowed disabled:opacity-40"

                aria-label="Previous month"

              >

                <ChevronLeft className="h-5 w-5" aria-hidden />

              </button>

              <p className="min-w-0 flex-1 text-center text-sm font-semibold text-slate-800 md:text-base">

                {formatReviewCalendarMonthLabel(viewYear, viewMonthIndex)}

              </p>

              <button

                type="button"

                disabled={!canGoNextMonth}

                onClick={() => canGoNextMonth && setViewMonth((m) => addMonthsToDate(m, 1))}

                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-brand-200 hover:bg-brand-50/50 disabled:cursor-not-allowed disabled:opacity-40"

                aria-label="Next month"

              >

                <ChevronRight className="h-5 w-5" aria-hidden />

              </button>

            </div>

          </div>

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

        </div>

      ) : null}



      {options.length === 0 ? (

        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 md:px-4 md:py-3 md:text-sm">

          {compact && wizard?.moveDate

            ? 'No bookable dates in this month. Use the arrows to pick another month.'

            : 'Add a valid move date on step 1 to see price options here.'}

        </p>

      ) : (

        <div className={cardGridClass} role="listbox" aria-label="Move date and time price options">

          {options.map((option) => {

            const selected = option.id === selectedOptionId

            const priceLabel =

              option.estimatedTotal != null ? `£${option.estimatedTotal.toFixed(2)}` : '—'

            const parts = formatReviewCalendarParts(option.moveDate)

            const timeShort = formatReviewShortTimeLabel(wizard)



            if (compact) {

              return (

                <button

                  key={option.id}

                  type="button"

                  role="option"

                  aria-selected={selected}

                  onClick={() => handleSelect(option)}

                  className={`relative flex min-h-[92px] w-[6.75rem] max-w-[42vw] shrink-0 snap-start touch-manipulation flex-col rounded-xl border p-2 text-left transition active:scale-[0.99] xxs:min-h-[96px] xxs:w-[7rem] sm:min-h-[100px] sm:max-w-none sm:w-[7.75rem] sm:p-2.5 ${

                    selected

                      ? 'border-brand-500 bg-brand-50/80 ring-2 ring-brand-500/25'

                      : 'border-slate-200 bg-white hover:border-brand-200'

                  }`}

                >

                  {selected ? (

                    <span className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white">

                      <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />

                    </span>

                  ) : null}

                  <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">

                    {parts.weekdayShort}

                  </span>

                  <span className="mt-0.5 text-xl font-bold leading-none text-slate-900">

                    {parts.dayNum}

                  </span>

                  <span className="text-[10px] font-medium text-slate-600">{parts.monthShort}</span>

                  <span className="mt-1.5 line-clamp-2 text-[9px] leading-tight text-slate-500">

                    {timeShort}

                  </span>

                  <span

                    className={`mt-auto pt-1.5 text-sm font-bold tabular-nums ${

                      selected ? 'text-emerald-700' : 'text-slate-900'

                    }`}

                  >

                    {priceLabel}

                  </span>

                  {selected ? (

                    <span className="text-[8px] font-bold uppercase tracking-wide text-brand-700">

                      Selected

                    </span>

                  ) : null}

                </button>

              )

            }



            return (

              <button

                key={option.id}

                type="button"

                role="option"

                aria-selected={selected}

                onClick={() => handleSelect(option)}

                className={`group relative flex min-h-[132px] w-full flex-col rounded-2xl border p-3.5 text-left shadow-sm transition active:scale-[0.99] md:min-h-[148px] md:p-4 ${

                  selected

                    ? 'border-brand-500 bg-gradient-to-br from-brand-50/90 to-white ring-2 ring-brand-500/30'

                    : 'border-slate-200 bg-white hover:border-brand-200 hover:bg-brand-50/30'

                }`}

              >

                {selected ? (

                  <span className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white shadow-sm">

                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />

                  </span>

                ) : null}

                <span className="pr-8 text-[10px] font-semibold uppercase tracking-wide text-slate-500">

                  {option.dayName}

                </span>

                <span className="mt-0.5 text-lg font-bold leading-tight text-slate-900 md:text-xl">

                  {option.dateLabel}

                </span>

                <span className="mt-2 line-clamp-2 text-xs leading-snug text-slate-600">

                  {option.timeLabel}

                </span>

                <span

                  className={`mt-auto pt-3 text-xl font-bold tabular-nums md:text-2xl ${

                    selected ? 'text-emerald-700' : 'text-slate-900 group-hover:text-brand-800'

                  }`}

                >

                  {priceLabel}

                </span>

                {selected ? (

                  <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-brand-700">

                    Selected

                  </span>

                ) : null}

              </button>

            )

          })}

        </div>

      )}



      {!compact ? (

        <p className="text-[11px] leading-relaxed text-slate-500 md:text-xs">

          Prices use the same estimate as your quote details. Weekend, same-day, and exact-time

          premiums are included where they apply.

        </p>

      ) : null}

    </section>

  )

}


