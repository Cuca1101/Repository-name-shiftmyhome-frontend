import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { insertAdminPhoneBooking } from '../lib/data/quotesRepository'
import { getLocalDateYYYYMMDD } from '../lib/moveDateLocal'
import { supabase } from '../lib/supabase'

const inputClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25'
const labelClass = 'block text-xs font-semibold uppercase tracking-wide text-slate-500'

const SERVICE_OPTIONS = [
  'House Removals',
  'Man with Van',
  'Furniture Delivery',
  'Office Moves',
  'Student Moves',
  'Clearance',
  'Other',
]

const initialForm = {
  name: '',
  email: '',
  phone: '',
  service: 'House Removals',
  pickup: '',
  delivery: '',
  move_date: getLocalDateYYYYMMDD(),
  arrival_time: '09:00',
  details: '',
  quote_ref: '',
  payment_mode: 'quote_only',
  amount_paid: '',
  estimated_total: '',
}

/** @param {string | undefined} email */
async function resolveAdminCreatorLabel(email) {
  const e = (email || '').trim()
  return e || 'admin'
}

export default function PhoneBookingAdmin() {
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)

  const setField = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setError('')
    setSuccess(null)

    const name = form.name.trim()
    const phone = form.phone.trim()
    const pickup = form.pickup.trim()
    const delivery = form.delivery.trim()
    if (!name || !phone || !pickup || !delivery || !form.move_date) {
      setError('Name, phone, pickup, delivery and move date are required.')
      setSubmitting(false)
      return
    }

    if (form.payment_mode !== 'quote_only') {
      const amt = Number(form.amount_paid || form.estimated_total)
      if (!Number.isFinite(amt) || amt <= 0) {
        setError('Enter the amount paid (or estimated total) for deposit / paid bookings.')
        setSubmitting(false)
        return
      }
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const createdBy = await resolveAdminCreatorLabel(sessionData.session?.user?.email)

      const amountPaid =
        form.amount_paid !== '' ? Number(form.amount_paid) : form.estimated_total !== '' ? Number(form.estimated_total) : null

      const saved = await insertAdminPhoneBooking({
        name,
        email: form.email.trim(),
        phone,
        service: form.service,
        pickup,
        delivery,
        move_date: form.move_date,
        arrival_time: form.arrival_time,
        details: form.details,
        quote_ref: form.quote_ref.trim(),
        payment_mode: form.payment_mode,
        amount_paid: amountPaid,
        estimated_total: form.estimated_total !== '' ? Number(form.estimated_total) : null,
        created_by: createdBy,
      })

      setSuccess(saved)
      if (form.payment_mode === 'quote_only') {
        navigate(`/admin/quote-requests/${saved.id}`, { replace: false })
      } else {
        navigate(`/admin/available-jobs/${saved.id}`, { replace: false })
      }
    } catch (err) {
      setError(err?.message || 'Could not save booking.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">New phone booking</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Create a booking while the customer is on the phone. You get a quote reference immediately —
            assign a driver from <strong>Available Jobs</strong> after payment, or follow up from{' '}
            <strong>Quote Requests</strong> if they have not paid yet.
          </p>
        </div>
        <Link
          to="/admin/quote-requests"
          className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
        >
          View quote requests
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2"
        >
          <h3 className="text-sm font-bold text-slate-900">Customer &amp; move</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="pb-name">
                Customer name <span className="text-red-600">*</span>
              </label>
              <input
                id="pb-name"
                className={inputClass}
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                required
                autoComplete="name"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="pb-phone">
                Phone <span className="text-red-600">*</span>
              </label>
              <input
                id="pb-phone"
                type="tel"
                className={inputClass}
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
                required
                autoComplete="tel"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="pb-email">
                Email
              </label>
              <input
                id="pb-email"
                type="email"
                className={inputClass}
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                placeholder="optional"
                autoComplete="email"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="pb-service">
                Service
              </label>
              <select
                id="pb-service"
                className={inputClass}
                value={form.service}
                onChange={(e) => setField('service', e.target.value)}
              >
                {SERVICE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="pb-pickup">
                Pickup address <span className="text-red-600">*</span>
              </label>
              <input
                id="pb-pickup"
                className={inputClass}
                value={form.pickup}
                onChange={(e) => setField('pickup', e.target.value)}
                required
                placeholder="Full address or postcode"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="pb-delivery">
                Delivery address <span className="text-red-600">*</span>
              </label>
              <input
                id="pb-delivery"
                className={inputClass}
                value={form.delivery}
                onChange={(e) => setField('delivery', e.target.value)}
                required
                placeholder="Full address or postcode"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="pb-move-date">
                Move date <span className="text-red-600">*</span>
              </label>
              <input
                id="pb-move-date"
                type="date"
                className={inputClass}
                value={form.move_date}
                onChange={(e) => setField('move_date', e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="pb-arrival">
                Preferred time
              </label>
              <input
                id="pb-arrival"
                type="time"
                className={inputClass}
                value={form.arrival_time}
                onChange={(e) => setField('arrival_time', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="pb-details">
              Notes (inventory, access, parking…)
            </label>
            <textarea
              id="pb-details"
              rows={4}
              className={`${inputClass} min-h-[100px] resize-y`}
              value={form.details}
              onChange={(e) => setField('details', e.target.value)}
              placeholder="What the customer told you on the phone"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="pb-ref">
              Quote reference <span className="font-normal normal-case text-slate-400">(optional)</span>
            </label>
            <input
              id="pb-ref"
              className={inputClass}
              value={form.quote_ref}
              onChange={(e) => setField('quote_ref', e.target.value)}
              placeholder="Leave blank to auto-generate SMH-2026-XXXXXX"
            />
          </div>

          <h3 className="border-t border-slate-100 pt-4 text-sm font-bold text-slate-900">Payment</h3>

          <fieldset className="space-y-2">
            <legend className="sr-only">Payment status</legend>
            {[
              {
                value: 'quote_only',
                title: 'Quote only — not paid yet',
                hint: 'Appears in Quote Requests. Send payment link or take payment later.',
              },
              {
                value: 'deposit',
                title: 'Deposit paid (phone / bank / cash)',
                hint: 'Goes to Available Jobs. Assign driver when ready.',
              },
              {
                value: 'paid_full',
                title: 'Paid in full (phone / bank / cash)',
                hint: 'Goes to Available Jobs immediately.',
              },
            ].map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${
                  form.payment_mode === opt.value
                    ? 'border-brand-500 bg-brand-50/80 ring-1 ring-brand-500/30'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="payment_mode"
                  value={opt.value}
                  checked={form.payment_mode === opt.value}
                  onChange={() => setField('payment_mode', opt.value)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{opt.title}</span>
                  <span className="block text-xs text-slate-600">{opt.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {form.payment_mode !== 'quote_only' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="pb-amount">
                  Amount paid (£) <span className="text-red-600">*</span>
                </label>
                <input
                  id="pb-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputClass}
                  value={form.amount_paid}
                  onChange={(e) => setField('amount_paid', e.target.value)}
                  placeholder="e.g. 150.00"
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="pb-estimate">
                  Estimated total (£)
                </label>
                <input
                  id="pb-estimate"
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputClass}
                  value={form.estimated_total}
                  onChange={(e) => setField('estimated_total', e.target.value)}
                  placeholder="optional"
                />
              </div>
            </div>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
              {error}
            </p>
          ) : null}

          {success ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">
              Saved <strong>{success.quote_ref}</strong>. Opening booking…
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-[48px] items-center rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-brand-600/20 hover:bg-brand-700 disabled:opacity-60"
            >
              {submitting ? 'Saving…' : 'Create booking'}
            </button>
            <button
              type="button"
              className="inline-flex min-h-[48px] items-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              onClick={() => setForm({ ...initialForm, move_date: getLocalDateYYYYMMDD() })}
            >
              Clear form
            </button>
          </div>
        </form>

        <aside className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-5 text-sm text-slate-700">
          <h3 className="font-bold text-slate-900">Workflow</h3>
          <ol className="list-decimal space-y-2 pl-4">
            <li>Fill in what the customer says on the phone.</li>
            <li>Choose payment — quote only, deposit, or paid in full.</li>
            <li>Save — you get an <code className="rounded bg-white px-1">SMH-…</code> reference.</li>
            <li>
              <strong>Paid / deposit:</strong> assign driver in Available Jobs.
            </li>
            <li>
              <strong>Quote only:</strong> call back or send them to the website quote wizard.
            </li>
          </ol>
          <p className="text-xs text-slate-500">
            For a full priced quote with inventory, use the public{' '}
            <a href="/quote" target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 underline">
              online calculator
            </a>{' '}
            or add items after creating the booking.
          </p>
        </aside>
      </div>
    </div>
  )
}
