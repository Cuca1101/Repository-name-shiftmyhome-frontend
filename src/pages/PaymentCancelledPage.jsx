import { Link, useSearchParams } from 'react-router-dom'
import SeoHead from '../components/seo/SeoHead'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { isSupabasePublicConfigured, supabasePublic } from '../lib/supabasePublicClient'
import { useEffect } from 'react'

function dbClient() {
  if (isSupabasePublicConfigured && supabasePublic) return supabasePublic
  if (isSupabaseConfigured && supabase) return supabase
  return null
}

export default function PaymentCancelledPage() {
  const [searchParams] = useSearchParams()
  const resumeToken = String(searchParams.get('resume') || '').trim()

  useEffect(() => {
    const quoteRef = String(searchParams.get('quote_ref') || '').trim()
    const db = dbClient()
    if (!db) return
    void db.rpc('mark_customer_lead_payment_failed', {
      p_quote_ref: quoteRef || null,
      p_quote_id: null,
      p_session_id: null,
    })
  }, [searchParams])

  return (
    <>
      <SeoHead
        title="Payment Cancelled | ShiftMyHome"
        description="Your ShiftMyHome payment was cancelled. Return to your quote to try again."
        path="/payment-cancelled"
        robots="noindex, nofollow"
      />
      <div className="min-w-0 bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-lg px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Payment cancelled</h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-[15px]">
            No charge was made. Your quote is still reserved — resume where you left off or retry payment.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            {resumeToken ? (
              <>
                <Link
                  to={`/quote/resume/${resumeToken}`}
                  className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand-600 px-8 py-3 text-sm font-bold text-white shadow-md transition hover:bg-brand-700"
                >
                  Resume Quote
                </Link>
                <Link
                  to={`/quote/pay/${resumeToken}`}
                  className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-slate-200 bg-white px-8 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                >
                  Retry Payment
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/"
                  className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand-600 px-8 py-3 text-sm font-bold text-white shadow-md transition hover:bg-brand-700"
                >
                  Back to home
                </Link>
                <a
                  href="/quote"
                  className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-slate-200 bg-white px-8 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                >
                  Return to quote form
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
