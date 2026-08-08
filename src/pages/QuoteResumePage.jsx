import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import SeoHead from '../components/seo/SeoHead'
import { isSupabasePublicConfigured, supabasePublic } from '../lib/supabasePublicClient'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import {
  applyCustomerLeadResumeDraft,
  draftPayloadFromCustomerLead,
} from '../lib/quoteRecoveryResume'

function dbClient() {
  if (isSupabasePublicConfigured && supabasePublic) return supabasePublic
  if (isSupabaseConfigured && supabase) return supabase
  return null
}

export default function QuoteResumePage() {
  const { token } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [status, setStatus] = useState('Restoring your quote…')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const t = String(token || '').trim()
      if (!t) {
        setError('Invalid resume link.')
        return
      }
      const db = dbClient()
      if (!db) {
        setError('Unable to connect. Please try again later.')
        return
      }

      try {
        if (searchParams.get('e') === 'resume' || searchParams.get('src') === 'email') {
          await db.rpc('public_track_recovery_event', {
            p_token: t,
            p_event: 'resume_click',
          })
        }

        const { data, error: rpcErr } = await db.rpc('public_get_resume_quote', { p_token: t })
        if (cancelled) return
        if (rpcErr) throw rpcErr
        if (!data || data.ok === false) {
          setError(
            data?.error === 'already_converted'
              ? 'This quote was already booked. Contact us if you need help.'
              : 'This resume link is invalid or has expired.',
          )
          return
        }

        const draft = draftPayloadFromCustomerLead({
          quote_ref: data.quote_ref,
          service_type: data.service_type,
          wizard_step: data.wizard_step,
          wizard_data: data.wizard_data,
          estimated_total: data.estimated_total,
          source_page_url: data.source_page_url,
        })
        const path = applyCustomerLeadResumeDraft(draft, {
          welcomeBack: true,
          leadSessionId: data.session_id || null,
        })
        setStatus('Welcome back — opening your quote…')
        navigate(path, { replace: true })
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Could not restore your quote.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, navigate, searchParams])

  return (
    <>
      <SeoHead
        title="Resume Quote | ShiftMyHome"
        description="Continue your ShiftMyHome quote where you left off."
        path={`/quote/resume/${token || ''}`}
        robots="noindex, nofollow"
      />
      <div className="min-w-0 bg-white py-16">
        <div className="mx-auto max-w-lg px-4 text-center">
          {error ? (
            <>
              <h1 className="text-2xl font-bold text-slate-900">Unable to resume</h1>
              <p className="mt-3 text-sm text-slate-600">{error}</p>
              <Link
                to="/quote"
                className="mt-8 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand-600 px-8 text-sm font-bold text-white"
              >
                Start a new quote
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
              <p className="mt-3 text-sm text-slate-600">{status}</p>
            </>
          )}
        </div>
      </div>
    </>
  )
}
