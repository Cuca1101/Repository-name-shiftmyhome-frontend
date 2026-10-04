import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { structuredAddressesConfirmed } from './AddressConfirmationSection'

export function isQuoteContactComplete(data) {
  return Boolean(
    String(data?.fullName || '').trim() &&
      String(data?.phone || '').trim() &&
      String(data?.email || '').trim(),
  )
}

export function isQuoteAddressesConfirmed(data) {
  return structuredAddressesConfirmed(data)
}

/** Collapsible review section. Children stay mounted so existing field ids remain available. */
export default function QuoteReviewAccordion({
  title,
  confirmed = false,
  icon: Icon,
  children,
  defaultOpen = false,
  accent = 'default',
}) {
  const [open, setOpen] = useState(defaultOpen)
  const isBlue = accent === 'blue'

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2.5 px-3 py-3 text-left sm:px-4"
      >
        {Icon ? (
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              isBlue ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        ) : null}
        <span
          className={`min-w-0 flex-1 text-sm font-semibold ${isBlue ? 'text-blue-600' : 'text-slate-900'}`}
        >
          {title}
        </span>
        {confirmed ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-600">
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
            Confirmed
          </span>
        ) : null}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      <div className={open ? 'border-t border-slate-100 px-3 py-3 sm:px-4' : 'hidden'}>{children}</div>
    </section>
  )
}

export function ReviewGroup({
  accordion,
  title,
  confirmed = false,
  icon,
  defaultOpen = false,
  accent = 'default',
  children,
}) {
  if (!accordion) return children
  return (
    <QuoteReviewAccordion
      title={title}
      confirmed={confirmed}
      icon={icon}
      defaultOpen={defaultOpen}
      accent={accent}
    >
      {children}
    </QuoteReviewAccordion>
  )
}
