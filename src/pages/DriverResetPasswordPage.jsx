import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../components/Logo'
import { formatAuthError } from '../lib/authErrors'
import {
  PASSWORD_RESET_PATH,
  PASSWORD_RESET_REDIRECT,
  parsePasswordRecoveryUrl,
  validateNewPassword,
} from '../lib/passwordRecoveryUrl'
import { supabase } from '../lib/supabase'

export default function DriverResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [phase, setPhase] = useState('request')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    document.title = 'Reset password · Shift My Home'
    const meta = document.querySelector('meta[name="robots"]')
    const created = !meta
    const tag = meta || document.createElement('meta')
    tag.setAttribute('name', 'robots')
    tag.setAttribute('content', 'noindex')
    if (created) document.head.appendChild(tag)

    const parsed = parsePasswordRecoveryUrl(window.location.href)
    if (!parsed || !supabase) {
      if (parsed && !supabase) {
        setError('Password reset is unavailable because the site is not connected.')
      }
      return undefined
    }

    let cancelled = false
    setPhase('opening')
    setLoading(true)
    void (async () => {
      const result = parsed.kind === 'code'
        ? await supabase.auth.exchangeCodeForSession(parsed.code)
        : await supabase.auth.setSession({
          access_token: parsed.accessToken,
          refresh_token: parsed.refreshToken,
        })
      if (cancelled) return
      setLoading(false)
      if (result.error) {
        setPhase('request')
        setError('This reset link is invalid or has expired. Request a new one.')
        return
      }
      window.history.replaceState({}, document.title, PASSWORD_RESET_PATH)
      setPhase('choose')
    })()

    return () => {
      cancelled = true
    }
  }, [])

  async function sendReset(event) {
    event.preventDefault()
    setError('')
    setInfo('')
    const trimmed = email.trim()
    if (!supabase) {
      setError('Password reset is unavailable because the site is not connected.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Enter a valid email address.')
      return
    }
    setLoading(true)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: PASSWORD_RESET_REDIRECT,
      })
      if (resetError) {
        setError(formatAuthError(resetError))
        return
      }
      setInfo('Check your email for the reset link. It opens this page so you can choose a new password.')
    } finally {
      setLoading(false)
    }
  }

  async function savePassword(event) {
    event.preventDefault()
    setError('')
    const invalid = validateNewPassword(password, confirm)
    if (invalid) {
      setError(invalid)
      return
    }
    if (!supabase) {
      setError('Password reset is unavailable because the site is not connected.')
      return
    }
    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(formatAuthError(updateError))
        return
      }
      await supabase.auth.signOut()
      setPhase('done')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-100 px-4 py-12">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="flex justify-center">
          <Logo />
        </div>
        <h1 className="mt-3 text-center text-lg font-semibold text-slate-900">Reset password</h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          Use the same email as the driver app or the admin panel.
        </p>

        {phase === 'opening' && (
          <p className="mt-8 text-center text-sm text-slate-600">Opening your reset link…</p>
        )}

        {phase === 'request' && (
          <form onSubmit={sendReset} className="mt-8 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </label>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>}
            {info && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">{info}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] rounded-xl bg-brand-600 py-3 font-semibold text-white shadow transition hover:bg-brand-700 disabled:opacity-60"
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        {phase === 'choose' && (
          <form onSubmit={savePassword} className="mt-8 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">New password</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Confirm password</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </label>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] rounded-xl bg-brand-600 py-3 font-semibold text-white shadow transition hover:bg-brand-700 disabled:opacity-60"
            >
              {loading ? 'Saving…' : 'Save new password'}
            </button>
          </form>
        )}

        {phase === 'done' && (
          <p className="mt-8 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
            Password updated. Sign in with the new password in the driver app or the admin panel.
          </p>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/admin/login" className="font-medium text-brand-700 hover:underline">
            Admin sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
