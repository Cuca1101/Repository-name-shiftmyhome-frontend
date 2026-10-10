import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PortalShell from '../components/customer-portal/PortalShell'
import { requestPasswordReset } from '../lib/customerPortalApi'

export default function CustomerPortalForgotPasswordPage() {
  const [params] = useSearchParams()
  const [email, setEmail] = useState(params.get('email') || '')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  async function onSubmit(event) {
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
      const result = await requestPasswordReset(trimmed)
      setMessage(result?.message || 'If an account exists for this email, we have sent a password reset link.')
    } catch (err) {
      setError(err?.message || 'Could not send the reset link.')
    } finally {
      setSending(false)
    }
  }

  return (
    <PortalShell
      requireSession={false}
      title="Forgot password | ShiftMyHome"
      description="Reset the password for your ShiftMyHome account."
      path="/portal/forgot-password"
    >
      <h1 className="text-2xl font-extrabold tracking-tight">Forgot password</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Enter the email on your booking. If you have not set a password yet, you can still use the sign-in link.
      </p>
      <form onSubmit={onSubmit} className="mt-5 space-y-3">
        <label className="block text-sm font-medium" htmlFor="portal-reset-email">Email</label>
        <input
          id="portal-reset-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base outline-none focus:border-brand-500"
        />
        <button
          type="submit"
          disabled={sending}
          className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {sending ? 'Sending reset link…' : 'Send reset link'}
        </button>
      </form>
      {message ? <p className="mt-4 text-sm leading-6 text-slate-700" role="status">{message}</p> : null}
      {error ? <p className="mt-4 text-sm text-red-700" role="alert">{error}</p> : null}
      <p className="mt-6 text-sm">
        <Link to="/portal" className="font-semibold text-brand-700">Back to sign in</Link>
      </p>
    </PortalShell>
  )
}
