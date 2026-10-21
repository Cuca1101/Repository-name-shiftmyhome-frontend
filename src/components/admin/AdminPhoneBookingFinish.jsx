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
import { formatDateTimeUK } from '../../lib/formatDateDisplay'
import { staffNameFromAuthUser } from '../../lib/phoneBookingAttribution'
import { supabase } from '../../lib/supabase'

const inputClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25'
const labelClass = 'block text-xs font-semibold uppercase tracking-wide text-slate-500'

function moneyLabel(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return ''
  return `£${n.toFixed(2)}`
}

/**
 * @param {{ attribution?: { quoteBy?: { name?: string, at?: string } | null, priceChanges?: Array<{ by?: string, at?: string, from?: number | null, to?: number | null, reason?: string }> } | null }} props
 */
function PhoneBookingPriceHistory({ attribution }) {
  const changes = Array.isArray(attribution?.priceChanges) ? [...attribution.priceChanges].reverse() : []
  const quoteBy = attribution?.quoteBy
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900">Price history</h3>
      <p className="mt-2 text-sm text-slate-700">
        Quote by: {quoteBy?.name || '—'}
        {quoteBy?.at ? ` · ${formatDateTimeUK(quoteBy.at)}` : ''}
      </p>
      {changes.length ? (
        <ul className="mt-3 space-y-3">
          {changes.map((change, index) => {
            const from = moneyLabel(change.from)
            const to = moneyLabel(change.to)
            return (
              <li key={`${change.at || 'change'}-${index}`} className="text-sm text-slate-700">
                <p>
                  Price updated by: {change.by || '—'}
                  {change.at ? ` · ${formatDateTimeUK(change.at)}` : ''}
                  {from && to ? ` · ${from} → ${to}` : ''}
                </p>
                {change.reason ? <p className="text-slate-500">Reason: {change.reason}</p> : null}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">No price changes yet.</p>
      )}
    </section>
  )
}

/**
 * Step 4 of the shared quote wizard when it is used for an admin phone booking.
 * Saving and preview never send email. Only the send button does.
 *
 * @param {{
 *   savedQuoteId: string | null,
 *   onSaved: (saved: { id: string, quote_ref: string }, meta: { updated: boolean }) => void,
 *   priceMode: { useCalculatedPrice: boolean, finalPriceOverride: string, overrideReason: string, adminNote: string },
 *   onPriceModeChange: (next: { useCalculatedPrice: boolean, finalPriceOverride: string, overrideReason: string, adminNote: string }) => void,
 *   attribution?: { quoteBy?: { name?: string, at?: string } | null, priceChanges?: Array<{ by?: string, at?: string, from?: number | null, to?: number | null, reason?: string }> } | null,
 *   onNewBooking: () => void,
 *   notice?: string,
 * }} props
 */
export default function AdminPhoneBookingFinish({
  savedQuoteId,
  onSaved,
  priceMode,
  onPriceModeChange,
  attribution = null,
  notice = '',
}) {
  const { wizard, serviceType, quoteRef, breakdown, goToStep, setFeedback, back } = useQuoteWizard()
  const [submitting, setSubmitting] = useState(false)
  const [busyAction, setBusyAction] = useState('')
  const [error, setError] = useState('')
  const [priceNotice, setPriceNotice] = useState('')
  const [actionsRefreshKey, setActionsRefreshKey] = useState(0)
  const price = resolveAdminPhoneBookingFinalPrice(breakdown, priceMode)
  const calculatedDisplay = price.calculated != null ? `£${price.calculated.toFixed(2)}` : '—'

  function patch(next) {
    setPriceNotice('')
    onPriceModeChange({ ...priceMode, ...next })
  }

  async function saveDraft({ closeAfter = false, applyPrice = false, silentNotice = false } = {}) {
    if (submitting) return null
    setError('')
    if (!applyPrice) setPriceNotice('')
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
    setBusyAction(applyPrice ? 'apply' : 'save')
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const createdBy = staffNameFromAuthUser(sessionData.session?.user)
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
      onSaved(saved, {
        updated,
        closeAfter,
        applyPrice,
        silentNotice,
        finalPrice: price.final,
        useCalculatedPrice: priceMode.useCalculatedPrice,
      })
      setActionsRefreshKey((key) => key + 1)
      return saved
    } catch (err) {
      setError(err?.message || 'Could not save booking.')
      return null
    } finally {
      setSubmitting(false)
      setBusyAction('')
    }
  }

  async function applyPrice() {
    setPriceNotice('')
    const saved = await saveDraft({ closeAfter: false, applyPrice: true })
    if (saved) setPriceNotice('Price updated successfully')
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
                  disabled={submitting}
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
                  disabled={submitting}
                  onChange={(event) => patch({ overrideReason: event.target.value })}
                />
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void applyPrice()}
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {busyAction === 'apply' ? 'Applying…' : 'Apply Price'}
              </button>
              {priceNotice ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">
                  {priceNotice}
                </p>
              ) : null}
              <p className="text-xs text-slate-500">
                Saves this price and reason on the same quote. It does not send an email.
              </p>
            </>
          ) : null}
        </div>
      </section>

      <PhoneBookingPriceHistory attribution={attribution} />

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

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900">Save</h3>
        <p className="mt-1 text-xs text-slate-600">
          Save puts this quote in My saved quotes and closes the form. Open it again from the list when you want.
          Nothing is emailed until you press Send Quote to Customer.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            disabled={submitting}
            onClick={() => void saveDraft({ closeAfter: true })}
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busyAction === 'save' ? 'Saving…' : 'Save'}
          </button>
        </div>
      </section>

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

    </div>
  )
}
