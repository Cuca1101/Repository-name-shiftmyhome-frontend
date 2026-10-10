import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PortalShell, { useAppSession, usePortalSession } from '../components/customer-portal/PortalShell'
import { sessionKindFromUser } from '../lib/accountRole'
import { requestPortalLink } from '../lib/customerPortalApi'
import { customerPortalClient } from '../lib/customerPortalClient'

function passwordSignInMessage(err) {
  const lower = String(err?.message || '').toLowerCase()
  if (lower.includes('invalid login') || lower.includes('invalid_grant') || err?.status === 400) {
    return 'That email and password do not match. Use Forgot password, or email yourself a sign-in link.'
  }
  if (lower.includes('too many')) return 'Too many attempts. Wait a minute and try again.'
  return err?.message || 'Could not sign in.'
}

export default function CustomerPortalLoginPage() {
  const navigate = useNavigate()
  const { ready, session, notice } = usePortalSession()
  const app = useAppSession()
  const appKind = sessionKindFromUser(app.session?.user)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [signingIn, setSigningIn] = useState(false)

  useEffect(() => {
    if (ready && session) navigate('/portal/bookings', { replace: true })
  }, [ready, session, navigate])

  async function sendLink(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    const trimmed = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Enter the email address used on your booking.')
      return
    }
    setSending(true)
    try {
      const result = await requestPortalLink(trimmed)
      setMessage(result?.message || 'If this email has a booking, we have sent a sign-in link.')
    } catch (err) {
      setError(err?.message || 'Could not send the login link.')
    } finally {
      setSending(false)
    }
  }

  async function signInWithPassword(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!password) {
      setError('Enter your password, or email yourself a sign-in link.')
      return
    }
    if (!customerPortalClient) {
      setError('Sign-in is temporarily unavailable.')
      return
    }
    setSigningIn(true)
    try {
      const { data, error: signErr } = await customerPortalClient.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signErr) {
        setError(passwordSignInMessage(signErr))
        return
      }
      const signedKind = sessionKindFromUser(data.user)
      const server = await customerPortalClient.rpc('account_session_kind')
      const kind = !server.error && typeof server.data === 'string' ? server.data : signedKind
      if (kind === 'admin' || kind === 'driver') {
        await customerPortalClient.auth.signOut()
        setError(
          kind === 'driver'
            ? 'This email is a driver login. Use the driver app. Your driver session stays as it is.'
            : 'This email is an admin login. Use Admin, or open a customer from Admin → Customers. Your admin session stays as it is.',
        )
        return
      }
      navigate('/portal/bookings', { replace: true })
    } finally {
      setSigningIn(false)
    }
  }

  return (
    <PortalShell
      requireSession={false}
      title="My account | ShiftMyHome"
      description="Sign in to your ShiftMyHome bookings with a secure email link or a password."
      path="/portal"
    >
      {appKind === 'admin' || appKind === 'driver' ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-950" role="status">
          {appKind === 'driver'
            ? 'You are signed in as a driver. This page is the customer sign-in. Your driver session stays as it is.'
            : 'You are signed in as an admin. This page is the customer sign-in. Your admin session stays as it is. Open a customer from Admin → Customers to use their portal.'}
        </p>
      ) : null}
      {notice === 'admin' || notice === 'driver' ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-950" role="status">
          {notice === 'driver'
            ? 'That sign-in belongs to a driver account. The driver session was left in place.'
            : 'That sign-in belongs to an admin account. The admin session was left in place.'}
        </p>
      ) : null}
      <h1 className="text-2xl font-extrabold tracking-tight">My account</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Use the email from your booking. A password is optional. An email link always signs you in to the same account.
      </p>
      <form onSubmit={signInWithPassword} className="mt-5 space-y-3">
        <label className="block text-sm font-medium" htmlFor="portal-email">
          Email
        </label>
        <input
          id="portal-email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base outline-none focus:border-brand-500"
        />
        <label className="block text-sm font-medium" htmlFor="portal-password">
          Password
        </label>
        <input
          id="portal-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base outline-none focus:border-brand-500"
        />
        <button
          type="submit"
          disabled={signingIn}
          className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {signingIn ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-right text-sm">
          <Link to={`/portal/forgot-password?email=${encodeURIComponent(email.trim())}`} className="font-semibold text-brand-700">
            Forgot password?
          </Link>
        </p>
      </form>
      <form onSubmit={sendLink} className="mt-2 space-y-2">
        <p className="text-sm leading-6 text-slate-600">
          Sign in without a password. We’ll email you a secure login link.
        </p>
        <button
          type="submit"
          disabled={sending || signingIn}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 disabled:opacity-60"
        >
          {sending ? 'Sending login link…' : 'Send login link'}
        </button>
      </form>
      {message ? <p className="mt-4 text-sm leading-6 text-slate-700" role="status">{message}</p> : null}
      {error ? <p className="mt-4 text-sm text-red-700" role="alert">{error}</p> : null}
      <p className="mt-6 text-sm text-slate-500">
        A tracking link only shows the driver. To change a booking, sign in here.{' '}
        <Link to="/" className="font-semibold text-brand-700">Back to the website</Link>
      </p>
    </PortalShell>
  )
}
