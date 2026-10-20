import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import SeoHead from '../components/seo/SeoHead'
import QuoteStripePayment from '../components/quote-wizard/QuoteStripePayment'
import { fetchCustomerOffer, respondToCounteroffer } from '../lib/customerOfferApi'
import { createPaymentIntent } from '../lib/stripeCheckout'
import { formatDateUK } from '../lib/formatDateDisplay'

function gbp(amount) {
  const n = Number(amount)
  if (!Number.isFinite(n)) return '—'
  return `£${n.toFixed(2)}`
}

function statusCopy(offer) {
  if (!offer) return ''
  if (offer.booked) return 'This offer has been paid and the booking is confirmed.'
  if (offer.expired || offer.status === 'expired') return 'This offer has expired. The agreed price can no longer be used.'
  if (offer.status === 'declined') return 'We could not accept this offer. Your original quote is unchanged.'
  if (offer.status === 'counter_declined') return 'You declined the counteroffer. No payment has been taken.'
  if (offer.status === 'pending') return 'We are reviewing your offer. You do not need to pay anything yet, and no slot is reserved.'
  if (offer.status === 'countered') return 'We sent a counteroffer for this move. Accepting it does not reserve a slot until you pay.'
  if (offer.payable) return 'The agreed total is ready for checkout. Payment confirms the booking if the date is still available.'
  return 'Here is the latest reply to your offer.'
}

export default function CustomerOfferPage() {
  const { token = '' } = useParams()
  const [offer, setOffer] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [paymentType, setPaymentType] = useState('full')
  const [card, setCard] = useState(null)
  const [payError, setPayError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const next = await fetchCustomerOffer(token)
      setOffer(next)
      if (!next?.deposit_allowed) setPaymentType('full')
    } catch (err) {
      setError(err?.message || 'This offer link is not valid.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [token])

  const agreed = Number(offer?.agreed_amount)
  const dueNow = paymentType === 'deposit' && offer?.deposit_allowed ? Number(offer.deposit_gbp) : agreed
  const summary = offer?.summary && typeof offer.summary === 'object' ? offer.summary : {}

  async function reply(accept) {
    setBusy(true)
    setPayError('')
    try {
      const next = await respondToCounteroffer(token, accept)
      setOffer(next)
      setCard(null)
    } catch (err) {
      setPayError(err?.message || 'Could not save your reply.')
    } finally {
      setBusy(false)
    }
  }

  async function startPayment() {
    if (!offer?.payable || !offer.quote_ref) {
      setPayError('This offer is not ready for payment.')
      return
    }
    setBusy(true)
    setPayError('')
    setCard(null)
    try {
      const result = await createPaymentIntent({
        offer_token: token,
        quote_ref: offer.quote_ref,
        customer_email: offer.customer_email,
        customer_name: offer.customer_name,
        service_type: summary.packageName || 'Removals',
        payment_type: paymentType === 'deposit' && offer.deposit_allowed ? 'deposit' : 'full',
        amount_gbp: dueNow,
        amount: dueNow,
        base_quote_gbp: summary.movePrice ?? agreed,
        declared_volume_m3: summary.volumeM3 ?? 0,
        service_package: 'standard',
        quote_lead: {
          quote_ref: offer.quote_ref,
          email: offer.customer_email,
          full_name: offer.customer_name,
          status: 'New',
        },
      })
      setCard(result)
    } catch (err) {
      setPayError(err?.message || 'Payment could not start. The date may no longer be available.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg px-3 py-4 sm:px-4">
      <SeoHead title="Your offer | ShiftMyHome" description="View the reply to your ShiftMyHome removal offer." path={`/offer/${token}`} robots="noindex, nofollow" />
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Your offer</h1>
      <p className="mt-1 text-sm text-slate-600">You do not need an account to view this reply.</p>

      {loading ? <p className="mt-6 text-sm text-slate-600">Loading your offer…</p> : null}
      {error ? <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800" role="alert">{error}</p> : null}

      {offer ? (
        <div className="mt-4 space-y-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm leading-snug text-slate-700">{statusCopy(offer)}</p>
            {offer.quote_ref ? <p className="mt-2 font-mono text-xs font-semibold text-slate-500">REF: {offer.quote_ref}</p> : null}
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Original quote</dt><dd className="font-semibold tabular-nums">{gbp(offer.original_total)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Your offer</dt><dd className="font-semibold tabular-nums">{gbp(offer.proposed_amount)}</dd></div>
              {offer.counter_amount != null ? (
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Counteroffer</dt><dd className="font-semibold tabular-nums">{gbp(offer.counter_amount)}</dd></div>
              ) : null}
              {offer.payable ? (
                <div className="flex justify-between gap-3 border-t border-slate-100 pt-2"><dt className="font-semibold text-slate-800">Agreed total</dt><dd className="text-xl font-bold tabular-nums text-slate-900">{gbp(agreed)}</dd></div>
              ) : null}
            </dl>
            {summary.route ? <p className="mt-3 text-sm text-slate-700">{summary.route}</p> : null}
            {summary.moveDate ? <p className="text-sm text-slate-700">{formatDateUK(summary.moveDate)} · {summary.packageName || 'Selected service'}</p> : null}
            {offer.date_flexibility ? <p className="mt-2 text-sm text-slate-600">Date flexibility: {offer.date_flexibility}</p> : null}
            {offer.message ? <p className="mt-2 text-sm text-slate-600">Your message: {offer.message}</p> : null}
            {offer.expires_at && !offer.booked && !offer.expired ? (
              <p className="mt-2 text-xs text-slate-500">Reply and payment are available until {formatDateUK(String(offer.expires_at).slice(0, 10))}.</p>
            ) : null}
          </section>

          {offer.status === 'countered' ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" disabled={busy} onClick={() => reply(true)} className="min-h-[48px] rounded-xl bg-blue-600 font-bold text-white disabled:opacity-60">Accept counteroffer</button>
              <button type="button" disabled={busy} onClick={() => reply(false)} className="min-h-[48px] rounded-xl border border-slate-300 bg-white font-bold text-slate-800 disabled:opacity-60">Decline</button>
            </div>
          ) : null}

          {offer.payable ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-base font-bold text-slate-900">Checkout</h2>
              <p className="mt-1 text-sm text-slate-600">The amount charged is the agreed total saved by ShiftMyHome. It is checked again before payment, including date availability.</p>
              {offer.deposit_allowed ? (
                <div className="mt-3 grid gap-2">
                  <button type="button" onClick={() => { setPaymentType('full'); setCard(null) }} className={`rounded-xl border px-3 py-3 text-left ${paymentType === 'full' ? 'border-blue-600 bg-blue-50' : 'border-slate-200'}`}>
                    <span className="block text-sm font-bold">Pay the agreed total</span>
                    <span className="text-sm tabular-nums">{gbp(agreed)} due now</span>
                  </button>
                  <button type="button" onClick={() => { setPaymentType('deposit'); setCard(null) }} className={`rounded-xl border px-3 py-3 text-left ${paymentType === 'deposit' ? 'border-blue-600 bg-blue-50' : 'border-slate-200'}`}>
                    <span className="block text-sm font-bold">Pay the deposit</span>
                    <span className="text-sm tabular-nums">{gbp(offer.deposit_gbp)} due now · remaining {gbp(agreed - Number(offer.deposit_gbp))}</span>
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-sm font-semibold text-slate-800">Amount due now {gbp(agreed)}</p>
              )}
              {payError ? <p className="mt-3 text-sm font-medium text-red-700" role="alert">{payError}</p> : null}
              {!card ? (
                <button type="button" disabled={busy} onClick={startPayment} className="mt-4 flex min-h-[52px] w-full items-center justify-center rounded-xl bg-blue-600 font-bold text-white disabled:opacity-60">
                  {busy ? 'Checking availability…' : 'Continue to payment'}
                </button>
              ) : (
                <div className="mt-4">
                  <QuoteStripePayment
                    clientSecret={card.clientSecret}
                    customerEmail={offer.customer_email}
                    amountLabel={paymentType === 'deposit' && offer.deposit_allowed ? `${gbp(offer.deposit_gbp)} deposit, agreed total ${gbp(agreed)}` : `${gbp(agreed)} agreed total`}
                    submitLabel="Pay now"
                  />
                </div>
              )}
            </section>
          ) : null}

          {Array.isArray(offer.history) && offer.history.length ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-bold text-slate-900">History</h2>
              <ol className="mt-2 space-y-2 text-sm text-slate-700">
                {offer.history.map((item, index) => (
                  <li key={`${item.at}-${index}`}>
                    <span className="font-semibold">{item.actor_label || 'Update'}</span>
                    {item.amount != null ? ` · ${gbp(item.amount)}` : ''}
                    {item.message ? ` — ${item.message}` : ''}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
