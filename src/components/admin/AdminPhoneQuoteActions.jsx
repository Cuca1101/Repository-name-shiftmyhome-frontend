import { useCallback, useEffect, useRef, useState } from 'react'
import { notifyAdminDataRefresh } from '../../lib/adminDataRefresh'
import { fetchQuoteByIdForAdmin } from '../../lib/data/quotesAdminRepository'
import { previewPhoneQuoteEmail, sendPhoneQuoteEmail } from '../../lib/phoneQuoteApi'
import { PHONE_QUOTE_DEPOSIT_GBP, phoneQuoteAdminStatus, phoneQuoteFinalTotal, phoneQuotePaymentOptions } from '../../lib/phoneQuotePaymentRules'
import { formatDateTimeUK } from '../../lib/formatDateDisplay'
import { supabase } from '../../lib/supabase'
import EmailPreviewDialog from './EmailPreviewDialog'
import PhoneQuoteStatusBadge, { QuoteEmailSentBadge } from './PhoneQuoteStatusBadge'

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
 *   moveDate?: string,
 *   arrivalTime?: string,
 *   onSaveDraft: (options?: { silentNotice?: boolean }) => Promise<{ id: string, quote_ref: string } | null>,
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
  moveDate = '',
  arrivalTime = '',
  onSaveDraft,
  refreshKey = 0,
}) {
  const [row, setRow] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [preview, setPreview] = useState(null)
  const [sentEmails, setSentEmails] = useState([])
  const sendLock = useRef(false)

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

  const loadSentEmails = useCallback(async (id) => {
    if (!id || !supabase) {
      setSentEmails([])
      return
    }
    const { data, error: archiveError } = await supabase
      .from('customer_email_archive')
      .select('id, subject, recipient_email, html_snapshot, sent_at, event_key')
      .eq('quote_id', id)
      .order('sent_at', { ascending: false })
    if (archiveError) {
      setSentEmails([])
      return
    }
    setSentEmails(data || [])
  }, [])

  useEffect(() => {
    void loadRow(savedQuoteId)
    void loadSentEmails(savedQuoteId)
  }, [savedQuoteId, refreshKey, loadRow, loadSentEmails])

  const latestQuoteEmail = sentEmails.find((item) => item.event_key === 'phone_quote_sent') || null
  const sentRecipient = String(latestQuoteEmail?.recipient_email || row?.email || '').trim()
  const status = row ? phoneQuoteAdminStatus(row) : { key: 'draft', label: 'Not saved yet' }
  const savedFinal = row ? phoneQuoteFinalTotal(row) : null
  const sentTotal = row?.quote_sent_total != null ? Number(row.quote_sent_total) : null
  const priceChangedSinceSent =
    row?.quote_sent_at && sentTotal != null && savedFinal != null && Math.abs(sentTotal - savedFinal) > 0.009
  const customerPaid = status.key === 'deposit_paid' || status.key === 'paid_in_full'
  const emailOk = /.+@.+\..+/.test(String(customerEmail || '').trim())

  async function saveFirst(options) {
    const saved = await onSaveDraft(options)
    if (!saved?.id) return null
    await loadRow(saved.id)
    return saved
  }

  async function handleSave() {
    setError('')
    setNotice('')
    setBusy('save')
    try {
      const saved = await saveFirst({ silentNotice: true })
      if (saved) setNotice(`Draft ${saved.quote_ref} saved. No email was sent.`)
    } finally {
      setBusy('')
    }
  }

  function openOriginalEmail(item) {
    const html = String(item.html_snapshot || '')
    setPreview({
      original: true,
      subject: item.subject,
      html,
      missingHtml: !html.trim(),
      to: item.recipient_email,
      sent_at: item.sent_at,
    })
  }

  async function handlePreview(paymentType) {
    setError('')
    setNotice('')
    setBusy(`preview-${paymentType}`)
    try {
      const saved = await saveFirst({ silentNotice: true })
      if (!saved) return
      const res = await previewPhoneQuoteEmail(saved.id, paymentType)
      setPreview({ ...res, original: false, paymentType })
    } catch (e) {
      setError(e?.message || 'Could not build the preview.')
    } finally {
      setBusy('')
    }
  }

  async function handleSend(paymentType) {
    setError('')
    setNotice('')
    if (!emailOk) {
      setError('Add a valid customer email in step 2 before sending the quote.')
      return
    }
    setBusy(`send-${paymentType}`)
    try {
      const saved = await saveFirst({ silentNotice: true })
      if (!saved) return
      const fresh = await loadRow(saved.id)
      const total = fresh ? phoneQuoteFinalTotal(fresh) : finalPrice
      const linkLabel = paymentType === 'deposit' ? `£${PHONE_QUOTE_DEPOSIT_GBP} deposit link` : 'full payment link'
      const again = fresh?.quote_sent_at ? ' again' : ''
      if (!window.confirm(`Send the ${linkLabel} for ${saved.quote_ref} (${gbp(total)}) to ${customerEmail.trim()}${again}?`)) {
        return
      }
      const res = await sendPhoneQuoteEmail(saved.id, paymentType)
      await loadRow(saved.id)
      await loadSentEmails(saved.id)
      notifyAdminDataRefresh({ source: 'phone_quote_email_sent' })
      setPreview(null)
      setNotice(`${paymentType === 'deposit' ? 'Deposit' : 'Full payment'} link sent to ${res.to} at ${formatDateTimeUK(res.sent_at)}.`)
    } catch (e) {
      setError(e?.message || 'Could not send the quote.')
    } finally {
      setBusy('')
    }
  }

  async function handleSendQuote() {
    if (sendLock.current || saving || customerPaid) return
    setError('')
    setNotice('')
    if (!emailOk) {
      setError('Add a valid customer email in step 2 before sending the quote.')
      return
    }
    sendLock.current = true
    setBusy('send-quote')
    try {
      let saved = null
      try {
        saved = await saveFirst({ silentNotice: true })
      } catch (e) {
        setError(e?.message || 'The quote could not be saved, so the email was not sent.')
        return
      }
      if (!saved) {
        setError('The quote could not be saved, so the email was not sent.')
        return
      }
      try {
        const res = await sendPhoneQuoteEmail(saved.id)
        await loadRow(saved.id)
        await loadSentEmails(saved.id)
        notifyAdminDataRefresh({ source: 'phone_quote_email_sent' })
        setPreview(null)
        const to = String(res.to || customerEmail || '').trim()
        setNotice(`Quote saved and sent successfully to ${to}.`)
      } catch {
        await loadSentEmails(saved.id)
        setError('Quote saved, but the email could not be sent. Please try again.')
      }
    } finally {
      sendLock.current = false
      setBusy('')
    }
  }

  const working = Boolean(busy) || saving
  const paymentOptions = phoneQuotePaymentOptions({
    moveDate: moveDate || row?.move_date,
    arrivalTime: arrivalTime || row?.arrival_time || row?.arrival_window,
    total: finalPrice,
    amountPaid: row?.amount_paid,
    paymentStatus: row?.payment_status,
  })
  const depositReason = paymentOptions.depositAllowed
    ? ''
    : paymentOptions.alreadyPaid
      ? 'This quote is already paid.'
      : 'A £50 deposit is only available when the total is more than £50.'

  return (
    <section
      className="rounded-2xl border border-brand-200 bg-white p-5 shadow-sm ring-1 ring-brand-100/60 sm:p-6"
      aria-label="Quote actions"
      data-testid="phone-quote-actions"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <h3 className="text-sm font-bold text-slate-900">Quote &amp; email</h3>
        <span className="flex flex-wrap items-center gap-2">
          {row ? <PhoneQuoteStatusBadge q={row} /> : <span className="text-xs text-slate-500">{status.label}</span>}
          <QuoteEmailSentBadge sentAt={row?.quote_sent_at} recipient={sentRecipient} />
        </span>
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
          {sentRecipient ? ` to ${sentRecipient}` : ''}
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

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={working || disabled}
          className={`${btnBase} border border-slate-300 bg-white text-slate-900 hover:bg-slate-50`}
        >
          {busy === 'save' || (saving && !busy) ? 'Saving…' : 'Save Changes'}
        </button>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => void handlePreview('full')}
            disabled={working || disabled}
            className={`${btnBase} border border-brand-200 bg-brand-50 text-brand-800 hover:bg-brand-100`}
          >
            {busy === 'preview-full' ? 'Building preview…' : 'Preview full payment'}
          </button>
          <button
            type="button"
            onClick={() => void handleSend('full')}
            disabled={working || disabled || customerPaid}
            className={`${btnBase} bg-brand-600 font-bold text-white shadow-md hover:bg-brand-700`}
          >
            {busy === 'send-full' ? 'Sending…' : 'Send full payment link'}
          </button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => void handlePreview('deposit')}
            disabled={working || disabled || !paymentOptions.depositAllowed}
            title={depositReason}
            className={`${btnBase} border border-brand-200 bg-brand-50 text-brand-800 hover:bg-brand-100`}
          >
            {busy === 'preview-deposit' ? 'Building preview…' : `Preview £${PHONE_QUOTE_DEPOSIT_GBP} deposit`}
          </button>
          <button
            type="button"
            onClick={() => void handleSend('deposit')}
            disabled={working || disabled || customerPaid || !paymentOptions.depositAllowed}
            title={depositReason}
            className={`${btnBase} bg-slate-900 font-bold text-white shadow-md hover:bg-slate-800`}
          >
            {busy === 'send-deposit' ? 'Sending…' : `Send £${PHONE_QUOTE_DEPOSIT_GBP} deposit link`}
          </button>
        </div>
        <button
          type="button"
          onClick={() => void handleSendQuote()}
          disabled={working || disabled || customerPaid || sendLock.current}
          className={`${btnBase} min-h-14 w-full bg-emerald-600 text-base font-bold text-white shadow-md hover:bg-emerald-700`}
        >
          {busy === 'send-quote' ? 'Sending…' : 'Send Quote to Customer'}
        </button>
      </div>
      {depositReason ? <p className="mt-2 text-xs text-slate-500">{depositReason}</p> : null}
      <p className="mt-2 text-xs text-slate-500">
        Save Changes updates this quote and does not send an email. Send full payment link and Send £50 deposit link
        each send that one option. Send Quote to Customer saves this quote, then sends one email with both Pay £50
        Deposit and Pay in Full.
      </p>
      {sentEmails.length ? (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Emails already sent</h4>
          <ul className="mt-2 space-y-2">
            {sentEmails.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="min-w-0 text-slate-700">
                  {formatDateTimeUK(item.sent_at)} · {item.subject}
                </span>
                <button
                  type="button"
                  onClick={() => openOriginalEmail(item)}
                  className="text-sm font-semibold text-brand-700 underline-offset-2 hover:underline"
                >
                  View sent email
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {preview ? (
        <EmailPreviewDialog
          kicker={preview.original ? `Email sent ${formatDateTimeUK(preview.sent_at)} — original copy` : 'Preview — not sent'}
          subject={preview.subject}
          to={preview.to || ''}
          html={preview.html}
          missingMessage={preview.missingHtml ? 'The original email was not stored, so it cannot be shown.' : ''}
          repairLogo={!preview.original}
          onClose={() => setPreview(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                Close
              </button>
              {preview.original ? null : (
                <button
                  type="button"
                  onClick={() => void handleSend(preview.paymentType === 'deposit' ? 'deposit' : 'full')}
                  disabled={working || customerPaid}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-brand-600 px-3 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {busy.startsWith('send') ? 'Sending…' : preview.paymentType === 'deposit' ? `Send £${PHONE_QUOTE_DEPOSIT_GBP} deposit link` : 'Send full payment link'}
                </button>
              )}
            </>
          }
        />
      ) : null}
    </section>
  )
}
