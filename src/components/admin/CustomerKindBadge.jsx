import { useEffect, useState } from 'react'
import { formatDateUK } from '../../lib/formatDateDisplay'
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
