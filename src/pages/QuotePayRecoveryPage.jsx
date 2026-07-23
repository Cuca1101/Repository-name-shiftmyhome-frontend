import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import SeoHead from '../components/seo/SeoHead'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { isSupabasePublicConfigured, supabasePublic } from '../lib/supabasePublicClient'

function functionsClient() {
  if (isSupabaseConfigured && supabase) return supabase
  if (isSupabasePublicConfigured && supabasePublic) return supabasePublic
  return null
}

export default function QuotePayRecoveryPage() {
  const { token } = useParams()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const t = String(token || '').trim()
      if (!t) {
        setError('Invalid payment link.')
        return
      }

      const client = functionsClient()
      if (!client) {
        setError('Payment is temporarily unavailable.')
        return
      }

      if (searchParams.get('e') === 'pay' || searchParams.get('src') === 'email') {
        try {
          await client.rpc('public_track_recovery_event', {
            p_token: t,
            p_event: 'payment_click',
          })
        } catch {
          /* ignore */
        }
      }

      try {
        const { data, error: fnErr } = await client.functions.invoke('create-recovery-checkout', {
          body: { token: t },
        })
        if (cancelled) return
        if (fnErr) throw fnErr
        const url = data?.url
        if (!url) throw new Error(data?.error || 'Could not create payment session.')
        window.location.href = url
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Payment could not be started. Try resuming your quote instead.')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, searchParams])

  return (
    <>
      <SeoHead
        title="Pay Quote | ShiftMyHome"
        description="Complete payment for your ShiftMyHome quote."
        path={`/quote/pay/${token || ''}`}
        robots="noindex, nofollow"
      />
      <div className="min-w-0 bg-white py-16">
        <div className="mx-auto max-w-lg px-4 text-center">
          {error ? (
            <>
              <h1 className="text-2xl font-bold text-slate-900">Payment unavailable</h1>
              <p className="mt-3 text-sm text-slate-600">{error}</p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Link
                  to={`/quote/resume/${token || ''}`}
                  className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand-600 px-8 text-sm font-bold text-white"
                >
                  Resume Quote
                </Link>
                <Link to="/quote" className="text-sm font-semibold text-brand-700 hover:underline">
                  New quote
                </Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-slate-900">Redirecting to secure payment…</h1>
              <p className="mt-3 text-sm text-slate-600">Please wait — Stripe Checkout is opening.</p>
            </>
          )}
        </div>
      </div>
    </>
  )
}
