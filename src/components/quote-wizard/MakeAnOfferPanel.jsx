import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, Mail, Phone, PoundSterling, User, X } from 'lucide-react'
import { buildCustomerOfferIdentity, hashCustomerOfferIdentity } from '../../lib/customerOfferSnapshot'
import { payableOfferAmount, submitCustomerOffer } from '../../lib/customerOfferApi'
import { useQuoteWizard } from './QuoteWizardContext'

function moneyInput(value) {
  const n = Number(String(value).replace(/,/g, ''))
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100) / 100
}

function emailOk(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

function contactOk(name, phone, email) {
  return String(name || '').trim().length >= 2 && String(phone || '').trim().length >= 6 && emailOk(email)
}

const fieldClass =
  'min-h-[48px] w-full rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20'

/**
 * Secondary budget request under the review total. It does not take payment or reserve a slot.
 */
export default function MakeAnOfferPanel({ className = '' }) {
  const { wizard, setWizard, breakdown, totalM3, quoteRef, buildQuotePayloadForSave, matchedOffer } = useQuoteWizard()
  const titleId = useId()
  const amountId = useId()
  const messageId = useId()
  const flexId = useId()
  const flexDetailId = useId()
  const nameId = useId()
  const phoneId = useId()
  const emailId = useId()
  const triggerRef = useRef(null)
  const amountRef = useRef(null)
  const dialogRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [flexible, setFlexible] = useState(false)
  const [flexibility, setFlexibility] = useState('')
  const [name, setName] = useState(wizard?.fullName || '')
  const [phone, setPhone] = useState(wizard?.phone || '')
  const [email, setEmail] = useState(wizard?.email || '')
  const [contactTouched, setContactTouched] = useState(false)
  const [editingContact, setEditingContact] = useState(() => !contactOk(wizard?.fullName, wizard?.phone, wizard?.email))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [amountError, setAmountError] = useState('')
  const [contactError, setContactError] = useState('')
  const [sentHash, setSentHash] = useState('')
  const [duplicate, setDuplicate] = useState(false)

  const total =
    breakdown?.estimatedTotal != null && Number.isFinite(breakdown.estimatedTotal)
      ? breakdown.estimatedTotal
      : null

  async function currentHash() {
    return hashCustomerOfferIdentity(buildCustomerOfferIdentity({ wizard, breakdown, totalM3 }))
  }

  const alreadySent = Boolean(sentHash)
  const rememberedOpen =
    !sentHash &&
    matchedOffer &&
    !matchedOffer.stale &&
    (matchedOffer.status === 'pending' || matchedOffer.status === 'countered')
  const agreedAmount = payableOfferAmount(matchedOffer)

  useEffect(() => {
    if (!open) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = window.requestAnimationFrame(() => amountRef.current?.focus())
    function onKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      window.cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
      triggerRef.current?.focus()
    }
  }, [open])

  function openModal() {
    if (!contactTouched) {
      const nextName = wizard?.fullName || ''
      const nextPhone = wizard?.phone || ''
      const nextEmail = wizard?.email || ''
      setName(nextName)
      setPhone(nextPhone)
      setEmail(nextEmail)
      setEditingContact(!contactOk(nextName, nextPhone, nextEmail))
    }
    setAmountError('')
    setContactError('')
    setError('')
    setOpen(true)
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setAmountError('')
    setContactError('')
    if (total == null) {
      setError('Your quote is still calculating. Wait a moment and try again.')
      return
    }
    const proposed = moneyInput(amount)
    if (proposed == null || proposed <= 0) {
      setAmountError('Enter your proposed total in pounds.')
      amountRef.current?.focus()
      return
    }
    if (proposed >= total - 0.009) {
      setAmountError('Enter an amount below your current quote.')
      amountRef.current?.focus()
      return
    }
    if (!contactOk(name, phone, email)) {
      setContactError('Add your name, phone, and email so we can reply.')
      setEditingContact(true)
      return
    }
    const payload = buildQuotePayloadForSave?.()
    if (!payload) {
      setError('Complete your quote details before sending an offer.')
      return
    }
    setBusy(true)
    try {
      const hash = await currentHash()
      if (sentHash && sentHash === hash) {
        setDuplicate(true)
        setOpen(false)
        return
      }
      const nextName = name.trim()
      const nextPhone = phone.trim()
      const nextEmail = email.trim()
      setWizard((prev) => ({
        ...prev,
        fullName: nextName,
        phone: nextPhone,
        email: nextEmail,
      }))
      const result = await submitCustomerOffer({
        wizard: { ...wizard, fullName: nextName, phone: nextPhone, email: nextEmail },
        breakdown,
        totalM3,
        quoteRef,
        payload,
        proposedAmount: proposed,
        message,
        dateFlexibility: flexible ? flexibility : '',
        customerName: nextName,
        customerPhone: nextPhone,
        customerEmail: nextEmail,
        summary: {
          route: `${wizard.pickupAddress || ''} → ${wizard.deliveryAddress || ''}`,
          moveDate: wizard.moveDate || '',
          packageName: breakdown?.servicePackageName || wizard.packageTier || 'Standard',
          packageFee: breakdown?.servicePackageFee || 0,
          extrasTotal: breakdown?.extrasTotal || 0,
          movePrice: breakdown?.quoteBaseTotal ?? null,
          originalTotal: total,
          crewSize: wizard.crewSize || null,
          volumeM3: totalM3,
        },
      })
      setSentHash(hash)
      setDuplicate(Boolean(result.duplicate))
      setOpen(false)
    } catch (err) {
      setError(err?.message || 'We could not send your offer. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (alreadySent || rememberedOpen) {
    return (
      <div className={`rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 ${className}`}>
        <p className="font-bold">Offer sent</p>
        <p className="mt-1 leading-snug">
          {duplicate || rememberedOpen
            ? 'We already have your offer for this quote. We will email you after it is reviewed.'
            : 'Thanks. We will review your offer and email you. You have not been charged.'}
        </p>
        <p className="mt-1 leading-snug">
          Sending an offer does not confirm a booking or reserve a slot.
        </p>
      </div>
    )
  }

  if (agreedAmount) {
    return (
      <div className={`rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 ${className}`}>
        <p className="font-bold">Offer accepted</p>
        <p className="mt-1 leading-snug">
          Continue to payment to book this move at the agreed total of £{agreedAmount.toFixed(2)}.
        </p>
      </div>
    )
  }

  const dialog = open
    ? createPortal(
        <div className="fixed inset-0 z-[240] flex items-center justify-center p-3 sm:p-6">
          <button type="button" className="absolute inset-0 bg-slate-900/45" aria-label="Close offer form" onClick={() => !busy && setOpen(false)} />
          <form
            ref={dialogRef}
            onSubmit={onSubmit}
            className="relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[min(36rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl bg-white shadow-xl sm:max-h-[calc(100dvh-3rem)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:pt-5">
              <div className="flex items-start justify-between gap-3">
                <h2 id={titleId} className="text-2xl font-extrabold tracking-tight text-[#0c2340]">
                  Make an offer
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={busy}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>
              <p className="text-sm leading-snug text-slate-600">Tell us what works for your budget.</p>
              <p className="text-sm leading-snug text-slate-500">For your selected move, package and extras.</p>
              {matchedOffer?.stale ? (
                <p className="mt-2 text-sm font-medium text-amber-800">
                  Your previous offer needs a new review because this quote has changed.
                </p>
              ) : null}

              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-[#e8f2ff] px-3 py-2.5">
                <span className="text-sm text-slate-600">Your current quote</span>
                <span className="text-xl font-extrabold tabular-nums text-blue-600">
                  {total != null ? `£${total.toFixed(2)}` : '—'}
                </span>
              </div>

              <div className="mt-3">
                <label htmlFor={amountId} className="text-sm font-bold text-slate-900">
                  Your offer
                </label>
                <div className={`mt-1.5 flex overflow-hidden rounded-xl border bg-white focus-within:ring-2 focus-within:ring-blue-600/20 ${amountError ? 'border-red-400 focus-within:border-red-500' : 'border-slate-200 focus-within:border-blue-600'}`}>
                  <span className="flex items-center border-r border-slate-200 bg-slate-50 px-3 text-base text-slate-500" aria-hidden>
                    £
                  </span>
                  <input
                    ref={amountRef}
                    id={amountId}
                    inputMode="decimal"
                    autoComplete="off"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value)
                      if (amountError) setAmountError('')
                    }}
                    className="min-h-[48px] min-w-0 flex-1 bg-transparent px-3 text-base text-slate-900 outline-none placeholder:text-slate-400"
                    placeholder="Enter your offer"
                    aria-invalid={amountError ? 'true' : 'false'}
                    aria-describedby={amountError ? `${amountId}-error` : undefined}
                  />
                </div>
                {amountError ? (
                  <p id={`${amountId}-error`} className="mt-1 text-sm font-medium text-red-700" role="alert">
                    {amountError}
                  </p>
                ) : null}
              </div>

              <div className="mt-3">
                <label htmlFor={messageId} className="text-sm font-bold text-slate-900">
                  Message (optional)
                </label>
                <textarea
                  id={messageId}
                  rows={2}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className={`${fieldClass} mt-1.5 resize-none py-2.5`}
                  placeholder="Anything you'd like us to know?"
                />
              </div>

              <div className="mt-3">
                <label htmlFor={flexId} className="flex min-h-[44px] items-center gap-2.5 text-sm font-medium text-slate-800">
                  <input
                    id={flexId}
                    type="checkbox"
                    checked={flexible}
                    onChange={(e) => setFlexible(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                  />
                  I’m flexible with my moving date
                </label>
                {flexible ? (
                  <label htmlFor={flexDetailId} className="mt-1.5 block text-sm font-semibold text-slate-800">
                    Flexibility details (optional)
                    <input
                      id={flexDetailId}
                      value={flexibility}
                      onChange={(e) => setFlexibility(e.target.value)}
                      className={`${fieldClass} mt-1`}
                      placeholder="For example, the day before or after"
                    />
                  </label>
                ) : null}
              </div>

              <div className="mt-3 rounded-xl bg-[#e8f2ff] px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-slate-900">Your contact details</p>
                  <button
                    type="button"
                    onClick={() => setEditingContact((value) => !value)}
                    className="min-h-[44px] shrink-0 px-1 text-sm font-bold text-blue-600 hover:text-blue-700"
                  >
                    {editingContact ? 'Done' : 'Edit'}
                  </button>
                </div>
                {editingContact ? (
                  <div className="mt-2 space-y-2">
                    <label htmlFor={nameId} className="block text-xs font-semibold text-slate-700">
                      Full name
                      <input
                        id={nameId}
                        value={name}
                        onChange={(e) => {
                          setContactTouched(true)
                          setName(e.target.value)
                          if (contactError) setContactError('')
                        }}
                        className={`${fieldClass} mt-1`}
                        autoComplete="name"
                      />
                    </label>
                    <label htmlFor={phoneId} className="block text-xs font-semibold text-slate-700">
                      Phone
                      <input
                        id={phoneId}
                        type="tel"
                        value={phone}
                        onChange={(e) => {
                          setContactTouched(true)
                          setPhone(e.target.value)
                          if (contactError) setContactError('')
                        }}
                        className={`${fieldClass} mt-1`}
                        autoComplete="tel"
                      />
                    </label>
                    <label htmlFor={emailId} className="block text-xs font-semibold text-slate-700">
                      Email
                      <input
                        id={emailId}
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setContactTouched(true)
                          setEmail(e.target.value)
                          if (contactError) setContactError('')
                        }}
                        className={`${fieldClass} mt-1`}
                        autoComplete="email"
                      />
                    </label>
                  </div>
                ) : (
                  <ul className="mt-1.5 space-y-1.5 text-sm text-slate-800">
                    <li className="flex items-start gap-2">
                      <User className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                      <span className="min-w-0 break-words">{name.trim() || 'Name not added yet'}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Phone className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                      <span className="min-w-0 break-words">{phone.trim() || 'Phone not added yet'}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                      <span className="min-w-0 break-all">{email.trim() || 'Email not added yet'}</span>
                    </li>
                  </ul>
                )}
                {contactError ? (
                  <p className="mt-1.5 text-sm font-medium text-red-700" role="alert">
                    {contactError}
                  </p>
                ) : null}
              </div>

              <p className="mt-3 text-center text-xs leading-relaxed text-slate-500">
                No payment required to submit an offer.
                <br />
                Submitting an offer does not confirm a booking or reserve a slot.
              </p>
              {error ? (
                <p className="mt-2 text-center text-sm font-medium text-red-700" role="alert">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={busy}
                className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-1 rounded-xl bg-blue-600 text-base font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
              >
                {busy ? 'Sending…' : 'Send offer'}
                {busy ? null : <ChevronRight className="h-4 w-4" aria-hidden />}
              </button>
            </div>
          </form>
        </div>,
        document.body,
      )
    : null

  return (
    <div className={className}>
      <div className="rounded-2xl border !border-[#8eb0d6] bg-[#d5e5f8] px-4 py-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-blue-700 shadow-sm">
            <PoundSterling className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-extrabold text-slate-950">Is your quote above your budget?</p>
            <p className="mt-1 text-sm font-semibold leading-snug text-slate-800">
              Tell us what you can afford. We’ll review your offer.
            </p>
          </div>
        </div>
        {matchedOffer?.stale ? (
          <p className="mt-2 text-sm font-medium text-amber-800">
            Your previous offer needs a new review because this quote has changed.
          </p>
        ) : null}
        <button
          ref={triggerRef}
          type="button"
          onClick={openModal}
          className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-1 rounded-xl border border-blue-700 bg-white px-4 text-sm font-extrabold text-blue-800 shadow-sm transition hover:bg-blue-50"
        >
          Make an offer
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
        <p className="mt-2 text-center text-xs font-semibold leading-snug text-slate-700">For your selected move and service.</p>
        <p className="text-center text-xs font-semibold leading-snug text-slate-700">Subject to approval and availability.</p>
      </div>
      {dialog}
    </div>
  )
}
