import { useState } from 'react'
import emailjs from '@emailjs/browser'
import { CONTACT, WHATSAPP_URL } from '../config'
import { EMAILJS_CONFIG, EMAILJS_TEMPLATE_ID_GUIDE, isEmailJsReady } from '../emailjs.config'
import { insertHomePageQuoteLead } from '../lib/data/quotesRepository'
import { MOVE_DATE_PAST_ERROR, getLocalDateYYYYMMDD, isMoveDateOnOrAfterToday } from '../lib/moveDateLocal'

const inputClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25'
const labelClass = 'block text-sm font-medium text-slate-700'

const initialForm = {
  name: '',
  email: '',
  phone: '',
  service: '',
  pickup: '',
  delivery: '',
  move_date: '',
  details: '',
  quote_ref: '',
}

export default function ContactSection() {
  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState({ type: null, text: '' })

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setFeedback({ type: null, text: '' })

    if (!isEmailJsReady()) {
      setFeedback({ type: 'error', text: EMAILJS_TEMPLATE_ID_GUIDE })
      setSubmitting(false)
      return
    }

    if (!isMoveDateOnOrAfterToday(form.move_date)) {
      setFeedback({ type: 'error', text: MOVE_DATE_PAST_ERROR })
      setSubmitting(false)
      return
    }

    let quoteRefForEmail = form.quote_ref.trim()

    try {
      const saved = await insertHomePageQuoteLead({
        name: form.name,
        email: form.email,
        phone: form.phone,
        service: form.service,
        pickup: form.pickup,
        delivery: form.delivery,
        move_date: form.move_date,
        details: form.details,
        quote_ref: quoteRefForEmail,
      })
      quoteRefForEmail = saved.quote_ref
    } catch (err) {
      const msg = err?.message || 'Could not save your request.'
      setFeedback({ type: 'error', text: msg })
      setSubmitting(false)
      return
    }

    try {
      await emailjs.send(
        EMAILJS_CONFIG.serviceId,
        EMAILJS_CONFIG.templateId,
        {
          name: form.name,
          email: form.email,
          phone: form.phone,
          service: form.service,
          pickup: form.pickup,
          delivery: form.delivery,
          move_date: form.move_date,
          details: form.details,
          quote_ref: quoteRefForEmail,
        },
        EMAILJS_CONFIG.publicKey,
      )
      setFeedback({
        type: 'success',
        text: `Your request has been sent successfully. Your quote reference is ${quoteRefForEmail}.`,
      })
      setForm(initialForm)
    } catch {
      setFeedback({
        type: 'warning',
        text: `Your details were saved as ${quoteRefForEmail}, but the email could not be sent. Please contact us by phone or WhatsApp and quote this reference.`,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section id="contact" className="scroll-mt-20 border-t border-slate-200 bg-slate-50 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Quote request</h2>
          <p className="mt-4 text-lg text-slate-600">
            Send your details and we&apos;ll get back with confirmation and availability.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-5xl gap-10 lg:grid-cols-5 lg:gap-12">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card lg:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Direct</p>
            <ul className="mt-4 space-y-4">
              <li>
                <p className="text-xs font-medium text-slate-500">Phone</p>
                <a href={`tel:${CONTACT.phoneTel}`} className="mt-1 block text-lg font-semibold text-brand-700 hover:text-brand-800">
                  {CONTACT.phoneDisplay}
                </a>
              </li>
              <li>
                <p className="text-xs font-medium text-slate-500">WhatsApp</p>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex font-medium text-emerald-700 underline-offset-2 hover:underline"
                >
                  Message on WhatsApp
                </a>
              </li>
              <li>
                <p className="text-xs font-medium text-slate-500">Email</p>
                <a
                  href={`mailto:${CONTACT.email}`}
                  className="mt-1 break-all text-lg font-medium text-slate-800 hover:text-brand-700"
                >
                  {CONTACT.email}
                </a>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8 lg:col-span-3">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="quote-name">Name</label>
                  <input id="quote-name" name="name" type="text" required autoComplete="name" className={inputClass} value={form.name} onChange={(e) => setField('name', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="quote-email">Email</label>
                  <input id="quote-email" name="email" type="email" required autoComplete="email" className={inputClass} value={form.email} onChange={(e) => setField('email', e.target.value)} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="quote-phone">Phone</label>
                  <input id="quote-phone" name="phone" type="tel" required autoComplete="tel" className={inputClass} value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="quote-service">Service</label>
                  <input id="quote-service" name="service" type="text" required className={inputClass} placeholder="e.g. House Removals" value={form.service} onChange={(e) => setField('service', e.target.value)} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="quote-pickup">Pickup</label>
                  <input id="quote-pickup" name="pickup" type="text" required className={inputClass} placeholder="Pickup address or postcode" value={form.pickup} onChange={(e) => setField('pickup', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="quote-delivery">Delivery</label>
                  <input id="quote-delivery" name="delivery" type="text" required className={inputClass} placeholder="Delivery address or postcode" value={form.delivery} onChange={(e) => setField('delivery', e.target.value)} />
                </div>
              </div>

              <div>
                <label className={labelClass} htmlFor="quote-move-date">Move date</label>
                <input
                  id="quote-move-date"
                  name="move_date"
                  type="date"
                  required
                  min={getLocalDateYYYYMMDD()}
                  className={inputClass}
                  value={form.move_date}
                  onChange={(e) => setField('move_date', e.target.value)}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="quote-details">Details</label>
                <textarea id="quote-details" name="details" required rows={5} className={`${inputClass} min-h-[120px] resize-y`} placeholder="Tell us about your items, access, and any special requirements…" value={form.details} onChange={(e) => setField('details', e.target.value)} />
              </div>

              <div>
                <label className={labelClass} htmlFor="quote-ref">Quote reference <span className="font-normal text-slate-500">(optional)</span></label>
                <input id="quote-ref" name="quote_ref" type="text" className={inputClass} placeholder="e.g. SMH-2026-123456 if you already have one" value={form.quote_ref} onChange={(e) => setField('quote_ref', e.target.value)} />
              </div>

              {feedback.text ? (
                <p
                  className={`rounded-lg px-3 py-2 text-sm ${
                    feedback.type === 'success'
                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-900'
                      : feedback.type === 'warning'
                        ? 'border border-amber-200 bg-amber-50 text-amber-950'
                        : 'border border-red-200 bg-red-50 text-red-900'
                  }`}
                  role="status"
                >
                  {feedback.text}
                </p>
              ) : null}

              <button type="submit" disabled={submitting} className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-emerald-600 px-6 py-3.5 text-base font-bold text-white shadow-md transition hover:from-brand-700 hover:to-emerald-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70">
                {submitting ? 'Sending…' : 'Submit quote request'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}
