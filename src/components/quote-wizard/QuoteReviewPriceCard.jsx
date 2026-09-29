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
  priceTone = 'standard',
  slotsLeftLabel = '',
}) {
  const parts = formatReviewCalendarParts(option.moveDate)
  const full = slotsLeftLabel === 'Full'

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      aria-disabled={full}
      disabled={full}
      onClick={() => !full && onSelect(option)}
      className={`quote-review-price-card quote-review-price-card--compact${selected ? ' is-selected' : ''}${
        priceTone === 'best' ? ' is-best-price' : priceTone === 'weekend' ? ' is-weekend-price' : ' is-standard-price'
      }`}
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
        priceTone={priceTone}
        slotsLeftLabel={slotsLeftLabel}
      />
      {selected ? <QuoteReviewPriceCardCheckBadge /> : null}
      {selected ? <span className="quote-review-price-card__selected">Selected</span> : null}
    </button>
  )
}

