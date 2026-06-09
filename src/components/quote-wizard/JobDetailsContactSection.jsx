import { applyWizardPatch } from '../../lib/wizardStateUpdate'
import { quoteMobileInput, quoteMobileLabel } from '../../lib/quoteMobileUiClasses'
import QuotePromoCodeField from './QuotePromoCodeField'

const desktopInput =
  'w-full max-w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 sm:px-4 sm:py-3'
const desktopLabel = 'mb-1.5 block text-sm font-medium text-slate-700'
const mobileCard =
  'box-border min-w-0 w-full rounded-lg border border-slate-200 bg-white shadow-sm md:rounded-xl'

/**
 * Step 2 — Job details & contact (name, phone, email only).
 * @param {{
 *   data: Record<string, unknown>,
 *   onChange: (next: Record<string, unknown>) => void,
 *   validationMessage?: string,
 *   pricingSettings?: import('../../lib/pricingCalculator.js').PricingSettings | null,
 *   breakdown?: import('../../lib/pricingCalculator.js').QuoteBreakdown | null,
 *   priceWithoutPromo?: number | null,
 * }} props
 */
export default function JobDetailsContactSection({
  data,
  onChange,
  validationMessage = '',
  pricingSettings = null,
  breakdown = null,
  priceWithoutPromo = null,
}) {
  function set(k, v) {
    applyWizardPatch(onChange, { [k]: v })
  }

  return (
    <>
      <div className="mt-3 min-w-0 max-w-full border-t border-slate-200 pt-3 md:mt-10 md:pt-10">
        <h2 className="text-base font-bold text-slate-900 md:text-lg">
          Job details &amp; contact
        </h2>
        <p className="mt-1 text-[10px] leading-snug text-slate-600 md:text-sm">
          We&apos;ll only use your details for this quote.
        </p>
      </div>

      <div
        id="quote-wizard-contact-details-mobile"
        data-quote-field="contact-details"
        className={`${mobileCard} scroll-mt-24 p-2.5 md:hidden md:p-3`}
      >
        <h3 className="text-xs font-bold text-slate-900">Your details</h3>
        <div className="mt-2 space-y-2">
          <label className="block">
            <span className={quoteMobileLabel}>Full name</span>
            <input
              id="quote-wizard-fullName-mobile"
              required
              autoComplete="name"
              value={String(data.fullName ?? '')}
              onChange={(e) => set('fullName', e.target.value)}
              className={quoteMobileInput}
            />
          </label>
          <label className="block">
            <span className={quoteMobileLabel}>Phone</span>
            <input
              id="quote-wizard-phone-mobile"
              required
              type="tel"
              autoComplete="tel"
              value={String(data.phone ?? '')}
              onChange={(e) => set('phone', e.target.value)}
              className={quoteMobileInput}
            />
          </label>
          <label className="block">
            <span className={quoteMobileLabel}>Email</span>
            <input
              id="quote-wizard-email-mobile"
              required
              type="email"
              autoComplete="email"
              value={String(data.email ?? '')}
              onChange={(e) => set('email', e.target.value)}
              className={quoteMobileInput}
            />
          </label>
          <QuotePromoCodeField
            data={data}
            onChange={onChange}
            pricingSettings={pricingSettings}
            breakdown={breakdown}
            priceWithoutPromo={priceWithoutPromo}
            variant="mobile"
            embedded
          />
        </div>
      </div>

      <div
        id="quote-wizard-contact-details-desktop"
        data-quote-field="contact-details"
        className="scroll-mt-24 hidden rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/40 to-white p-5 sm:p-6 md:block"
      >
        <h3 className="text-sm font-bold text-slate-900">Your details</h3>
        <div className="mt-4 grid grid-cols-2 gap-3 xxs:gap-4">
          <label className="block sm:col-span-2">
            <span className={desktopLabel}>Full name</span>
            <input
              id="quote-wizard-fullName-desktop"
              required
              autoComplete="name"
              value={String(data.fullName ?? '')}
              onChange={(e) => set('fullName', e.target.value)}
              className={desktopInput}
            />
          </label>
          <label className="block">
            <span className={desktopLabel}>Phone</span>
            <input
              id="quote-wizard-phone-desktop"
              required
              type="tel"
              autoComplete="tel"
              value={String(data.phone ?? '')}
              onChange={(e) => set('phone', e.target.value)}
              className={desktopInput}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className={desktopLabel}>Email</span>
            <input
              id="quote-wizard-email-desktop"
              required
              type="email"
              autoComplete="email"
              value={String(data.email ?? '')}
              onChange={(e) => set('email', e.target.value)}
              className={desktopInput}
            />
          </label>
          <div className="sm:col-span-2">
            <QuotePromoCodeField
              data={data}
              onChange={onChange}
              pricingSettings={pricingSettings}
              breakdown={breakdown}
              priceWithoutPromo={priceWithoutPromo}
              variant="desktop"
              embedded
            />
          </div>
        </div>
      </div>

      {validationMessage ? (
        <p
          className="quote-error rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800 md:rounded-xl md:px-4 md:py-3 md:text-sm"
          role="alert"
          data-quote-error="true"
        >
          {validationMessage}
        </p>
      ) : null}
    </>
  )
}
