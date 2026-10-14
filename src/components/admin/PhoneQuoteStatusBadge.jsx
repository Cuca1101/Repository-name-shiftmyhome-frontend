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
