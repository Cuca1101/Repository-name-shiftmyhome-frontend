import { Component, useState } from 'react'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useNavigate } from 'react-router-dom'
import { stripePromise } from '../../lib/stripePromise'
import { verifyPaymentIntent } from '../../lib/stripeCheckout'
import { clearQuoteDraft } from '../../lib/quoteDraftStorage'

function paymentElementOptions(customerEmail) {
  const options = {
    layout: {
      type: 'tabs',
      radios: 'auto',
      spacedAccordionItems: false,
    },
    paymentMethodOrder: ['card', 'klarna', 'revolut_pay', 'amazon_pay'],
  }
  if (customerEmail) {
    options.defaultValues = {
      billingDetails: {
        email: customerEmail,
      },
    }
  }
  return options
}

function buildConfirmParams(customerEmail) {
  const params = {
    return_url: `${window.location.origin}/payment-success`,
  }
  if (customerEmail) {
    params.receipt_email = customerEmail
  }
  return params
}

function PaymentForm({
  customerEmail,
  amountLabel,
  mobileReview = false,
  submitLabel,
  submitDisabled = false,
  onPaymentSucceeded,
}) {
  const stripe = useStripe()
  const elements = useElements()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const payDisabled = !stripe || !elements || busy || submitDisabled

  async function handleSubmit(e) {
    e.preventDefault()
    if (!stripe || !elements || payDisabled) return
    setBusy(true)
    setMsg('')

    const { error: submitErr } = await elements.submit()
    if (submitErr) {
      setMsg(submitErr.message ?? 'Check your payment details.')
      setBusy(false)
      return
    }

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: buildConfirmParams(customerEmail),
        redirect: 'if_required',
      })

      if (error) {
        setMsg(error.message ?? 'Payment could not be completed.')
        setBusy(false)
        return
      }

      if (paymentIntent?.status === 'succeeded') {
        let verifyData = null
        try {
          verifyData = await verifyPaymentIntent(paymentIntent.id)
        } catch {
          /* Success page may call verify again */
        }
        if (typeof onPaymentSucceeded === 'function') {
          try {
            await onPaymentSucceeded({
              paymentIntentId: paymentIntent.id,
              quoteRef:
                verifyData?.quote_ref != null
                  ? String(verifyData.quote_ref)
                  : verifyData?.quoteRef != null
                    ? String(verifyData.quoteRef)
                    : undefined,
              jobId:
                verifyData?.job_id != null
                  ? String(verifyData.job_id)
                  : verifyData?.jobId != null
                    ? String(verifyData.jobId)
                    : null,
            })
          } catch (uploadErr) {
            const detail = uploadErr?.message ? String(uploadErr.message) : 'Photo upload failed.'
            console.warn('[Quote] post-payment photo upload callback failed', uploadErr)
            setMsg(
              `Payment received. ${detail} Your booking reference is in your confirmation email.`,
            )
          }
        }
        clearQuoteDraft()
        navigate(`/payment-success?payment_intent=${encodeURIComponent(paymentIntent.id)}`)
        return
      }
    } catch (err) {
      setMsg(err?.message ?? 'Payment could not be completed.')
    }

    setBusy(false)
  }

  const formClass = mobileReview ? 'mt-0 min-w-0 space-y-2' : 'mt-4 space-y-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4'
  const stripeWrapClass = mobileReview
    ? 'min-w-0 overflow-hidden rounded-lg border border-slate-200/80 bg-white p-2 [&_.Tab]:!py-1.5 [&_.Tab]:!text-xs'
    : 'min-w-0 max-w-full overflow-hidden'
  const buttonClass = mobileReview
    ? 'inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-gradient-to-r from-brand-600 to-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:from-brand-700 hover:to-emerald-700 disabled:opacity-50'
    : 'inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-brand-700 disabled:opacity-50'

  return (
    <form onSubmit={handleSubmit} className={formClass}>
      <div className={stripeWrapClass}>
        <PaymentElement options={paymentElementOptions(customerEmail)} />
      </div>

      {msg ? <p className={`${mobileReview ? 'text-xs' : 'text-sm'} text-red-700`}>{msg}</p> : null}

      <button type="submit" disabled={payDisabled} className={buttonClass}>
        {busy ? 'Processing…' : submitLabel || `Pay ${amountLabel}`}
      </button>
    </form>
  )
}

class StripeFormErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <p className="text-sm text-red-700">
          Secure payment form could not load. Please refresh and try again.
          {import.meta.env.DEV ? ` (${this.state.error.message})` : null}
        </p>
      )
    }
    return this.props.children
  }
}

function elementsAppearance(mobileReview) {
  const appearance = {
    theme: 'flat',
    variables: {
      colorPrimary: '#059669',
      borderRadius: '12px',
      fontSizeBase: mobileReview ? '13px' : '14px',
      spacingUnit: mobileReview ? '2px' : '3px',
    },
  }
  if (mobileReview) {
    appearance.rules = {
      '.Label': {
        fontSize: '12px',
        fontWeight: '500',
      },
      '.Tab': {
        padding: '8px 10px',
      },
    }
  }
  return appearance
}

export default function QuoteStripePayment({
  clientSecret,
  customerEmail,
  amountLabel,
  onCancel: _onCancel,
  mobileReview = false,
  submitLabel,
  submitDisabled = false,
  onPaymentSucceeded,
}) {
  if (!clientSecret || typeof clientSecret !== 'string' || !stripePromise) {
    return (
      <p className="mt-2 text-sm text-red-700">
        Card payments could not load. Check your publishable payment key in{' '}
        <code className="rounded bg-red-50 px-1">.env</code> (starts with{' '}
        <code className="rounded bg-red-50 px-1">pk_</code>) and restart the dev server.
      </p>
    )
  }

  return (
    <StripeFormErrorBoundary>
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret,
          appearance: elementsAppearance(mobileReview),
        }}
      >
        <PaymentForm
          customerEmail={customerEmail}
          amountLabel={amountLabel}
          mobileReview={mobileReview}
          submitLabel={submitLabel}
          submitDisabled={submitDisabled}
          onPaymentSucceeded={onPaymentSucceeded}
        />
      </Elements>
    </StripeFormErrorBoundary>
  )
}
