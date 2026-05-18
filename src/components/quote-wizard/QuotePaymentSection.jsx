import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ShieldCheck } from 'lucide-react'
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
}) {
  const [paymentChoice, setPaymentChoice] = useState(null)
  const [confirmed, setConfirmed] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const rootRef = useRef(null)
  const panelVisible = usePanelVisible(rootRef)

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
    if (cardPayment?.paymentType) {
      setPaymentChoice(cardPayment.paymentType)
    }
  }, [cardPayment?.paymentType])

  function selectChoice(kind) {
    setPaymentChoice(kind)
    const intentReady = cardPayment?.paymentType === kind && cardFormOpen
    if (!intentReady && typeof onPay === 'function') {
      onPay(kind)
    }
  }

  const optionClass = (selected) =>
    `relative w-full touch-manipulation rounded-xl border p-3 pr-10 text-left shadow-sm transition active:scale-[0.99] md:p-4 md:pr-11 ${
      selected
        ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-500/20'
        : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300'
    }`

  const email = (wizard?.email || '').trim()
  const amountLabel = cardPayment?.amountLabel || ''

  return (
    <div ref={rootRef} className="min-w-0 space-y-3 md:space-y-4">
      <div className={card}>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Estimated total</p>
        <p className="mt-0.5 text-2xl font-bold tabular-nums text-emerald-700 md:text-3xl">
          {breakdown ? totalFormatted : 'Calculating…'}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-slate-600 md:text-sm">
          Your estimate is based on the details provided. If inventory or access details change, the
          final price may be adjusted before your move.
        </p>
      </div>

      <div className={card}>
        <h3 className="text-sm font-bold text-slate-900 md:text-base">
          Choose how you&apos;d like to pay
        </h3>

        <div className="mt-3 space-y-2 md:mt-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
          <button
            type="button"
            onClick={() => selectChoice('full')}
            aria-pressed={paymentChoice === 'full'}
            className={optionClass(paymentChoice === 'full')}
          >
            {paymentChoice === 'full' ? (
              <Check
                className="absolute right-3 top-3 h-5 w-5 text-brand-600 md:hidden"
                aria-hidden
              />
            ) : null}
            <p className="text-sm font-semibold text-slate-900 md:text-base">
              Pay full estimated total ({totalFormatted})
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 md:text-sm">
              Pay the current estimate securely today.
            </p>
          </button>

          <button
            type="button"
            onClick={() => selectChoice('deposit')}
            aria-pressed={paymentChoice === 'deposit'}
            className={optionClass(paymentChoice === 'deposit')}
          >
            {paymentChoice === 'deposit' ? (
              <Check
                className="absolute right-3 top-3 h-5 w-5 text-brand-600 md:hidden"
                aria-hidden
              />
            ) : null}
            <p className="text-sm font-semibold text-slate-900 md:text-base">
              Pay £50 now, remaining balance later
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 md:text-sm">
              The remaining balance will be due within 48 hours before your move. We&apos;ll send you a
              secure payment link before your moving date.
            </p>
          </button>
        </div>

        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs md:mt-5 md:space-y-3 md:pt-5 md:text-sm">
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

        {payError ? <p className="mt-3 text-xs text-red-700 md:text-sm">{payError}</p> : null}

        <div className="mt-3 min-w-0 max-md:overflow-visible rounded-xl border border-slate-100 bg-slate-50/60 p-2 md:mt-5 md:p-4">
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
