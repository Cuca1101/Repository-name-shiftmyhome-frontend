import { Check } from 'lucide-react'

/** Blue checkmark — top-right on selected date cards only. */
export default function QuoteReviewPriceCardCheckBadge() {
  return (
    <span
      className="quote-review-price-card__check absolute z-[2] inline-flex items-center justify-center rounded-full bg-brand-600 text-white"
      aria-hidden
    >
      <Check strokeWidth={2.5} />
    </span>
  )
}
