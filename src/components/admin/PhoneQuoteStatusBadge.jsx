import { MailCheck } from 'lucide-react'
import { formatDateTimeUK } from '../../lib/formatDateDisplay'
import { phoneQuoteAdminStatus } from '../../lib/phoneQuotePaymentRules'

const STYLES = {
  draft: 'border-slate-200 bg-slate-100 text-slate-700',
  quote_sent: 'border-sky-200 bg-sky-50 text-sky-800',
  deposit_paid: 'border-amber-200 bg-amber-50 text-amber-900',
  paid_in_full: 'border-emerald-200 bg-emerald-50 text-emerald-800',
}

/** @param {{ q: Record<string, unknown> }} props */
export default function PhoneQuoteStatusBadge({ q }) {
  const s = phoneQuoteAdminStatus(q)
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STYLES[s.key]}`}
      data-phone-quote-status={s.key}
    >
      {s.label}
    </span>
  )
}

/**
 * Green envelope shown only after a quote email was sent successfully.
 * @param {{ sentAt?: string | null, recipient?: string | null }} props
 */
export function QuoteEmailSentBadge({ sentAt, recipient }) {
  if (!sentAt) return null
  const when = formatDateTimeUK(sentAt)
  const to = String(recipient || '').trim()
  const detail = to ? `Sent ${when} to ${to}` : `Sent ${when}`
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700"
      title={detail}
      aria-label={`Email sent. ${detail}`}
    >
      <MailCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
      Email sent
    </span>
  )
}
