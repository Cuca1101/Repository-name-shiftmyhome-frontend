import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { verifyPaymentIntent } from '../lib/stripeCheckout'

export default function PaymentSuccessPage() {
  const [params] = useSearchParams()
  const paymentIntentId = params.get('payment_intent')
  const [quoteRef, setQuoteRef] = useState(null)

  useEffect(() => {
    if (!paymentIntentId) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await verifyPaymentIntent(paymentIntentId)
        if (!cancelled && data?.quote_ref && typeof data.quote_ref === 'string') {
          setQuoteRef(data.quote_ref.trim())
        }
      } catch {
        /* Keep friendly UI; reference may still arrive by email */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [paymentIntentId])

  return (
    <div className="min-w-0 bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-lg px-4 text-center sm:px-6 lg:px-8">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 ring-2 ring-emerald-100">
          <svg
            className="h-8 w-8 text-emerald-600"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Payment successful</h1>

        <div className="mt-6 space-y-4 text-sm leading-relaxed text-slate-600 sm:text-[15px]">
          {paymentIntentId ? (
            <>
              <p>Thank you — your payment has been received.</p>

              {quoteRef && (
                <p className="text-slate-700">
                  <span className="font-semibold text-slate-800">Your booking reference:</span>{' '}
                  <span className="font-semibold text-slate-900">{quoteRef}</span>
                </p>
              )}

              <p>We will confirm your move details shortly.</p>

              <p>A confirmation email has been sent to your email address.</p>

              <p>If you have any questions, contact us with your reference number.</p>
            </>
          ) : (
            <>
              <p>Thank you for choosing ShiftMyHome.</p>
              <p>We will confirm your move details shortly.</p>
              <p>If you have any questions, contact us — please include your booking reference if you have one.</p>
            </>
          )}
        </div>

        <div className="mt-10">
          <Link
            to="/"
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand-600 px-8 py-3 text-sm font-bold text-white shadow-md transition hover:bg-brand-700"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
