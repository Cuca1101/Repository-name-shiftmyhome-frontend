import { useState } from 'react'
import AdminPhoneQuoteActions from './AdminPhoneQuoteActions'
import { useQuoteWizard } from '../quote-wizard/QuoteWizardContext'
import {
  collectAdminPhoneBookingFieldErrors,
  insertAdminPhoneBookingFromWizard,
  resolveAdminPhoneBookingFinalPrice,
  updateAdminPhoneBookingFromWizard,
} from '../../lib/adminPhoneBooking'
import { formatWizardArrivalSummary } from '../../lib/emailQuotePayload'
import { supabase } from '../../lib/supabase'

const inputClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25'
const labelClass = 'block text-xs font-semibold uppercase tracking-wide text-slate-500'

/**
 * Step 4 of the shared quote wizard when it is used for an admin phone booking.
 * Saving and preview never send email. Only the send button does.
 *
 * @param {{
 *   savedQuoteId: string | null,
 *   onSaved: (saved: { id: string, quote_ref: string }, meta: { updated: boolean }) => void,
 *   priceMode: { useCalculatedPrice: boolean, finalPriceOverride: string, overrideReason: string, adminNote: string },
 *   onPriceModeChange: (next: { useCalculatedPrice: boolean, finalPriceOverride: string, overrideReason: string, adminNote: string }) => void,
 *   onNewBooking: () => void,
 *   notice?: string,
 * }} props
 */
export default function AdminPhoneBookingFinish({
  savedQuoteId,
  onSaved,
  priceMode,
  onPriceModeChange,
  onNewBooking,
  notice = '',
}) {
  const { wizard, serviceType, quoteRef, breakdown, goToStep, setFeedback, back } = useQuoteWizard()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [actionsRefreshKey, setActionsRefreshKey] = useState(0)
  const price = resolveAdminPhoneBookingFinalPrice(breakdown, priceMode)
  const calculatedDisplay = price.calculated != null ? `£${price.calculated.toFixed(2)}` : '—'

  function patch(next) {
    onPriceModeChange({ ...priceMode, ...next })
  }

  async function saveDraft() {
    if (submitting) return null
    setError('')
    const errors = collectAdminPhoneBookingFieldErrors(wizard)
    if (errors.length) {
      setError(errors[0].message)
      setFeedback({ type: 'error', text: errors[0].message })
      goToStep(errors[0].step)
      return null
    }
    if (!breakdown) {
      setError('Pricing is not ready yet.')
      return null
    }
    if (price.invalid || (!priceMode.useCalculatedPrice && price.final == null)) {
      setError('Enter a valid final price, or use the calculated price.')
      return null
    }

    setSubmitting(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const createdBy = String(sessionData.session?.user?.email || '').trim() || 'admin'
      const payload = {
        wizard,
        serviceType,
        quoteRef,
        breakdown,
        useCalculatedPrice: priceMode.useCalculatedPrice,
        finalPrice: price.final,
        finalPriceOverride: priceMode.finalPriceOverride,
        overrideReason: priceMode.overrideReason,
        adminNote: priceMode.adminNote,
        createdBy,
      }
      const updated = Boolean(savedQuoteId)
      const saved = updated
        ? await updateAdminPhoneBookingFromWizard({ ...payload, quoteId: savedQuoteId })
        : await insertAdminPhoneBookingFromWizard(payload)
      onSaved(saved, { updated })
      setActionsRefreshKey((key) => key + 1)
      return saved
    } catch (err) {
      setError(err?.message || 'Could not save booking.')
      return null
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4" data-quote-step="4">
      <button
        type="button"
        onClick={back}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
      >
        <span aria-hidden>←</span>
        Back
      </button>
      {notice ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</p>
      ) : null}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900">Price</h3>
        <p className="mt-1 text-xs text-slate-600">Use the calculated total or set the price the customer will pay.</p>
        <div className="mt-4 space-y-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3">
            <input
              type="radio"
              name="admin-price-mode"
              checked={priceMode.useCalculatedPrice}
              onChange={() => patch({ useCalculatedPrice: true })}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">Use calculated price</span>
              <span className="block text-xs text-slate-600">{calculatedDisplay}</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3">
            <input
              type="radio"
              name="admin-price-mode"
              checked={!priceMode.useCalculatedPrice}
              onChange={() => patch({ useCalculatedPrice: false })}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">Custom final price</span>
              <span className="block text-xs text-slate-600">Original calculated: {calculatedDisplay}</span>
            </span>
          </label>
          {!priceMode.useCalculatedPrice ? (
            <>
              <div>
                <label className={labelClass} htmlFor="apb-final-price">
                  Final price (£)
                </label>
                <input
                  id="apb-final-price"
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputClass}
                  value={priceMode.finalPriceOverride}
                  onChange={(event) => patch({ finalPriceOverride: event.target.value })}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="apb-override-reason">
                  Discount / override reason
                </label>
                <input
                  id="apb-override-reason"
                  className={inputClass}
                  value={priceMode.overrideReason}
                  onChange={(event) => patch({ overrideReason: event.target.value })}
                />
              </div>
            </>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900">Internal note</h3>
        <textarea
          rows={3}
          className={`${inputClass} min-h-[80px] resize-y`}
          value={priceMode.adminNote}
          onChange={(event) => patch({ adminNote: event.target.value })}
          placeholder="Anything staff should know about this phone booking"
        />
      </section>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
          {error}
        </p>
      ) : null}

      <AdminPhoneQuoteActions
        savedQuoteId={savedQuoteId}
        saving={submitting}
        calculatedPrice={price.calculated}
        finalPrice={price.final}
        customerEmail={String(wizard.email || '')}
        moveDate={String(wizard.moveDate || '')}
        arrivalTime={formatWizardArrivalSummary(wizard)}
        onSaveDraft={saveDraft}
        refreshKey={actionsRefreshKey}
      />

      <button
        type="button"
        onClick={onNewBooking}
        className="text-sm font-semibold text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
      >
        New booking
      </button>
    </div>
  )
}
