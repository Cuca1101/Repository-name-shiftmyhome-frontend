import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ShieldCheck } from 'lucide-react'
import { isDepositPaymentAllowedForMoveDate } from '../../lib/moveDateLocal'
import QuoteStripePayment from './QuoteStripePayment'

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

/**
 * @param {{ paymentChoice: string|null, stripeReady: boolean, termsReady: boolean }} props
 */
function PaymentStepIndicator({ paymentChoice, stripeReady, termsReady }) {
  const step2Active = Boolean(paymentChoice && (stripeReady || termsReady))
  const step1Active = termsReady || Boolean(paymentChoice)

  return (
    <ol className="mt-3 hidden list-none flex-col gap-1.5 text-xs md:flex md:flex-row md:gap-6">
      <li
        className={
          step1Active
            ? 'font-semibold text-brand-800'
            : 'text-slate-500'
        }
      >
        <span className="font-bold">Step 1</span> — Choose payment option
      </li>
      <li
        className={
          step2Active
            ? 'font-semibold text-brand-800'
            : 'text-slate-500'
        }
      >
        <span className="font-bold">Step 2</span> — Enter card details securely
      </li>
    </ol>
  )
}

/**
 * Shared deposit/full payment UI for Step 4 (mobile + desktop).
 */
export default function QuotePaymentSection({
  wizard,
  breakdown,
  payLoading,
  payError,
  cardPayment,
  onClearCardPayment,
  onPay,
  onPaymentSucceeded,
}) {
  const [paymentChoice, setPaymentChoice] = useState(null)
  const [confirmed, setConfirmed] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const rootRef = useRef(null)
  const stripeSectionRef = useRef(null)
  const panelVisible = usePanelVisible(rootRef)

  const depositAllowed = isDepositPaymentAllowedForMoveDate(wizard?.moveDate)

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

  const termsReady = confirmed && agreedToTerms

  const submitLabel =
    paymentChoice === 'full'
      ? `Pay ${totalFormatted} securely`
      : paymentChoice === 'deposit'
        ? 'Pay £50 securely'
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
    if (type === 'deposit' && !depositAllowed) return
    setPaymentChoice(type)
  }, [cardPayment?.paymentType, depositAllowed])

  function selectChoice(kind) {
    setPaymentChoice(kind)
    const intentReady = cardPayment?.paymentType === kind && cardFormOpen
    if (!intentReady && typeof onPay === 'function') {
      onPay(kind)
    }
  }

  useEffect(() => {
    if (depositAllowed || paymentChoice !== 'deposit') return
    setPaymentChoice(null)
    if (typeof onClearCardPayment === 'function') {
      onClearCardPayment()
    }
  }, [depositAllowed, paymentChoice, onClearCardPayment])

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
    'relative w-full touch-manipulation rounded-xl border p-3 pr-10 text-left transition-[border-color,background-color,box-shadow,ring-color] duration-200 active:scale-[0.99] md:p-4 md:pr-11'

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

  /** @param {boolean} lockedIn selected + terms accepted */
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
  const amountLabel = cardPayment?.amountLabel || ''

  return (
    <div ref={rootRef} className="min-w-0 space-y-3 md:space-y-4">
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

        <div
          className={`mt-3 rounded-lg border px-3 py-2.5 md:mt-4 ${
            termsReady
              ? 'border-sky-200/80 bg-sky-50/60'
              : 'border-slate-200 bg-slate-50/80'
          }`}
        >
          <p className="text-sm font-medium text-slate-800">
            Choose a payment option below to continue securely to card payment.
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            {termsReady
              ? 'After selecting an option, the secure card payment form will appear automatically.'
              : 'Please confirm your details and accept the terms above first.'}
          </p>
        </div>

        {!depositAllowed ? (
          <p className="mt-3 text-xs leading-relaxed text-slate-600 md:mt-4 md:text-sm">
            Deposit payment is only available for moves booked more than 48 hours in advance.
          </p>
        ) : null}

        <div
          className={`mt-3 space-y-2 md:mt-4 ${
            depositAllowed ? 'md:grid md:grid-cols-2 md:gap-4 md:space-y-0' : ''
          }`}
        >
          <button
            type="button"
            onClick={() => selectChoice('full')}
            disabled={!termsReady}
            aria-pressed={paymentChoice === 'full'}
            className={`${optionClass(paymentChoice === 'full', paymentChoice === 'full' && termsReady)} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {paymentChoice === 'full' ? (
              <SelectedCheckBadge lockedIn={termsReady} />
            ) : null}
            <p className={optionTitleClass(paymentChoice === 'full', paymentChoice === 'full' && termsReady)}>
              Pay full estimated total ({totalFormatted})
            </p>
            <p className={optionDescClass(paymentChoice === 'full', paymentChoice === 'full' && termsReady)}>
              Pay the current estimate securely today.
            </p>
          </button>

          {depositAllowed ? (
            <button
              type="button"
              onClick={() => selectChoice('deposit')}
              disabled={!termsReady}
              aria-pressed={paymentChoice === 'deposit'}
              className={`${optionClass(paymentChoice === 'deposit', paymentChoice === 'deposit' && termsReady)} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {paymentChoice === 'deposit' ? (
                <SelectedCheckBadge lockedIn={termsReady} />
              ) : null}
              <p
                className={optionTitleClass(
                  paymentChoice === 'deposit',
                  paymentChoice === 'deposit' && termsReady,
                )}
              >
                Pay £50 now, remaining balance later
              </p>
              <p
                className={optionDescClass(
                  paymentChoice === 'deposit',
                  paymentChoice === 'deposit' && termsReady,
                )}
              >
                The remaining balance will be due within 48 hours before your move. We&apos;ll send you a
                secure payment link before your moving date.
              </p>
            </button>
          ) : null}
        </div>

        {!paymentChoice ? (
          <p
            className="mt-3 rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-center text-sm text-amber-950"
            role="status"
          >
            {termsReady
              ? 'Please select a payment option to continue.'
              : 'Please confirm your details and accept the terms to choose a payment option.'}
          </p>
        ) : null}

        {payError ? <p className="mt-3 text-xs text-red-700 md:text-sm">{payError}</p> : null}

        <div
          ref={stripeSectionRef}
          className={`mt-3 min-w-0 max-md:overflow-visible rounded-xl border bg-slate-50/60 p-2 transition-all duration-300 md:mt-5 md:p-4 ${
            paymentChoice
              ? 'border-brand-200/80 ring-1 ring-brand-500/10'
              : 'border-slate-100'
          }`}
        >
          <p className="mb-2 hidden text-[10px] font-semibold uppercase tracking-wide text-slate-500 md:block">
            Step 2 — Secure card payment
          </p>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 md:hidden">
            Secure card payment
          </p>
          {!paymentChoice ? (
            <p className="text-center text-sm text-slate-500">
              Select a payment option above to load secure payment.
            </p>
          ) : busy && !stripeReady ? (
            <p className="text-center text-sm text-slate-600">Preparing secure payment form…</p>
          ) : stripeReady && cardPayment ? (
            <QuoteStripePayment
              key={`${intentType || paymentChoice}-${clientSecret}`}
              clientSecret={clientSecret}
              customerEmail={email}
              amountLabel={amountLabel}
              onCancel={onClearCardPayment}
              mobileReview
              submitLabel={submitLabel}
              submitDisabled={submitDisabled}
              onPaymentSucceeded={onPaymentSucceeded}
            />
          ) : panelVisible ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-slate-600">
                {payError || 'Could not load secure payment. Please try again.'}
              </p>
              <button
                type="button"
                onClick={() => onPay(paymentChoice)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-brand-200 bg-brand-50 px-4 text-sm font-semibold text-brand-900"
              >
                Load secure payment
              </button>
            </div>
          ) : (
            <p className="text-center text-sm text-slate-500">Preparing secure payment form…</p>
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
