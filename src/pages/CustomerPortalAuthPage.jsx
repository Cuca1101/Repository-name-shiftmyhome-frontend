import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import PortalShell from '../components/customer-portal/PortalShell'
import { sessionKindFromUser } from '../lib/accountRole'
import { requestPortalLink } from '../lib/customerPortalApi'
import { customerPortalClient } from '../lib/customerPortalClient'
import { classifyMagicLinkError, safePortalNext } from '../lib/customerPortalModel'

export default function CustomerPortalAuthPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [phase, setPhase] = useState('checking')
  const [email, setEmail] = useState('')
  const [notice, setNotice] = useState('')
  const [sending, setSending] = useState(false)
  const next = safePortalNext(params.get('next'))

  useEffect(() => {
    const tokenHash = params.get('token_hash') || ''
    const type = params.get('type') || 'magiclink'
    if (!customerPortalClient || !tokenHash || type === 'recovery') {
      setPhase('expired')
      return undefined
    }
    let cancelled = false
    customerPortalClient.auth
      .verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
      .then(async ({ data, error }) => {
        if (cancelled) return
        if (error) {
          const kind = classifyMagicLinkError(error.message)
          setPhase(kind === 'error' ? 'expired' : kind)
          return
        }
        const signedKind = sessionKindFromUser(data.user)
        const server = await customerPortalClient.rpc('account_session_kind')
        const kind = !server.error && typeof server.data === 'string' ? server.data : signedKind
        if (kind === 'admin' || kind === 'driver') {
          await customerPortalClient.auth.signOut()
          if (!cancelled) setPhase(kind)
          return
        }
        navigate(next, { replace: true })
      })
      .catch(() => {
        if (!cancelled) setPhase('expired')
      })
    return () => {
      cancelled = true
    }
  }, [navigate, next, params])

  async function resend(event) {
    event.preventDefault()
    setSending(true)
    setNotice('')
    try {
      const quoteId = next.startsWith('/portal/bookings/') ? next.split('/')[3] : ''
      const result = await requestPortalLink(email, quoteId && quoteId !== 'bookings' ? quoteId : '')
      setNotice(result?.message || 'If this email has a booking, we have sent a new link.')
    } catch (err) {
      setNotice(err?.message || 'Could not send a new link.')
    } finally {
      setSending(false)
    }
  }

  return (
    <PortalShell
      requireSession={false}
      title="Sign in | ShiftMyHome"
      description="Open your ShiftMyHome booking from a secure email link."
      path="/portal/auth"
    >
      {phase === 'checking' ? <p className="text-sm text-slate-600">Opening your booking…</p> : null}
      {phase === 'admin' || phase === 'driver' ? (
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">This link is for a {phase} account</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {phase === 'driver'
              ? 'Driver sign-in stays in the driver app. This page did not change that session.'
              : 'Admin sign-in stays in Admin. Open a customer from Admin → Customers. This page did not change the admin session.'}
          </p>
        </div>
      ) : null}
      {phase !== 'checking' && phase !== 'admin' && phase !== 'driver' ? (
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">This link has expired</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Sign-in links only work for a short time. Enter your booking email and we will send a new one.
          </p>
          <form onSubmit={resend} className="mt-5 space-y-3">
            <label className="block text-sm font-medium" htmlFor="portal-resend-email">Email</label>
            <input
              id="portal-resend-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base outline-none focus:border-brand-500"
            />
            <button type="submit" disabled={sending} className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
              {sending ? 'Sending…' : 'Send a new link'}
            </button>
          </form>
          {notice ? <p className="mt-4 text-sm text-slate-700">{notice}</p> : null}
        </div>
      ) : null}
    </PortalShell>
  )
}
