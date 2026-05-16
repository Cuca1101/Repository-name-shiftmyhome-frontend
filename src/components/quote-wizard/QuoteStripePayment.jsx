import { useState } from 'react'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useNavigate } from 'react-router-dom'
import { stripePromise } from '../../lib/stripePromise'
import { verifyPaymentIntent } from '../../lib/stripeCheckout'

function PaymentForm({ customerEmail, amountLabel, onCancel }) {
  const stripe = useStripe()
  const elements = useElements()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!stripe || !elements) return
    setBusy(true)
    setMsg('')

    const { error: submitErr } = await elements.submit()
    if (submitErr) {
      setMsg(submitErr.message ?? 'Check your card details.')
      setBusy(false)
      return
    }

    const origin = window.location.origin
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${origin}/payment-success`,
        receipt_email: customerEmail || undefined,
      },
      redirect: 'if_required',
    })

    if (error) {
      setMsg(error.message ?? 'Payment could not be completed.')
      setBusy(false)
      return
    }

    if (paymentIntent?.status === 'succeeded') {
      try {
        await verifyPaymentIntent(paymentIntent.id)
      } catch {
        /* Success page may call verify again */
      }
      navigate(`/payment-success?payment_intent=${encodeURIComponent(paymentIntent.id)}`)
      return
    }

    setBusy(false)
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <PaymentElement
        options={{
          layout: 'tabs',
          terms: { card: 'never' },
        }}
      />
      {msg ? <p className="text-sm text-red-700">{msg}</p> : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={!stripe || busy}
          className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? 'Processing…' : `Pay ${amountLabel}`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Secure card payment. Your card details are processed securely — we never store them on our servers.
      </p>
    </form>
  )
}

/**
 * Embedded card payment form for the quote wizard (ShiftMyHome).
 *
 * @param {{ clientSecret: string, customerEmail: string, amountLabel: string, onCancel: () => void }} props
 */
export default function QuoteStripePayment({ clientSecret, customerEmail, amountLabel, onCancel }) {
  if (!clientSecret || !stripePromise) {
    return (
      <p className="mt-2 text-sm text-red-700">
        Card payments could not load. Check your publishable payment key in <code className="rounded bg-red-50 px-1">.env</code>{' '}
        (starts with <code className="rounded bg-red-50 px-1">pk_</code>) and restart the dev server.
      </p>
    )
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: 'flat',
          variables: {
            colorPrimary: '#059669',
            borderRadius: '12px',
          },
        },
      }}
    >
      <PaymentForm customerEmail={customerEmail} amountLabel={amountLabel} onCancel={onCancel} />
    </Elements>
  )
}
