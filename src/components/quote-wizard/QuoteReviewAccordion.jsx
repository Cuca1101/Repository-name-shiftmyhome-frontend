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
  summary = null,
  onEdit = null,
  trackConfirmation = false,
  trailing = null,
  hideEditLabel = false,
  alwaysOpen = false,
  hint = '',
}) {
  const [open, setOpen] = useState(alwaysOpen || defaultOpen || (trackConfirmation && !confirmed))
  const expanded = alwaysOpen || open

  function toggle() {
    if (alwaysOpen) return
    if (typeof onEdit === 'function' && !open) {
      onEdit()
      return
    }
    setOpen((value) => !value)
  }

  const headerBody = (
    <>
      {Icon ? (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      ) : null}
      <span className="min-w-0 flex-1 text-sm font-bold text-slate-900">{title}</span>
      {trackConfirmation && confirmed ? (
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-600">
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
          Confirmed
        </span>
      ) : null}
      {trackConfirmation && !confirmed ? (
        <span className="shrink-0 text-xs font-semibold text-amber-700">Needs details</span>
      ) : null}
      {trailing ? <span className="shrink-0 text-xs font-medium text-slate-500">{trailing}</span> : null}
      {alwaysOpen ? null : (
        <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-blue-700">
          {hideEditLabel ? null : open ? 'Close' : 'Edit'}
          <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
        </span>
      )}
    </>
  )

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {alwaysOpen ? (
        <div className="flex w-full items-center gap-2.5 px-3 py-3 text-left sm:px-4">{headerBody}</div>
      ) : (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={toggle}
          className="flex w-full items-center gap-2.5 px-3 py-3 text-left sm:px-4"
        >
          {headerBody}
        </button>
      )}
      {!expanded && hint ? (
        <p className="border-t border-slate-100 px-3 py-2.5 text-xs font-medium leading-snug text-blue-700 sm:px-4">{hint}</p>
      ) : null}
      {!expanded && summary ? <div className="border-t border-slate-100 px-3 py-3 sm:px-4">{summary}</div> : null}
      <div className={expanded ? 'border-t border-slate-100 px-3 py-3 sm:px-4' : 'hidden'}>{children}</div>
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
  summary = null,
  onEdit = null,
  trackConfirmation = false,
  trailing = null,
  hideEditLabel = false,
  alwaysOpen = false,
  hint = '',
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
      summary={summary}
      onEdit={onEdit}
      trackConfirmation={trackConfirmation}
      trailing={trailing}
      hideEditLabel={hideEditLabel}
      alwaysOpen={alwaysOpen}
      hint={hint}
    >
      {children}
    </QuoteReviewAccordion>
  )
}
