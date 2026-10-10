import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PortalShell from '../components/customer-portal/PortalShell'
import { confirmEmailChange } from '../lib/customerPortalApi'

export default function CustomerPortalConfirmEmailPage() {
  const [params] = useSearchParams()
  const [phase, setPhase] = useState('checking')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = params.get('token') || ''
    if (!token) {
      setPhase('invalid')
      setMessage('This confirmation link is invalid or has expired. The current email is unchanged.')
      return undefined
    }
    let cancelled = false
    confirmEmailChange(token)
      .then((result) => {
        if (cancelled) return
        setPhase('confirmed')
        setMessage(result?.email
          ? `This account now uses ${result.email}. Your bookings, payments and feedback are unchanged.`
          : 'This email address is confirmed. Your bookings stay on the same account.')
      })
      .catch((err) => {
        if (cancelled) return
        setPhase('invalid')
        setMessage(err?.message || 'The current email is unchanged.')
      })
    return () => {
      cancelled = true
    }
  }, [params])

  return (
    <PortalShell
      requireSession={false}
      title="Confirm email | ShiftMyHome"
      description="Confirm the new email address for your ShiftMyHome account."
      path="/portal/confirm-email"
    >
      {phase === 'checking' ? <p className="text-sm text-slate-600">Confirming this email address…</p> : null}
      {phase !== 'checking' ? (
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {phase === 'confirmed' ? 'Email address confirmed' : 'Email address unchanged'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
          <Link to="/portal" className="mt-5 inline-block text-sm font-semibold text-brand-700">Back to sign in</Link>
        </div>
      ) : null}
    </PortalShell>
  )
}
