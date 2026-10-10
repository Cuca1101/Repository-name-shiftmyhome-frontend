import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import PortalShell from '../components/customer-portal/PortalShell'
import { sessionKindFromUser } from '../lib/accountRole'
import { requestPasswordReset } from '../lib/customerPortalApi'
import { customerPortalClient } from '../lib/customerPortalClient'
import { passwordUpdateBody } from '../lib/customerPortalModel'
import { validateNewPassword } from '../lib/passwordRecoveryUrl'

export default function CustomerPortalResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [phase, setPhase] = useState('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const tokenHash = params.get('token_hash') || ''
    const type = params.get('type') || ''
    if (!customerPortalClient || !tokenHash || type !== 'recovery') {
      setPhase('expired')
      return undefined
    }
    let cancelled = false
    customerPortalClient.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' }).then(async ({ data, error: verifyError }) => {
      if (cancelled) return
      if (verifyError) {
        setPhase('expired')
        setError('This reset link is invalid or has expired. Request a new one.')
        return
      }
      const signedKind = sessionKindFromUser(data.user)
      const server = await customerPortalClient.rpc('account_session_kind')
      const kind = !server.error && typeof server.data === 'string' ? server.data : signedKind
      if (kind === 'admin' || kind === 'driver') {
        await customerPortalClient.auth.signOut()
        if (!cancelled) {
          setPhase(kind)
          setError('')
        }
        return
      }
      setPhase('choose')
    }).catch(() => {
      if (!cancelled) {
        setPhase('expired')
        setError('This reset link is invalid or has expired. Request a new one.')
      }
    })
    return () => {
      cancelled = true
    }
  }, [params])

  async function save(event) {
    event.preventDefault()
    setError('')
    const invalid = validateNewPassword(password, confirm)
    if (invalid) {
      setError(invalid)
      return
    }
    if (!customerPortalClient) {
      setError('Password reset is unavailable.')
      return
    }
    setSaving(true)
    try {
      const { error: updateError } = await customerPortalClient.auth.updateUser(passwordUpdateBody(password))
      if (updateError) {
        setError(updateError.message || 'Could not save the password.')
        return
      }
      navigate('/portal/bookings', { replace: true, state: { passwordSaved: true } })
    } finally {
      setSaving(false)
    }
  }

  async function resend(event) {
    event.preventDefault()
    setNotice('')
    setError('')
    setSaving(true)
    try {
      const result = await requestPasswordReset(email)
      setNotice(result?.message || 'If an account exists for this email, we have sent a new link.')
    } catch (err) {
      setError(err?.message || 'Could not send a new link.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PortalShell
      requireSession={false}
      title="Choose a password | ShiftMyHome"
      description="Set a new password for your ShiftMyHome account."
      path="/portal/reset-password"
    >
      {phase === 'checking' ? <p className="text-sm text-slate-600">Opening your reset link…</p> : null}
      {phase === 'choose' ? (
        <form onSubmit={save} className="space-y-3">
          <h1 className="text-2xl font-extrabold tracking-tight">Choose a new password</h1>
          <p className="text-sm leading-6 text-slate-600">
            This stays on the same account as your email link. You can keep signing in with either.
          </p>
          <label className="block text-sm font-medium" htmlFor="portal-new-password">New password</label>
          <input
            id="portal-new-password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base outline-none focus:border-brand-500"
          />
          <label className="block text-sm font-medium" htmlFor="portal-confirm-password">Confirm password</label>
          <input
            id="portal-confirm-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base outline-none focus:border-brand-500"
          />
          {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save password'}
          </button>
        </form>
      ) : null}
      {phase === 'admin' || phase === 'driver' ? (
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">This reset link is for a {phase} account</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {phase === 'driver'
              ? 'A driver password is changed from the driver app. This page left that session as it is.'
              : 'An admin password is changed from Admin. This page left the admin session as it is.'}
          </p>
          <Link to="/portal" className="mt-4 inline-block text-sm font-semibold text-brand-700">Back to customer sign in</Link>
        </div>
      ) : null}
      {phase === 'expired' ? (
        <form onSubmit={resend} className="space-y-3">
          <h1 className="text-2xl font-extrabold tracking-tight">This link has expired</h1>
          <p className="text-sm leading-6 text-slate-600">
            {error || 'Reset links only work for a short time. Enter your booking email and we will send a new one.'}
          </p>
          <label className="block text-sm font-medium" htmlFor="portal-reset-again">Email</label>
          <input
            id="portal-reset-again"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base outline-none focus:border-brand-500"
          />
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? 'Sending…' : 'Send a new link'}
          </button>
          {notice ? <p className="text-sm text-slate-700" role="status">{notice}</p> : null}
          <Link to="/portal" className="inline-block text-sm font-semibold text-brand-700">Back to sign in</Link>
        </form>
      ) : null}
    </PortalShell>
  )
}
