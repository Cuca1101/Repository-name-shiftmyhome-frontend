import { useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import SeoHead from '../components/seo/SeoHead'
import QuoteStripePayment from '../components/quote-wizard/QuoteStripePayment'
import { preloadStripeJs } from '../lib/stripePromise'
import { createPhoneQuotePayment, fetchPhoneQuoteView } from '../lib/phoneQuoteApi'
import { formatDateMediumUK } from '../lib/formatDateDisplay'

function gbp(n) {
  const v = Number(n)
  return Number.isFinite(v) ? `£${v.toFixed(2)}` : '—'
}

function DetailRow({ label, value }) {
  if (!value) return null
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 py-2 text-sm sm:grid-cols-[9rem_1fr]">
      <dt className="text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words font-semibold text-slate-900">{value}</dd>
    </div>
  )
}

function PaidBanner({ quote }) {
  if (quote.payment_status === 'paid') {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900" role="status">
        <p className="text-base font-bold">Paid in full — thank you</p>
        <p className="mt-1 text-sm">
          We received {gbp(quote.amount_paid)}. Your booking {quote.quote_ref} is confirmed.
        </p>
      </div>
    )
  }
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900" role="status">
      <p className="text-base font-bold">Deposit paid — your booking is secured</p>
      <p className="mt-1 text-sm">
        Paid {gbp(quote.amount_paid)} of {gbp(quote.total)}. Remaining balance: <strong>{gbp(quote.balance)}</strong>.
      </p>
    </div>
  )
}

export default function PhoneQuoteViewPage() {
  const { token } = useParams()
  const [searchParams] = useSearchParams()
  const payParam = searchParams.get('pay')
  const requestedPay = payParam === 'deposit' || payParam === 'full' ? payParam : ''
  const [quote, setQuote] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [choice, setChoice] = useState('full')
  const [payment, setPayment] = useState(null)
  const [starting, setStarting] = useState(false)
  const [payError, setPayError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const q = await fetchPhoneQuoteView(String(token || ''))
      setQuote(q)
      if (requestedPay === 'deposit' && q?.options?.deposit_allowed) setChoice('deposit')
      else setChoice('full')
    } catch (e) {
      setError(e?.message || 'Could not load this quote.')
    } finally {
      setLoading(false)
    }
  }, [requestedPay, token])

  useEffect(() => {
    void load()
    preloadStripeJs()
  }, [load])

  async function startPayment() {
    if (!quote || starting) return
    setStarting(true)
    setPayError('')
    setPayment(null)
    try {
      const res = await createPhoneQuotePayment(String(token || ''), choice)
      setPayment(res)
    } catch (e) {
      if (e?.payload?.quote) {
        setQuote(e.payload.quote)
        if (!e.payload.quote.options?.deposit_allowed) setChoice('full')
      }
      setPayError(e?.message || 'Payment could not be started.')
    } finally {
      setStarting(false)
    }
  }

  const opts = quote?.options || {}
  const isPaid = quote && (quote.payment_status === 'paid' || quote.payment_status === 'deposit_paid')

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <SeoHead title="Your quote | ShiftMyHome" description="View your ShiftMyHome moving quote and pay securely." robots="noindex, nofollow" />

      {loading ? <p className="text-sm text-slate-600">Loading your quote…</p> : null}
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">
          {error}
        </div>
      ) : null}

      {quote ? (
        <div className="space-y-5">
          <header>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Your moving quote</p>
            <h1 className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">
              {quote.first_name ? `Hi ${quote.first_name}, here is your quote` : 'Here is your quote'}
            </h1>
            <p className="mt-1 font-mono text-sm text-slate-600">{quote.quote_ref}</p>
          </header>

          {isPaid ? <PaidBanner quote={quote} /> : null}

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-sm font-bold text-slate-900">Move details</h2>
            <dl className="mt-2 divide-y divide-slate-100">
              <DetailRow label="Move date" value={quote.move_date ? formatDateMediumUK(quote.move_date) : ''} />
              <DetailRow label="Arrival" value={quote.arrival} />
              <DetailRow label="Collection" value={quote.pickup_address} />
              <DetailRow label="Delivery" value={quote.delivery_address} />
              <DetailRow label="Service" value={quote.service_type} />
              <DetailRow
                label="Crew"
                value={quote.crew_size ? `${quote.crew_size} ${Number(quote.crew_size) === 1 ? 'mover' : 'movers'}` : ''}
              />
            </dl>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-sm font-bold text-slate-900">Inventory</h2>
            {quote.inventory?.length ? (
              <ul className="mt-2 divide-y divide-slate-100">
                {quote.inventory.map((it, i) => (
                  <li key={`${it.name}-${i}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 break-words text-slate-800">{it.name}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-900">×{it.quantity}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No items listed.</p>
            )}
          </section>

          <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Total price</p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums text-emerald-700">{gbp(quote.total)}</p>
          </section>

          {quote.closed && !isPaid ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              This booking is no longer open for online payment. Please contact ShiftMyHome.
            </div>
          ) : null}

          {opts.can_pay ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Payment">
              <h2 className="text-sm font-bold text-slate-900">
                {requestedPay === 'deposit' ? 'Pay the £50 deposit' : requestedPay === 'full' ? 'Pay in full' : 'How would you like to pay?'}
              </h2>
              {!opts.deposit_allowed && opts.full_only_reason === 'under_48h' ? (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Your move is less than {opts.min_hours_for_deposit} hours away, so full payment is needed to confirm the booking.
                </p>
              ) : null}
              <div className="mt-3 space-y-2">
                {requestedPay === 'deposit' ? null : (
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${
                    choice === 'full' ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-500/20' : 'border-slate-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="phone_quote_pay"
                    className="mt-1"
                    checked={choice === 'full'}
                    onChange={() => {
                      setChoice('full')
                      setPayment(null)
                    }}
                  />
                  <span>
                    <span className="block text-sm font-bold text-slate-900">Pay in full — {gbp(quote.total)}</span>
                    <span className="block text-xs text-slate-600">Nothing more to pay before your move.</span>
                  </span>
                </label>
                )}
                {opts.deposit_allowed && requestedPay !== 'full' ? (
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${
                      choice === 'deposit' ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-500/20' : 'border-slate-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="phone_quote_pay"
                      className="mt-1"
                      checked={choice === 'deposit'}
                      onChange={() => {
                        setChoice('deposit')
                        setPayment(null)
                      }}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-slate-900">
                        {gbp(opts.deposit)} deposit to secure the booking
                      </span>
                      <span className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-xs text-slate-700">
                        <span>Total</span>
                        <span className="text-right font-semibold tabular-nums">{gbp(quote.total)}</span>
                        <span>Pay now</span>
                        <span className="text-right font-semibold tabular-nums">{gbp(opts.deposit)}</span>
                        <span>Remaining balance</span>
                        <span className="text-right font-semibold tabular-nums">{gbp(opts.balance_after_deposit)}</span>
                      </span>
                    </span>
                  </label>
                ) : null}
              </div>

              {payError ? (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
                  {payError}
                </p>
              ) : null}

              {payment?.client_secret ? (
                <div className="mt-4">
                  <p className="text-sm text-slate-700">
                    Paying <strong>{gbp(payment.amount_gbp)}</strong>
                    {payment.payment_type === 'deposit'
                      ? ` now · remaining balance ${gbp(payment.balance_after_gbp)}`
                      : ' — full payment'}
                  </p>
                  <QuoteStripePayment
                    key={payment.payment_intent_id}
                    clientSecret={payment.client_secret}
                    customerEmail={quote.email || undefined}
                    amountLabel={gbp(payment.amount_gbp)}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void startPayment()}
                  disabled={starting}
                  className="mt-4 inline-flex min-h-[52px] w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-base font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
                >
                  {starting
                    ? 'Preparing secure payment…'
                    : choice === 'deposit'
                      ? `Continue — pay ${gbp(opts.deposit)} deposit`
                      : `Continue — pay ${gbp(quote.total)}`}
                </button>
              )}
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
