import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, Copy } from 'lucide-react'
import { verifyPaymentIntent, scheduleAdminAvailableJobNotification } from '../lib/stripeCheckout'
import { clearQuoteDraft } from '../lib/quoteDraftStorage'
import { consumePhotoUploadNotice } from '../lib/quotePhotoUpload'
import { trackWebsiteLeadEvent } from '../lib/websiteLeadTracker'
import { trackMarketingPurchase } from '../lib/marketingPixels'
import SeoHead from '../components/seo/SeoHead'

function scrollToEl(el, block = 'center') {
  if (!el || typeof el.scrollIntoView !== 'function') return
  el.scrollIntoView({ behavior: 'smooth', block, inline: 'nearest' })
}

export default function PaymentSuccessPage() {
  const [params] = useSearchParams()
  const paymentIntentId = params.get('payment_intent')
  const [quoteRef, setQuoteRef] = useState(null)
  const [photoUploadNotice, setPhotoUploadNotice] = useState(() => consumePhotoUploadNotice())
  const [copied, setCopied] = useState(false)
  const successContentRef = useRef(null)
  const bookingRefSectionRef = useRef(null)
  const hasScrolledToBookingRef = useRef(false)

  useEffect(() => {
    if (!paymentIntentId) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await verifyPaymentIntent(paymentIntentId)
        scheduleAdminAvailableJobNotification({
          paymentIntentId,
          quoteId: data?.quote_id != null ? String(data.quote_id) : undefined,
        })
        if (!cancelled && data?.quote_ref && typeof data.quote_ref === 'string') {
          const ref = data.quote_ref.trim()
          setQuoteRef(ref)
          clearQuoteDraft()
          trackWebsiteLeadEvent('payment_completed', {
            quoteRef: ref,
            recoveredBooking: true,
          })
          trackMarketingPurchase({ transactionId: paymentIntentId, quoteRef: ref })
        }
      } catch {
        /* Keep friendly UI; reference may still arrive by email */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [paymentIntentId])

  useEffect(() => {
    const el = successContentRef.current
    if (!el) return undefined
    const id = window.setTimeout(() => scrollToEl(el, 'start'), 80)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    if (!quoteRef || hasScrolledToBookingRef.current) return undefined
    const el = bookingRefSectionRef.current ?? successContentRef.current
    if (!el) return undefined
    const id = window.setTimeout(() => {
      scrollToEl(el, 'center')
      hasScrolledToBookingRef.current = true
    }, 120)
    return () => window.clearTimeout(id)
  }, [quoteRef])

  const copyReference = useCallback(async () => {
    const text = (quoteRef || '').trim()
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy booking reference:', text)
    }
  }, [quoteRef])

  return (
    <>
      <SeoHead
        title="Payment Successful | ShiftMyHome"
        description="Your ShiftMyHome payment was successful. Your booking reference is shown on this page."
        path="/payment-success"
        robots="noindex, nofollow"
      />
      <div className="min-w-0 bg-white py-5 sm:py-12 md:py-16">
      <div
        ref={successContentRef}
        className="mx-auto max-w-lg scroll-mt-20 px-4 text-center sm:scroll-mt-24 sm:px-6 lg:px-8"
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 ring-2 ring-emerald-100 sm:mb-6 sm:h-14 sm:w-14">
          <svg
            className="h-7 w-7 text-emerald-600 sm:h-8 sm:w-8"
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

        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-3xl">Payment successful</h1>

        {photoUploadNotice ? (
          <div
            role="status"
            className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-left text-sm leading-relaxed text-amber-950 sm:mt-6 sm:px-4"
          >
            {photoUploadNotice}
          </div>
        ) : null}

        <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600 sm:mt-6 sm:space-y-4 sm:text-[15px]">
          {paymentIntentId ? (
            <>
              <p>Thank you — your payment has been received.</p>

              {quoteRef ? (
                <div
                  ref={bookingRefSectionRef}
                  className="scroll-mt-24 rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-3 sm:px-4 sm:py-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                    Your booking reference
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                    <span className="font-mono text-base font-bold tabular-nums text-slate-900 sm:text-lg">
                      {quoteRef}
                    </span>
                    <button
                      type="button"
                      onClick={copyReference}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-50"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5" aria-hidden />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" aria-hidden />
                          Copy reference
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500">Loading your booking reference…</p>
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

        <div className="mt-8 sm:mt-10">
          <Link
            to="/"
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand-600 px-8 py-3 text-sm font-bold text-white shadow-md transition hover:bg-brand-700"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
    </>
  )
}
