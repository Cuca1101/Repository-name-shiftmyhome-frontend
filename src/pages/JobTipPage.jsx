import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import SeoHead from '../components/seo/SeoHead'
import { trackingClient } from '../lib/jobCustomerTracking'

const SUGGESTED = [5, 10, 15, 20]

export default function JobTipPage() {
  const { token } = useParams()
  const [searchParams] = useSearchParams()
  const [amount, setAmount] = useState(10)
  const [custom, setCustom] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [paidMsg, setPaidMsg] = useState('')

  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    if (searchParams.get('paid') !== '1' || !sessionId) return
    let cancelled = false
    ;(async () => {
      try {
        const client = trackingClient()
        if (!client) return
        const { data } = await client.functions.invoke('confirm-job-tip', {
          body: { session_id: sessionId },
        })
        if (!cancelled && data?.ok) {
          setPaidMsg(`Thank you — your tip of £${Number(data.amount_gbp).toFixed(2)} was received.`)
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [searchParams])

  async function pay() {
    setBusy(true)
    setErr('')
    const gbp = custom.trim() ? Number(custom) : amount
    try {
      const client = trackingClient()
      if (!client) throw new Error('Unavailable')
      const { data, error } = await client.functions.invoke('create-job-tip-checkout', {
        body: { token, amount_gbp: gbp },
      })
      if (error) throw error
      if (!data?.url) throw new Error(data?.error || 'Could not start tip payment')
      window.location.href = data.url
    } catch (ex) {
      setErr(ex?.message || 'Payment could not be started.')
      setBusy(false)
    }
  }

  return (
    <>
      <SeoHead title="Leave a Tip | ShiftMyHome" path={`/track/${token}/tip`} robots="noindex, nofollow" />
      <div className="mx-auto max-w-lg px-4 py-10 sm:py-14">
        <Link to={`/track/${token}`} className="text-sm font-semibold text-brand-700 hover:underline">
          ← Back to booking
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Leave a tip</h1>
        <p className="mt-2 text-sm text-slate-600">
          Tips are optional and separate from your booking payment. 100% goes to your driver where applicable.
        </p>

        {paidMsg ? (
          <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {paidMsg}
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap gap-2">
              {SUGGESTED.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setAmount(n)
                    setCustom('')
                  }}
                  className={`min-h-[44px] rounded-xl border px-4 text-sm font-semibold ${
                    !custom && amount === n
                      ? 'border-brand-600 bg-brand-50 text-brand-800'
                      : 'border-slate-200 bg-white text-slate-800'
                  }`}
                >
                  £{n}
                </button>
              ))}
            </div>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Custom amount (£)</span>
              <input
                type="number"
                min="1"
                step="0.01"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="e.g. 12.50"
              />
            </label>
            {err ? <p className="text-sm text-red-700">{err}</p> : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => void pay()}
              className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? 'Opening Stripe…' : 'Pay tip securely'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
