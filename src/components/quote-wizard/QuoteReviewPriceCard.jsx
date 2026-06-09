import {
  formatReviewCalendarParts,
  formatReviewShortTimeLabel,
} from '../../lib/quoteReviewPriceOptions'
import QuoteReviewPriceCardCheckBadge from './QuoteReviewPriceCardCheckBadge'
import QuoteReviewPriceCardContent from './QuoteReviewPriceCardContent'

/** Single date/price option card for Step 3 review calendar. */
export default function QuoteReviewPriceCard({
  option,
  selected,
  wizard,
  weatherByDate,
  pricingSettings,
  onSelect,
}) {
  const parts = formatReviewCalendarParts(option.moveDate)

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={() => onSelect(option)}
      className={`quote-review-price-card quote-review-price-card--compact${selected ? ' is-selected' : ''}`}
    >
      <QuoteReviewPriceCardContent
        weekdayLabel={parts.weekdayShort}
        dayNum={parts.dayNum}
        monthLabel={parts.monthShort}
        timeLabel={formatReviewShortTimeLabel(wizard, { compact: true })}
        moveDate={option.moveDate}
        weatherByDate={weatherByDate}
        selected={selected}
        wizard={wizard}
        pricingSettings={pricingSettings}
        estimatedTotal={option.estimatedTotal}
        estimatedTotalWithoutPromo={option.estimatedTotalWithoutPromo}
      />
      {selected ? <QuoteReviewPriceCardCheckBadge /> : null}
      {selected ? <span className="quote-review-price-card__selected">Selected</span> : null}
    </button>
  )
}
