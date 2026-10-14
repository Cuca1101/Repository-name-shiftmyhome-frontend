import { useCallback, useEffect, useState } from 'react'
import { fetchQuoteByIdForAdmin } from '../../lib/data/quotesAdminRepository'
import { previewPhoneQuoteEmail, sendPhoneQuoteEmail } from '../../lib/phoneQuoteApi'
import { phoneQuoteAdminStatus, phoneQuoteFinalTotal } from '../../lib/phoneQuotePaymentRules'
import { formatDateTimeUK } from '../../lib/formatDateDisplay'
import PhoneQuoteStatusBadge from './PhoneQuoteStatusBadge'

function gbp(n) {
  const v = Number(n)
  return n == null || n === '' || !Number.isFinite(v) ? '—' : `£${v.toFixed(2)}`
}

const btnBase =
  'inline-flex min-h-[48px] items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50'

/**
 * Save draft / Preview quote / Send quote by email for a phone booking.
 * Saving never sends email; only "Send quote by email" does.
 *
 * @param {{
 *   savedQuoteId: string | null,
 *   saving: boolean,
 *   disabled?: boolean,
 *   calculatedPrice: number | null,
 *   finalPrice: number | null,
 *   customerEmail: string,
 *   onSaveDraft: () => Promise<{ id: string, quote_ref: string } | null>,
 *   refreshKey?: number,
 * }} props
 */
export default function AdminPhoneQuoteActions({
  savedQuoteId,
  saving,
  disabled = false,
  calculatedPrice,
  finalPrice,
  customerEmail,
  onSaveDraft,
  refreshKey = 0,
}) {
  const [row, setRow] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [preview, setPreview] = useState(null)

  const loadRow = useCallback(async (id) => {
    if (!id) {
      setRow(null)
      return null
    }
    try {
      const r = await fetchQuoteByIdForAdmin(id)
      setRow(r || null)
      return r || null
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    void loadRow(savedQuoteId)
  }, [savedQuoteId, refreshKey, loadRow])

  useEffect(() => {
    if (!preview) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setPreview(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [preview])

  const status = row ? phoneQuoteAdminStatus(row) : { key: 'draft', label: 'Not saved yet' }
  const savedFinal = row ? phoneQuoteFinalTotal(row) : null
  const sentTotal = row?.quote_sent_total != null ? Number(row.quote_sent_total) : null
  const priceChangedSinceSent =
    row?.quote_sent_at && sentTotal != null && savedFinal != null && Math.abs(sentTotal - savedFinal) > 0.009
  const customerPaid = status.key === 'deposit_paid' || status.key === 'paid_in_full'
  const emailOk = /.+@.+\..+/.test(String(customerEmail || '').trim())

  async function saveFirst() {
    const saved = await onSaveDraft()
    if (!saved?.id) return null
    await loadRow(saved.id)
    return saved
  }

  async function handleSave() {
    setError('')
    setNotice('')
    setBusy('save')
    try {
      const saved = await saveFirst()
      if (saved) setNotice(`Draft ${saved.quote_ref} saved. No email was sent.`)
    } finally {
      setBusy('')
    }
  }

  async function handlePreview() {
    setError('')
    setNotice('')
    setBusy('preview')
    try {
      const saved = await saveFirst()
      if (!saved) return
      const res = await previewPhoneQuoteEmail(saved.id)
      setPreview(res)
    } catch (e) {
      setError(e?.message || 'Could not build the preview.')
    } finally {
      setBusy('')
    }
  }

  async function handleSend() {
    setError('')
    setNotice('')
    if (!emailOk) {
      setError('Add a valid customer email in step 2 before sending the quote.')
      return
    }
    setBusy('send')
    try {
      const saved = await saveFirst()
      if (!saved) return
      const fresh = await loadRow(saved.id)
      const total = fresh ? phoneQuoteFinalTotal(fresh) : finalPrice
      const again = fresh?.quote_sent_at ? ' again' : ''
      if (!window.confirm(`Send quote ${saved.quote_ref} (${gbp(total)}) to ${customerEmail.trim()}${again}?`)) return
      const res = await sendPhoneQuoteEmail(saved.id)
      await loadRow(saved.id)
      setPreview(null)
      setNotice(`Quote sent to ${res.to} at ${formatDateTimeUK(res.sent_at)}.`)
    } catch (e) {
      setError(e?.message || 'Could not send the quote.')
    } finally {
      setBusy('')
    }
  }

  const working = Boolean(busy) || saving
  const payUrl = preview?.pay_url || ''

  return (
    <section
      className="rounded-2xl border border-brand-200 bg-white p-5 shadow-sm ring-1 ring-brand-100/60 sm:p-6"
      aria-label="Quote actions"
      data-testid="phone-quote-actions"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <h3 className="text-sm font-bold text-slate-900">Quote &amp; email</h3>
        {row ? <PhoneQuoteStatusBadge q={row} /> : <span className="text-xs text-slate-500">{status.label}</span>}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Calculated</dt>
          <dd className="mt-0.5 font-bold tabular-nums text-slate-900">{gbp(calculatedPrice)}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Final (customer pays)</dt>
          <dd className="mt-0.5 font-bold tabular-nums text-emerald-700">{gbp(finalPrice)}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Paid</dt>
          <dd className="mt-0.5 font-bold tabular-nums text-slate-900">{gbp(row?.amount_paid ?? 0)}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Balance</dt>
          <dd className="mt-0.5 font-bold tabular-nums text-slate-900">
            {gbp(row?.remaining_balance ?? finalPrice)}
          </dd>
        </div>
      </dl>

      {row?.quote_sent_at ? (
        <p className="mt-3 text-xs text-slate-600">
          Last sent {formatDateTimeUK(row.quote_sent_at)}
          {sentTotal != null ? ` · ${gbp(sentTotal)}` : ''}
          {row.quote_sent_count > 1 ? ` · sent ${row.quote_sent_count} times` : ''}
        </p>
      ) : null}
      {savedFinal != null && finalPrice != null && Math.abs(savedFinal - finalPrice) > 0.009 ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Unsaved price change: saved {gbp(savedFinal)}, now {gbp(finalPrice)}. Save the draft to keep it.
        </p>
      ) : null}
      {priceChangedSinceSent ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          The price changed after the quote was sent ({gbp(sentTotal)} → {gbp(savedFinal)}). The customer link already
          shows the new price; send the quote again so the email matches.
        </p>
      ) : null}
      {customerPaid ? (
        <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          The customer has paid. The price is locked and the quote cannot be sent again.
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">
          {notice}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={working || disabled}
          className={`${btnBase} border border-slate-300 bg-white text-slate-900 hover:bg-slate-50`}
        >
          {busy === 'save' || (saving && !busy) ? 'Saving…' : 'Save draft'}
        </button>
        <button
          type="button"
          onClick={() => void handlePreview()}
          disabled={working || disabled}
          className={`${btnBase} border border-brand-200 bg-brand-50 text-brand-800 hover:bg-brand-100`}
        >
          {busy === 'preview' ? 'Building preview…' : 'Preview quote'}
        </button>
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={working || disabled || customerPaid}
          className={`${btnBase} bg-brand-600 font-bold text-white shadow-md hover:bg-brand-700`}
        >
          {busy === 'send' ? 'Sending…' : row?.quote_sent_at ? 'Send quote again' : 'Send quote by email'}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Save draft and Preview never email the customer. Only “Send quote by email” does.
      </p>

      {preview ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/60 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Quote email preview"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreview(null)
          }}
        >
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview — not sent</p>
                <p className="mt-0.5 break-words text-sm font-bold text-slate-900">{preview.subject}</p>
                <p className="mt-0.5 break-words text-xs text-slate-600">To: {preview.to || 'no email on file'}</p>
                {payUrl ? (
                  <p className="mt-1 break-all text-xs text-slate-600">
                    Customer link:{' '}
                    <a href={payUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 underline">
                      {payUrl}
                    </a>
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            <iframe
              title="Quote email preview"
              srcDoc={preview.html}
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              className="h-[70vh] w-full flex-1 border-0 bg-slate-50"
            />
            <div className="flex flex-col gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPreview(null)}
                className={`${btnBase} border border-slate-300 bg-white text-slate-900 hover:bg-slate-50`}
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={working || customerPaid}
                className={`${btnBase} bg-brand-600 font-bold text-white hover:bg-brand-700`}
              >
                {busy === 'send' ? 'Sending…' : 'Send quote by email'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
