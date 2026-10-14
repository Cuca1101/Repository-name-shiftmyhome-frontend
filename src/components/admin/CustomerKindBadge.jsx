import { useEffect, useState } from 'react'
import { formatDateUK } from '../../lib/formatDateDisplay'
import { phoneMatchKey, resolvePhoneBookingCustomerStatus, usableCustomerEmail } from '../../lib/phoneBookingCustomerStatus'
import { supabase } from '../../lib/supabase'

const LABEL = {
  new: 'New customer',
  returning: 'Returning customer',
}

export function customerKindLabel(kind) {
  if (kind === 'returning') return LABEL.returning
  if (kind === 'new') return LABEL.new
  return ''
}

export default function CustomerKindBadge({ kind, tone = 'light' }) {
  const label = customerKindLabel(kind)
  if (!label) return null
  const returning = kind === 'returning'
  const light = tone === 'light'
  const className = light
    ? returning
      ? 'bg-violet-50 text-violet-800 ring-violet-200/80'
      : 'bg-sky-50 text-sky-800 ring-sky-200/80'
    : 'bg-white/15 text-white'
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${light ? '' : 'ring-white/20'} ${className}`}>
      {label}
    </span>
  )
}

export function CustomerIdentitySummary({ email, kind = '', previewNext = false, tone = 'light' }) {
  const [info, setInfo] = useState(null)

  useEffect(() => {
    const value = String(email || '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value === 'phone-booking@shiftmyhome.local') {
      setInfo(null)
      return undefined
    }
    let cancelled = false
    const timer = setTimeout(() => {
      supabase
        ?.rpc('admin_customer_identity', { p_email: value })
        .then(({ data }) => {
          if (!cancelled) setInfo(data?.ok ? data : null)
        })
        .catch(() => {
          if (!cancelled) setInfo(null)
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [email])

  if (!info?.ok) return null
  const shownKind = previewNext ? info.next_kind : (kind || (Number(info.booking_count) > 1 ? 'returning' : 'new'))
  const count = Number(info.booking_count) || 0
  const first = info.first_booking_at ? formatDateUK(info.first_booking_at) : ''
  const muted = tone === 'dark' ? 'text-slate-300' : 'text-slate-600'

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <CustomerKindBadge kind={shownKind} tone={tone === 'dark' ? 'dark' : 'light'} />
      <p className={`text-[11px] ${muted}`}>
        {count} {count === 1 ? 'booking' : 'bookings'}
        {first ? ` · first ${first}` : ''}
        {previewNext && info.known ? ' · added to the same profile' : ''}
        {previewNext && !info.known ? ' · first booking for this email' : ''}
      </p>
    </div>
  )
}

export function CustomerBookingStatusView({ status = null, checking = false, ready = true }) {
  if (!ready) {
    return (
      <p className="mt-2 text-sm text-slate-500">
        Enter an email or phone number to see if this is a new or returning customer.
      </p>
    )
  }
  if (checking && !status) {
    return <p className="mt-2 text-sm text-slate-500">Checking previous bookings…</p>
  }
  if (status?.error) {
    return (
      <p className="mt-2 text-sm text-slate-500">
        Could not check whether this customer has booked before.
      </p>
    )
  }
  if (!status?.kind) return null
  const count = Number(status.count) || 0
  const first = status.firstBookingAt ? formatDateUK(status.firstBookingAt) : ''

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <CustomerKindBadge kind={status.kind} />
      <p className="text-sm text-slate-600">
        {count > 0
          ? `${count} previous ${count === 1 ? 'booking' : 'bookings'}${first ? ` · first ${first}` : ''}${status.detail ? ` · ${status.detail}` : ''}`
          : status.detail}
      </p>
    </div>
  )
}

export function PhoneBookingCustomerStatus({ email = '', phone = '' }) {
  const [state, setState] = useState({ status: null, checking: false })
  const emailKey = usableCustomerEmail(email)
  const phoneKey = phoneMatchKey(phone)

  useEffect(() => {
    if (!emailKey && !phoneKey) {
      setState({ status: null, checking: false })
      return undefined
    }
    let cancelled = false
    setState((current) => ({ ...current, checking: true }))
    const timer = setTimeout(() => {
      const identityPromise = emailKey
        ? supabase?.rpc('admin_customer_identity', { p_email: emailKey })
        : Promise.resolve({ data: null })
      const phonePromise = phoneKey
        ? supabase?.rpc('admin_customer_search', { p_query: phoneKey })
        : Promise.resolve({ data: null })
      Promise.all([identityPromise, phonePromise])
        .then(([identityResult, phoneResult]) => {
          if (cancelled) return
          const identity = identityResult?.data
          const customers = phoneResult?.data?.ok && Array.isArray(phoneResult.data.customers)
            ? phoneResult.data.customers
            : []
          const failed = (emailKey && identity && identity.ok === false)
            || (phoneKey && phoneResult?.data && phoneResult.data.ok === false)
          setState({
            checking: false,
            status: failed
              ? { error: true }
              : resolvePhoneBookingCustomerStatus({
                identity: identity?.ok ? identity : null,
                customers,
                email: emailKey,
                phone: phoneKey,
              }),
          })
        })
        .catch(() => {
          if (!cancelled) setState({ checking: false, status: { error: true } })
        })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [emailKey, phoneKey])

  return (
    <CustomerBookingStatusView
      ready={Boolean(emailKey || phoneKey)}
      checking={state.checking}
      status={state.status}
    />
  )
}
