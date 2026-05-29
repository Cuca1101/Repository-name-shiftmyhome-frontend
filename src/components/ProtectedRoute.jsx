import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { verifyAdminWebSession } from '../lib/adminWebAuth'
import { supabase } from '../lib/supabase'

export default function ProtectedRoute({ children }) {
  const [gate, setGate] = useState(/** @type {'loading' | 'ok' | 'login' | 'denied'} */ ('loading'))
  const [denyMessage, setDenyMessage] = useState('')

  useEffect(() => {
    if (!supabase) {
      setGate('login')
      return
    }

    let cancelled = false

    async function check(session) {
      if (!session) {
        if (!cancelled) setGate('login')
        return
      }
      const result = await verifyAdminWebSession(session)
      if (cancelled) return
      if (result.ok) {
        setGate('ok')
        setDenyMessage('')
        return
      }
      await supabase.auth.signOut()
      setDenyMessage(result.message)
      setGate('denied')
    }

    void supabase.auth.getSession().then(({ data: { session: s } }) => check(s ?? null))

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      void check(s ?? null)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  if (gate === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        Loading…
      </div>
    )
  }

  if (!supabase) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-lg font-semibold text-slate-900">Supabase not configured</p>
        <p className="mt-2 text-sm text-slate-600">
          Add <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_URL</code> and{' '}
          <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_PUBLISHABLE_KEY</code> (starts with{' '}
          <code className="rounded bg-slate-100 px-1">sb_publishable_</code>) to your{' '}
          <code className="rounded bg-slate-100 px-1">.env</code> file.
        </p>
      </div>
    )
  }

  if (gate === 'login' || gate === 'denied') {
    return <Navigate to="/admin/login" replace state={{ adminDenyMessage: denyMessage }} />
  }

  return children
}
