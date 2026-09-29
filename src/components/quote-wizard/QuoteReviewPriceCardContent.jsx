import { weatherEmojiForMoveDate } from '../../lib/moveDateWeather'
import { QuotePromoCalendarPrice } from './QuotePromoPriceReduction'

/**
 * Date / time / price body for QuoteReviewPriceCalendar cards only.
 */
export default function QuoteReviewPriceCardContent({
  weekdayLabel,
  dayNum,
  monthLabel,
  timeLabel,
  selected = false,
  wizard,
  pricingSettings,
  estimatedTotal,
  estimatedTotalWithoutPromo,
  moveDate = null,
  weatherByDate = null,
  priceTone = 'standard',
  slotsLeftLabel = '',
}) {
  const forecast = moveDate ? weatherEmojiForMoveDate(weatherByDate, moveDate) : null
  const forecastTitle = forecast
    ? forecast.tempLabel
      ? `${forecast.label} · ${forecast.tempLabel}`
      : forecast.label
    : undefined

  const weatherEl = (
    <span className="quote-review-price-card__weather">
      {forecast ? (
        <span
          className="quote-review-price-card__weather-icon"
          title={forecastTitle ? `Forecast: ${forecastTitle}` : undefined}
          aria-label={forecast.label}
          role="img"
        >
          {forecast.emoji}
        </span>
      ) : null}
    </span>
  )

  return (
    <div className="quote-review-price-card__body flex w-full flex-col items-center text-center">
      {weatherEl}
      <span className="quote-review-price-card__weekday">{weekdayLabel}</span>
      <span className="quote-review-price-card__day">{dayNum}</span>
      <span className="quote-review-price-card__month">{monthLabel}</span>
      <span className="quote-review-price-card__time">{timeLabel}</span>
      <span className="quote-review-price-card__price mt-auto w-full pt-1.5">
        <QuotePromoCalendarPrice
          promoCode={wizard?.promoCode}
          pricingSettings={pricingSettings}
          priceWithPromo={estimatedTotal}
          priceWithoutPromo={estimatedTotalWithoutPromo}
          selected={selected}
          priceTone={priceTone}
        />
      </span>
      {slotsLeftLabel ? (
        <span className="mt-1 max-w-full truncate text-[11px] font-extrabold leading-tight text-black md:text-xs">
          {slotsLeftLabel}
        </span>
      ) : null}
    </div>
  )
}

