import { useLocation, useSearchParams } from 'react-router-dom'
import { useAuthenticatedCustomerEmail } from '../../lib/useAuthenticatedCustomerEmail'
import { applyWizardPatch } from '../../lib/wizardStateUpdate'
import { quoteMobileInput } from '../../lib/quoteMobileUiClasses'
import { PhoneBookingCustomerStatus } from '../admin/CustomerKindBadge'
import QuotePromoCodeField from './QuotePromoCodeField'

const desktopInput =
  'w-full max-w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 sm:px-4 sm:py-3'
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
 *   flexibleContact?: boolean,
 *   lockSignedInEmail?: boolean,
 *   showCustomerIdentity?: boolean,
 * }} props
 */
export default function JobDetailsContactSection({
  data,
  onChange,
  validationMessage = '',
  pricingSettings = null,
  breakdown = null,
  priceWithoutPromo = null,
  flexibleContact = false,
  lockSignedInEmail = true,
  showCustomerIdentity = false,
  embedded = false,
  lockMobile = false,
}) {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const internalBooking = location.pathname === '/portal/book'
  const fromAccount = internalBooking || searchParams.get('from') === 'account'
  const signedInEmail = useAuthenticatedCustomerEmail()
  const profileEmail = internalBooking ? String(data.email ?? '').trim() : ''
  const accountEmail = lockSignedInEmail ? (signedInEmail || profileEmail) : ''
  const emailValue = accountEmail || String(data.email ?? '')

  function set(k, v) {
    applyWizardPatch(onChange, { [k]: v })
  }

  const contactHint = flexibleContact
    ? 'Name plus phone or email (at least one contact method).'
    : "We'll only use your details for this quote."
  const fieldLabel = 'w-[5.5rem] shrink-0 text-sm font-medium text-slate-600'
  const fieldRow = 'flex items-center gap-2'

  return (
    <>
      <div className={embedded ? 'mt-1 min-w-0 max-w-full' : 'mt-3 min-w-0 max-w-full'}>
        {embedded ? null : (
          <h2 className="text-base font-bold text-slate-900 md:text-lg">Your contact details</h2>
        )}
        <p className={`text-[11px] leading-snug text-slate-500 md:text-sm ${embedded ? '' : 'mt-1'}`}>{contactHint}</p>
        {showCustomerIdentity ? (
          <PhoneBookingCustomerStatus email={String(data.email ?? '')} phone={String(data.phone ?? '')} />
        ) : null}
        {accountEmail ? (
          <p className="mt-1 text-[10px] leading-snug text-slate-600 md:text-sm">
            This booking is added to your signed-in account. The email cannot be changed to another person.
          </p>
        ) : fromAccount ? (
          <p className="mt-1 text-[10px] leading-snug text-slate-600 md:text-sm">
            Sign in to add this booking to an existing account.
          </p>
        ) : null}
      </div>

      <div
        id="quote-wizard-contact-details-mobile"
        data-quote-field="contact-details"
        className={`${embedded ? '' : `${mobileCard} p-2.5 md:p-3`} scroll-mt-24 ${lockMobile ? '' : 'lg:hidden'}`}
      >
        <div className={`${embedded ? 'mt-3' : 'mt-2'} space-y-2`}>
          <label className={fieldRow}>
            <span className={fieldLabel}>Full name</span>
            <input
              id="quote-wizard-fullName-mobile"
              required
              autoComplete="name"
              value={String(data.fullName ?? '')}
              onChange={(e) => set('fullName', e.target.value)}
              className={`${quoteMobileInput} min-w-0 flex-1`}
            />
          </label>
          <label className={fieldRow}>
            <span className={fieldLabel}>
              Phone
            </span>
            <input
              id="quote-wizard-phone-mobile"
              required={!flexibleContact}
              type="tel"
              autoComplete="tel"
              value={String(data.phone ?? '')}
              onChange={(e) => set('phone', e.target.value)}
              className={`${quoteMobileInput} min-w-0 flex-1`}
            />
          </label>
          <label className={fieldRow}>
            <span className={fieldLabel}>
              Email
            </span>
            <input
              id="quote-wizard-email-mobile"
              required={!flexibleContact}
              type="email"
              autoComplete="email"
              readOnly={Boolean(accountEmail)}
              value={emailValue}
              onChange={(e) => {
                if (!accountEmail) set('email', e.target.value)
              }}
              className={`${quoteMobileInput} min-w-0 flex-1`}
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
        className={`${embedded ? '' : 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6'} quote-contact-card scroll-mt-24 ${lockMobile ? 'hidden' : 'hidden lg:block'}`}
      >
        <div className={`${embedded ? 'mt-3' : 'mt-4'} space-y-3`}>
          <label className={fieldRow}>
            <span className={fieldLabel}>Full name</span>
            <input
              id="quote-wizard-fullName-desktop"
              required
              autoComplete="name"
              value={String(data.fullName ?? '')}
              onChange={(e) => set('fullName', e.target.value)}
              className={`${desktopInput} min-w-0 flex-1`}
            />
          </label>
          <label className={fieldRow}>
            <span className={fieldLabel}>
              Phone
            </span>
            <input
              id="quote-wizard-phone-desktop"
              required={!flexibleContact}
              type="tel"
              autoComplete="tel"
              value={String(data.phone ?? '')}
              onChange={(e) => set('phone', e.target.value)}
              className={`${desktopInput} min-w-0 flex-1`}
            />
          </label>
          <label className={fieldRow}>
            <span className={fieldLabel}>
              Email
            </span>
            <input
              id="quote-wizard-email-desktop"
              required={!flexibleContact}
              type="email"
              autoComplete="email"
              readOnly={Boolean(accountEmail)}
              value={emailValue}
              onChange={(e) => {
                if (!accountEmail) set('email', e.target.value)
              }}
              className={`${desktopInput} min-w-0 flex-1`}
            />
          </label>
          <div>
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
