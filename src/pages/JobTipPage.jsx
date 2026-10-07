import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import SeoHead from '../components/seo/SeoHead'
import { detailFromFunctionsInvokeError } from '../lib/functionsInvokeError'
import { trackingClient } from '../lib/jobCustomerTracking'

const SUGGESTED = [5, 10, 20, 30]
const FRIENDLY_PAY_ERROR = "We couldn't start the secure payment. Please try again."

export default function JobTipPage() {
  const { token } = useParams()
  const [searchParams] = useSearchParams()
  /** @type {['preset' | 'other', function]} */
  const [mode, setMode] = useState('preset')
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

  function selectedGbp() {
    if (mode === 'other') {
      const n = Number(String(custom).trim())
      return Number.isFinite(n) ? n : NaN
    }
    return Number(amount)
  }

  async function pay() {
    setBusy(true)
    setErr('')
    const gbp = selectedGbp()
    if (!Number.isFinite(gbp) || gbp < 1) {
      setErr('Enter a tip of at least £1.')
      setBusy(false)
      return
    }
    try {
      const client = trackingClient()
      if (!client) throw new Error('Unavailable')
      const { data, error } = await client.functions.invoke('create-job-tip-checkout', {
        body: { token, amount_gbp: gbp },
      })
      if (error) {
        const detail = await detailFromFunctionsInvokeError(error, FRIENDLY_PAY_ERROR)
        console.error('[JobTipPage] create-job-tip-checkout failed', {
          message: error?.message,
          detail,
          data,
          amount_gbp: gbp,
        })
        throw new Error(FRIENDLY_PAY_ERROR)
      }
      if (data?.error) {
        console.error('[JobTipPage] create-job-tip-checkout body error', data)
        throw new Error(FRIENDLY_PAY_ERROR)
      }
      if (!data?.url) {
        console.error('[JobTipPage] create-job-tip-checkout missing url', data)
        throw new Error(FRIENDLY_PAY_ERROR)
      }
      console.info('[JobTipPage] redirecting to Stripe Checkout', {
        amount_gbp: data.amount_gbp ?? gbp,
        amount_pence: data.amount_pence ?? Math.round(gbp * 100),
        session_id: data.session_id,
      })
      window.location.href = data.url
    } catch (ex) {
      const msg = String(ex?.message || '')
      setErr(/non-2xx|Edge Function|Failed to send/i.test(msg) ? FRIENDLY_PAY_ERROR : msg || FRIENDLY_PAY_ERROR)
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
          Tips are completely optional — there is absolutely no obligation. Tips are separate from
          your booking payment and do not change your invoice or outstanding balance.
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
                    setMode('preset')
                    setAmount(n)
                    setCustom('')
                  }}
                  className={`min-h-[44px] rounded-xl border px-4 text-sm font-semibold ${
                    mode === 'preset' && amount === n
                      ? 'border-brand-600 bg-brand-50 text-brand-800'
                      : 'border-slate-200 bg-white text-slate-800'
                  }`}
                >
                  £{n}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setMode('other')
                  setAmount(0)
                }}
                className={`min-h-[44px] rounded-xl border px-4 text-sm font-semibold ${
                  mode === 'other'
                    ? 'border-brand-600 bg-brand-50 text-brand-800'
                    : 'border-slate-200 bg-white text-slate-800'
                }`}
              >
                Other amount
              </button>
            </div>
            {mode === 'other' ? (
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Other amount (£)</span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"
                  value={custom}
                  onChange={(e) => {
                    setMode('other')
                    setCustom(e.target.value)
                  }}
                  placeholder="Enter amount"
                  autoFocus
                />
              </label>
            ) : null}
            {Number.isFinite(selectedGbp()) && selectedGbp() >= 1 ? (
              <p className="text-sm font-semibold text-slate-900">
                Selected tip: £{Number(selectedGbp()).toFixed(2)}
              </p>
            ) : null}
            {err ? <p className="text-sm text-red-700">{err}</p> : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => void pay()}
              className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? 'Opening Stripe…' : 'Pay tip securely'}
            </button>
            <p className="text-center text-xs text-slate-500">Optional · Secured by Stripe · Separate from your booking</p>
          </div>
        )}
      </div>
    </>
  )
}
