import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ShieldCheck } from 'lucide-react'
import { isMoveDateOnOrAfterToday, moveDatePastErrorMessage } from '../../lib/moveDateLocal'
import { formatReservationFeeGbp } from '../../lib/quoteReservationFee'
import { trackWebsiteLeadEvent } from '../../lib/websiteLeadTracker'
import QuoteStripePayment from './QuoteStripePayment'
import { shouldShowStripeTestModeWarning, stripeTestModeWarningMessage } from '../../lib/stripeConfig'

/** Step 4 mounts twice (mobile + desktop columns); detect visibility without document-wide MutationObserver. */
function usePanelVisible(rootRef) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return undefined

    const update = () => {
      setVisible(el.getClientRects().length > 0)
    }

    update()

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry) setVisible(entry.isIntersecting && entry.intersectionRatio > 0)
      },
      { root: null, threshold: 0 },
    )
    io.observe(el)

    window.addEventListener('resize', update)
    return () => {
      io.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [rootRef])

  return visible
}

function PaymentStepIndicator({ paymentChoice, stripeReady, termsReady }) {
  const step2Active = Boolean(paymentChoice && (stripeReady || termsReady))
  const step1Active = termsReady || Boolean(paymentChoice)

  return (
    <ol className="mt-3 hidden list-none flex-col gap-1.5 text-xs md:flex md:flex-row md:gap-6">
      <li className={step1Active ? 'font-semibold text-brand-800' : 'text-slate-500'}>
        <span className="font-bold">Step 1</span> — Choose payment option
      </li>
      <li className={step2Active ? 'font-semibold text-brand-800' : 'text-slate-500'}>
        <span className="font-bold">Step 2</span> — Enter card details securely
      </li>
    </ol>
  )
}

/**
 * Step 4 — £1 reservation fee or full payment (Stripe required for all bookings).
 */
export default function QuotePaymentSection({
  wizard,
  breakdown,
  reservationFeeGbp = 50,
  payLoading,
  payError,
  cardPayment,
  onClearCardPayment,
  onPay,
  onPaymentSucceeded,
}) {
  const [paymentChoice, setPaymentChoice] = useState('full')
  const [confirmed, setConfirmed] = useState(true)
  const [agreedToTerms, setAgreedToTerms] = useState(true)
  const rootRef = useRef(null)
  const stripeSectionRef = useRef(null)
  const autoFullPayRequestedRef = useRef(false)
  const panelVisible = usePanelVisible(rootRef)

  const moveDatePayReady = isMoveDateOnOrAfterToday(wizard?.moveDate)
  const reservationGbp =
    Number.isFinite(Number(reservationFeeGbp)) && Number(reservationFeeGbp) > 0
      ? Number(reservationFeeGbp)
      : 50
  const reservationFormatted = formatReservationFeeGbp(reservationGbp)

  const card =
    'min-w-0 max-md:overflow-visible overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm md:border-slate-200 md:p-6 md:shadow-card'
  const busy = payLoading
  const clientSecret =
    typeof cardPayment?.clientSecret === 'string' ? cardPayment.clientSecret : ''
  const cardFormOpen = clientSecret.length > 0
  const estimatedTotal = breakdown?.estimatedTotal
  const totalFormatted =
    estimatedTotal != null && Number.isFinite(estimatedTotal)
      ? `£${estimatedTotal.toFixed(2)}`
      : '—'
  const remainingBalanceGbp =
    estimatedTotal != null &&
    Number.isFinite(estimatedTotal) &&
    estimatedTotal > reservationGbp
      ? estimatedTotal - reservationGbp
      : null
  const remainingBalanceFormatted =
    remainingBalanceGbp != null ? `£${remainingBalanceGbp.toFixed(2)}` : null

  const termsReady = confirmed && agreedToTerms

  const submitLabel =
    paymentChoice === 'reservation'
      ? `Pay ${reservationFormatted} securely`
      : paymentChoice === 'full'
        ? `Pay ${totalFormatted} securely`
        : 'Pay securely'

  const submitDisabled = !(paymentChoice && confirmed && agreedToTerms)

  const intentType = cardPayment?.paymentType
  const stripeReady =
    panelVisible &&
    cardFormOpen &&
    paymentChoice &&
    (!intentType || intentType === paymentChoice)

  useEffect(() => {
    const type = cardPayment?.paymentType
    if (!type) return
    if (type === 'reservation' || type === 'full') {
      setPaymentChoice(type)
    }
  }, [cardPayment?.paymentType])

  useEffect(() => {
    if (paymentChoice !== 'full') {
      autoFullPayRequestedRef.current = false
    }
  }, [paymentChoice])

  /** Step 4 — default to full pay and load Stripe so card fields are visible immediately. */
  useEffect(() => {
    if (!panelVisible || !termsReady || !moveDatePayReady) return
    if (paymentChoice !== 'full') return
    if (estimatedTotal == null || !Number.isFinite(estimatedTotal)) return
    const intentReady = cardPayment?.paymentType === 'full' && cardFormOpen
    if (intentReady || busy) return
    if (autoFullPayRequestedRef.current) return
    autoFullPayRequestedRef.current = true
    if (typeof onPay === 'function') {
      onPay('full')
    }
  }, [
    panelVisible,
    termsReady,
    moveDatePayReady,
    paymentChoice,
    estimatedTotal,
    cardPayment?.paymentType,
    cardFormOpen,
    busy,
    onPay,
  ])

  function selectChoice(kind) {
    setPaymentChoice(kind)
    void trackWebsiteLeadEvent('payment_option_selected', {
      paymentType: kind,
      returnPath: typeof window !== 'undefined' ? window.location.pathname : '/',
    })
    const intentReady = cardPayment?.paymentType === kind && cardFormOpen
    if (!intentReady && typeof onPay === 'function') {
      onPay(kind)
    }
  }

  useEffect(() => {
    if (!panelVisible || !paymentChoice) return
    const el = stripeSectionRef.current
    if (!el) return
    const timer = window.setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, stripeReady ? 120 : 280)
    return () => window.clearTimeout(timer)
  }, [panelVisible, paymentChoice, stripeReady])

  const optionShell =
    'relative w-full min-h-[52px] touch-manipulation rounded-xl border p-3 pr-10 text-left transition-[border-color,background-color,box-shadow,ring-color] duration-200 active:scale-[0.99] max-md:min-h-[3.5rem] md:min-h-0 md:p-4 md:pr-11'

  const optionClass = (selected, lockedIn) => {
    if (!selected) {
      return `${optionShell} border-slate-200 bg-white shadow-sm hover:border-slate-300`
    }
    if (lockedIn) {
      return `${optionShell} border-emerald-600 bg-gradient-to-br from-emerald-200/80 via-emerald-100/90 to-emerald-100/75 ring-2 ring-emerald-500/55 shadow-[inset_0_2px_6px_rgba(4,120,87,0.12),0_0_0_1px_rgba(16,185,129,0.38),0_8px_28px_rgba(5,150,105,0.32)] md:shadow-[inset_0_2px_8px_rgba(4,120,87,0.14),0_0_0_1px_rgba(16,185,129,0.36),0_10px_32px_rgba(5,150,105,0.28)]`
    }
    return `${optionShell} border-emerald-500 bg-gradient-to-br from-emerald-200/70 via-emerald-100/85 to-emerald-50/80 ring-2 ring-emerald-400/45 shadow-[inset_0_1px_3px_rgba(4,120,87,0.08),0_0_0_1px_rgba(16,185,129,0.28),0_6px_22px_rgba(5,150,105,0.24)]`
  }

  const optionTitleClass = (selected, lockedIn) =>
    `text-sm font-semibold md:text-base ${
      selected ? (lockedIn ? 'text-slate-900' : 'text-emerald-950') : 'text-slate-900'
    }`

  const optionDescClass = (selected, lockedIn) =>
    `mt-1 text-xs leading-relaxed md:text-sm ${
      selected ? (lockedIn ? 'text-emerald-950/85' : 'text-emerald-900/85') : 'text-slate-600'
    }`

  function SelectedCheckBadge({ lockedIn }) {
    return (
      <span
        className={`absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full shadow-sm ${
          lockedIn
            ? 'bg-emerald-700 ring-2 ring-emerald-500/35'
            : 'bg-emerald-600/90 ring-1 ring-emerald-500/25'
        }`}
        aria-hidden
      >
        <Check className="h-4 w-4 text-white" strokeWidth={2.5} />
      </span>
    )
  }

  const email = (wizard?.email || '').trim()

  return (
    <div ref={rootRef} data-quote-field="payment" className="min-w-0 max-w-full space-y-3 md:space-y-4">
      <div className={card}>
        <h3 className="text-sm font-bold text-slate-900 md:text-base">
          Choose how you&apos;d like to pay
        </h3>

        <PaymentStepIndicator
          paymentChoice={paymentChoice}
          stripeReady={stripeReady}
          termsReady={termsReady}
        />

        <p className="mt-2 text-[11px] leading-relaxed text-slate-500 md:hidden">
          <span className="font-semibold text-slate-700">Step 1:</span> Choose payment ·{' '}
          <span className="font-semibold text-slate-700">Step 2:</span> Enter card details
        </p>

        <div className="mt-3 space-y-2 border-b border-slate-100 pb-3 text-xs md:mt-4 md:space-y-3 md:pb-4 md:text-sm">
          <label className="flex cursor-pointer items-start gap-2.5 leading-relaxed text-slate-700">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span>
              I confirm my details are correct and understand the price may change if information is
              missing or incorrect.
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2.5 leading-relaxed text-slate-700">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span>
              I agree to the{' '}
              <Link to="/terms" className="font-semibold text-brand-700 underline-offset-2 hover:underline">
                Terms &amp; Conditions
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="font-semibold text-brand-700 underline-offset-2 hover:underline">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
        </div>

        {estimatedTotal != null && Number.isFinite(estimatedTotal) ? (
          <dl className="mt-3 space-y-1.5 rounded-lg border border-emerald-100/90 bg-emerald-50/50 px-3 py-2.5 text-sm md:mt-4">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="font-medium text-slate-800">Estimated total</dt>
              <dd className="font-bold tabular-nums text-emerald-700">{totalFormatted}</dd>
            </div>
          </dl>
        ) : null}

        <div className="mt-3 grid grid-cols-1 gap-2 md:mt-4 md:grid-cols-2 md:gap-4">
          <button
            type="button"
            onClick={() => selectChoice('full')}
            disabled={!termsReady || !moveDatePayReady}
            aria-pressed={paymentChoice === 'full'}
            className={`${optionClass(paymentChoice === 'full', paymentChoice === 'full' && termsReady)} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {paymentChoice === 'full' ? (
              <SelectedCheckBadge lockedIn={termsReady} />
            ) : null}
            <p
              className={optionTitleClass(
                paymentChoice === 'full',
                paymentChoice === 'full' && termsReady,
              )}
            >
              Pay full amount now
            </p>
            <p
              className={optionDescClass(
                paymentChoice === 'full',
                paymentChoice === 'full' && termsReady,
              )}
            >
              Pay the full quoted amount ({totalFormatted}) today. No further payment required.
            </p>
          </button>

          <button
            type="button"
            onClick={() => selectChoice('reservation')}
            disabled={!termsReady || !moveDatePayReady}
            aria-pressed={paymentChoice === 'reservation'}
            className={`${optionClass(paymentChoice === 'reservation', paymentChoice === 'reservation' && termsReady)} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {paymentChoice === 'reservation' ? (
              <SelectedCheckBadge lockedIn={termsReady} />
            ) : null}
            <p
              className={optionTitleClass(
                paymentChoice === 'reservation',
                paymentChoice === 'reservation' && termsReady,
              )}
            >
              Reserve your move for {reservationFormatted} today
            </p>
            <p
              className={optionDescClass(
                paymentChoice === 'reservation',
                paymentChoice === 'reservation' && termsReady,
              )}
            >
              Secure your booking with a {reservationFormatted} reservation fee. Remaining balance
              payable before your move.
            </p>
            {paymentChoice === 'reservation' && remainingBalanceFormatted ? (
              <p className="mt-2 text-[11px] font-semibold tabular-nums text-slate-700">
                Pay today: {reservationFormatted} · Remaining: {remainingBalanceFormatted}
              </p>
            ) : null}
          </button>
        </div>

        {!termsReady ? (
          <p
            className="mt-3 rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-center text-sm text-amber-950"
            role="status"
          >
            Please confirm your details and accept the terms to continue to secure card payment.
          </p>
        ) : null}

        {shouldShowStripeTestModeWarning() ? (
          <p
            className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 md:text-sm"
            role="status"
          >
            {stripeTestModeWarningMessage()}
          </p>
        ) : null}

        {!moveDatePayReady ? (
          <p
            className="quote-error mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 md:mt-4 md:text-sm"
            role="alert"
            data-quote-error="true"
          >
            {moveDatePastErrorMessage(wizard?.moveDate)}
          </p>
        ) : null}

        {payError && moveDatePayReady ? (
          <p
            className="quote-error mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 md:text-sm"
            role="alert"
            data-quote-error="true"
          >
            {payError}
          </p>
        ) : null}

        <div
          ref={stripeSectionRef}
          className="mt-3 min-w-0 max-md:overflow-visible rounded-xl border border-brand-200/80 bg-slate-50/60 p-2 ring-1 ring-brand-500/10 transition-all duration-300 md:mt-5 md:p-4"
        >
          <p className="mb-1 hidden text-[10px] font-semibold uppercase tracking-wide text-brand-700 md:block">
            Step 2 — Enter your card details
          </p>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-brand-700 md:hidden">
            Enter your card details
          </p>
          <p className="mb-3 text-xs leading-snug text-slate-600 md:text-sm">
            {paymentChoice === 'reservation'
              ? `Pay ${reservationFormatted} now with your card. Remaining balance is due before your move.`
              : `Pay ${totalFormatted} now with your card below.`}
          </p>
          {busy && !stripeReady ? (
            <div className="flex flex-col items-center gap-2 py-4" role="status" aria-live="polite">
              <span
                className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600"
                aria-hidden
              />
              <p className="text-center text-sm text-slate-600">Preparing secure card form…</p>
            </div>
          ) : stripeReady && cardPayment ? (
            <QuoteStripePayment
              key={`${intentType || paymentChoice}-${clientSecret}`}
              clientSecret={clientSecret}
              customerEmail={email}
              amountLabel={cardPayment.amountLabel}
              onCancel={onClearCardPayment}
              mobileReview
              submitLabel={submitLabel}
              submitDisabled={submitDisabled}
              onPaymentSucceeded={onPaymentSucceeded}
            />
          ) : panelVisible ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-slate-600">
                {payError
                  ? 'Update your move date on step 1, then try again.'
                  : 'Could not load secure payment. Please try again.'}
              </p>
              {!payError ? (
                <button
                  type="button"
                  onClick={() => onPay(paymentChoice)}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-brand-200 bg-brand-50 px-4 text-sm font-semibold text-brand-900"
                >
                  Load secure payment
                </button>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-4" role="status">
              <span
                className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-500"
                aria-hidden
              />
              <p className="text-center text-sm text-slate-500">Preparing secure card form…</p>
            </div>
          )}
        </div>

        <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-slate-500 md:text-xs">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
          <span>
            Secure encrypted payment powered by Stripe. Your card details are never stored on our
            servers.
          </span>
        </p>
      </div>
    </div>
  )
}
