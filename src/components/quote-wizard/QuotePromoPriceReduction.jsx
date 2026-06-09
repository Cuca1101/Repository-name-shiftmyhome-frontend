import { useMemo } from 'react'
import { formatPromoGbp, resolvePromoPriceReduction } from '../../lib/promoPriceReduction'

/**
 * @param {{
 *   promoCode?: string | null,
 *   pricingSettings?: import('../../lib/pricingCalculator.js').PricingSettings | null,
 *   priceWithPromo?: number | null,
 *   priceWithoutPromo?: number | null,
 *   className?: string,
 *   size?: 'sm' | 'md' | 'lg',
 *   showPromoCode?: boolean,
 *   messageStyle?: 'priceRange' | 'accepted' | 'savingsAmount',
 *   align?: 'start' | 'end',
 * }} props
 */
export default function QuotePromoPriceReduction({
  promoCode,
  pricingSettings,
  priceWithPromo,
  priceWithoutPromo,
  className = '',
  size = 'md',
  showPromoCode = false,
  messageStyle = 'priceRange',
  align = 'start',
}) {
  const reduction = useMemo(
    () =>
      resolvePromoPriceReduction({
        promoCode,
        pricingSettings,
        priceWithPromo,
        priceWithoutPromo,
      }),
    [promoCode, pricingSettings, priceWithPromo, priceWithoutPromo],
  )

  if (!reduction) return null

  const corner = align === 'end' && messageStyle === 'priceRange'
  const sizeCls = corner
    ? 'px-2.5 py-2 text-[11px] font-semibold leading-snug shadow-sm md:px-3 md:py-2.5 md:text-sm'
    : size === 'sm'
      ? 'px-2 py-1.5 text-[10px] leading-snug md:text-[11px]'
      : size === 'lg'
        ? 'px-3 py-2.5 text-sm leading-snug md:text-base'
        : 'px-2.5 py-2 text-xs leading-snug md:px-3 md:py-2.5 md:text-sm'

  if (messageStyle === 'accepted') {
    return (
      <p
        className={`rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900 ${sizeCls} ${className}`.trim()}
        role="status"
      >
        <span className="font-semibold text-emerald-900">Promo code accepted</span>
        <span className="text-emerald-800">
          {' '}
          — You save{' '}
          <strong className="tabular-nums text-emerald-800">{reduction.discountPercent}%</strong>
        </span>
      </p>
    )
  }

  if (messageStyle === 'savingsAmount') {
    return (
      <p
        className={`text-xs font-medium text-emerald-800 md:text-sm ${className}`.trim()}
        role="status"
      >
        You save{' '}
        <strong className="tabular-nums text-emerald-700">
          {formatPromoGbp(reduction.savingsAmount)}
        </strong>
      </p>
    )
  }

  return (
    <p
      className={`rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-900 ${sizeCls} ${
        corner ? 'max-w-[11.5rem] text-right sm:max-w-[13rem]' : ''
      } ${className}`.trim()}
      role="status"
    >
      {showPromoCode ? (
        <span
          className={`block uppercase tracking-wide text-emerald-900 ${
            corner
              ? 'text-[10px] font-bold md:text-xs'
              : 'text-[10px] font-semibold text-emerald-800/90'
          }`}
        >
          Promo {reduction.promoLabel} applied
        </span>
      ) : null}
      <span className={corner ? 'block font-bold' : undefined}>
        Price reduced from{' '}
        <span
          className={`tabular-nums text-red-600 line-through ${
            corner ? 'font-bold' : 'font-semibold'
          }`}
        >
          {formatPromoGbp(reduction.priceBefore)}
        </span>{' '}
        to{' '}
        <strong
          className={`tabular-nums text-emerald-800 ${
            corner ? 'text-base font-extrabold md:text-lg' : 'font-bold'
          }`}
        >
          {formatPromoGbp(reduction.priceWithPromo)}
        </strong>
      </span>
    </p>
  )
}

/**
 * Compact price label for calendar cards — strikethrough before, discounted after.
 */
export function QuotePromoCalendarPrice({
  promoCode,
  pricingSettings,
  priceWithPromo,
  priceWithoutPromo,
  selected = false,
  className = '',
  size = 'sm',
}) {
  const reduction = useMemo(
    () =>
      resolvePromoPriceReduction({
        promoCode,
        pricingSettings,
        priceWithPromo,
        priceWithoutPromo,
      }),
    [promoCode, pricingSettings, priceWithPromo, priceWithoutPromo],
  )

  const discountedCls = 'quote-review-price-card__price-final tabular-nums'
  const struckCls = 'quote-review-price-card__price-struck tabular-nums'

  if (!reduction) {
    const label =
      priceWithPromo != null && Number.isFinite(priceWithPromo)
        ? formatPromoGbp(priceWithPromo)
        : '—'
    return (
      <span className={`${discountedCls} ${className}`.trim()}>
        {label}
      </span>
    )
  }

  return (
    <span className={`flex w-full flex-col items-center ${className}`.trim()}>
      <span className={struckCls}>{formatPromoGbp(reduction.priceBefore)}</span>
      <span className={discountedCls}>{formatPromoGbp(reduction.priceWithPromo)}</span>
    </span>
  )
}
