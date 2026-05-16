import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { formatAuthError } from '../lib/authErrors'
import { supabase } from '../lib/supabase'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/admin', { replace: true })
    })
  }, [navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const emailTrim = email.trim()
    if (!supabase) {
      setError(
        'Supabase is not configured. In the project root .env set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (the key that starts with sb_publishable_ from Dashboard → API Keys). Never use the secret key. Then restart: npm run dev',
      )
      return
    }
    if (!emailTrim) {
      setError('Enter your email address.')
      return
    }
    setLoading(true)
    try {
      const { data, error: signErr } = await supabase.auth.signInWithPassword({
        email: emailTrim,
        password,
      })
      if (signErr) {
        setError(formatAuthError(signErr))
        return
      }
      if (!data.session) {
        setError(
          'Login succeeded but no session was created. In Supabase: Authentication → check email confirmation and provider settings.',
        )
        return
      }
      navigate('/admin', { replace: true })
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
        <p className="mt-3 text-center text-sm text-slate-500">Admin sign in</p>
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-center text-xs leading-relaxed text-slate-600">
          Use an account listed in Supabase →{' '}
          <strong className="font-semibold text-slate-800">Authentication → Users</strong>. If none exist, click{' '}
          <strong className="font-semibold text-slate-800">Add user</strong> and set email + password.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
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
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </label>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[48px] rounded-xl bg-brand-600 py-3 font-semibold text-white shadow transition hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/" className="font-medium text-brand-700 hover:underline">
            ← Back to website
          </Link>
        </p>
      </div>
    </div>
  )
}
