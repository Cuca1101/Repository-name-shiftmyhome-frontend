import { useCallback, useEffect, useState } from 'react'
import { formatDateTimeUK } from '../../lib/formatDateDisplay'
import {
  buildJobTrackingUrl,
  copyTextToClipboard,
  drainJobCustomerNotifyQueue,
  ensureJobTrackingToken,
  fetchJobCustomerNotifications,
  fetchJobTrackingTokenRow,
  sendJobCustomerNotify,
} from '../../lib/jobCustomerTracking'
import { isDriverLocationStale } from '../../lib/data/driverLivePositionsRepository'
import { GOOGLE_LEAVE_REVIEW_URL } from '../../lib/reviews/externalReviews'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import AdminJobEmailsSentPanel from './AdminJobEmailsSentPanel'

/**
 * Admin: customer communication / tracking + completion follow-up for a booking.
 * @param {{ quote: Record<string, unknown>, onRefresh?: () => void }} props
 */
export default function AdminJobCustomerComms({ quote, onRefresh }) {
  const quoteId = String(quote?.id || '').trim()
  const [tokenRow, setTokenRow] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [tips, setTips] = useState([])
  const [googleReviewUrl, setGoogleReviewUrl] = useState(GOOGLE_LEAVE_REVIEW_URL)
  const [driverLoc, setDriverLoc] = useState(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState('')

  const paid =
    String(quote?.payment_status || '').toLowerCase() === 'paid' ||
    String(quote?.payment_status || '').toLowerCase() === 'deposit_paid'

  const isCompleted =
    String(quote?.operational_status || '').toLowerCase() === 'completed' ||
    String(quote?.status || '').toLowerCase() === 'completed' ||
    Boolean(quote?.completed_at)

  const completionSent = Boolean(quote?.completion_email_sent) ||
    notifications.some(
      (n) => n.event_key === 'status_completed' && String(n.delivery_status || '') === 'sent',
    )
  const completionSentAt =
    quote?.completion_email_sent_at ||
    notifications.find((n) => n.event_key === 'status_completed' && n.sent_at)?.sent_at ||
    null

  const tipPaidTotal = Number(quote?.tip_total_gbp) || 0
  const tipConfigured = Boolean(String(googleReviewUrl || '').trim())

  const load = useCallback(async () => {
    if (!quoteId || !isSupabaseConfigured) return
    const [tok, notes] = await Promise.all([
      fetchJobTrackingTokenRow(quoteId),
      fetchJobCustomerNotifications(quoteId),
    ])
    setTokenRow(tok)
    setNotifications(notes)

    if (supabase) {
      const { data: tipRows } = await supabase
        .from('job_tips')
        .select('id, amount_gbp, status, paid_at, created_at, driver_id, customer_email')
        .eq('quote_id', quoteId)
        .order('created_at', { ascending: false })
      setTips(tipRows || [])

      const { data: settings } = await supabase
        .from('website_settings')
        .select('ops')
        .eq('id', 'default')
        .maybeSingle()
      const fromOps = String(settings?.ops?.google_review_url || '').trim()
      if (fromOps) setGoogleReviewUrl(fromOps)
    }

    const driverId = String(quote?.assigned_driver_id || '').trim()
    if (driverId && supabase) {
      const { data } = await supabase
        .from('driver_locations')
        .select('updated_at, latitude, longitude, status')
        .eq('driver_id', driverId)
        .maybeSingle()
      setDriverLoc(data)
    } else {
      setDriverLoc(null)
    }
  }, [quoteId, quote?.assigned_driver_id])

  useEffect(() => {
    void load()
  }, [load])

  // Opportunistic drain: driver completions enqueue emails that need processing without cron.
  useEffect(() => {
    if (!quoteId || !isSupabaseConfigured) return
    void drainJobCustomerNotifyQueue()
      .then(() => load())
      .catch(() => {})
  }, [quoteId, load])

  async function ensureLink() {
    setBusy('token')
    setMsg('')
    try {
      const token = await ensureJobTrackingToken(quoteId)
      setMsg('Tracking link ready.')
      await load()
      return token
    } catch (e) {
      setMsg(e?.message || 'Failed')
      return null
    } finally {
      setBusy('')
    }
  }

  async function copyLink() {
    setBusy('copy')
    setMsg('')
    try {
      let token = tokenRow?.token
      if (!token) token = await ensureJobTrackingToken(quoteId)
      await copyTextToClipboard(buildJobTrackingUrl(String(token)))
      setMsg('Tracking link copied.')
      await load()
    } catch (e) {
      setMsg(e?.message || 'Copy failed')
    } finally {
      setBusy('')
    }
  }

  async function resend(eventKey, label, { requirePaid = true, confirm = false } = {}) {
    setBusy(eventKey)
    setMsg('')
    try {
      if (requirePaid && !paid) throw new Error('Booking must be paid before sending customer emails.')
      if (confirm) {
        const ok = window.confirm(
          `Resend “${label}” to the customer?\n\nOnly resend if needed — customers can receive duplicate emails.`,
        )
        if (!ok) return
      }
      await sendJobCustomerNotify(quoteId, eventKey, { force: true })
      setMsg(`${label} sent.`)
      await load()
      onRefresh?.()
    } catch (e) {
      setMsg(e?.message || 'Send failed')
    } finally {
      setBusy('')
    }
  }

  const trackingUrl = tokenRow?.token ? buildJobTrackingUrl(tokenRow.token) : null
  const locStale = isDriverLocationStale(driverLoc?.updated_at)

  return (
    <div className="space-y-4">
      {!paid ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Live tracking emails (driver assigned / on the way) send after card payment. Completion
          thank-you emails also send for unpaid phone bookings when the job is marked Completed.
        </p>
      ) : null}

      {isCompleted ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
          <h4 className="text-sm font-bold text-emerald-950">Completion Follow-up</h4>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase text-emerald-800/80">Completion email</dt>
              <dd className="font-semibold text-emerald-950">
                {completionSent ? 'Sent ✓' : 'Not sent yet'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-emerald-800/80">Sent</dt>
              <dd className="font-medium text-emerald-950">
                {completionSentAt ? formatDateTimeUK(completionSentAt) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-emerald-800/80">Google Review link</dt>
              <dd className="font-semibold text-emerald-950">
                {tipConfigured ? 'Configured ✓' : 'Missing'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-emerald-800/80">Tip received</dt>
              <dd className="font-semibold text-emerald-950">
                {tipPaidTotal > 0 ? `£${tipPaidTotal.toFixed(2)} ✓` : 'None yet'}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase text-emerald-800/80">Crew / driver</dt>
              <dd className="font-medium text-emerald-950">{quote?.assigned_driver_name || '—'}</dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() =>
                void resend('status_completed', 'Completion thank-you email', {
                  requirePaid: false,
                  confirm: true,
                })
              }
              className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-950 disabled:opacity-50"
            >
              {busy === 'status_completed' ? 'Sending…' : 'Resend Completion Email'}
            </button>
            {googleReviewUrl ? (
              <a
                href={googleReviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
              >
                Open Google Review link
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Assigned driver</p>
          <p className="font-medium text-slate-900">{quote?.assigned_driver_name || '—'}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Last GPS update</p>
          <p className="font-medium text-slate-900">
            {driverLoc?.updated_at
              ? `${formatDateTimeUK(driverLoc.updated_at)}${locStale ? ' (stale)' : ''}`
              : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Feedback</p>
          <p className="font-medium text-slate-900">
            {quote?.customer_feedback_submitted_at
              ? `${quote.customer_feedback_rating || '—'}★ · ${formatDateTimeUK(quote.customer_feedback_submitted_at)}`
              : 'Not submitted'}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Tips (rollup)</p>
          <p className="font-medium text-slate-900">
            {tipPaidTotal > 0 ? `£${tipPaidTotal.toFixed(2)} paid` : 'None'}
          </p>
        </div>
      </div>

      {tips.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Tip payments</p>
          <ul className="space-y-2 text-sm">
            {tips.map((t) => (
              <li key={t.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="font-medium text-slate-900">
                  £{Number(t.amount_gbp || 0).toFixed(2)} · {String(t.status || 'pending')}
                </div>
                <div className="text-xs text-slate-600">
                  {t.paid_at
                    ? `Paid ${formatDateTimeUK(t.paid_at)}`
                    : `Created ${formatDateTimeUK(t.created_at)}`}
                  {quote?.assigned_driver_name ? ` · Crew: ${quote.assigned_driver_name}` : ''}
                  {t.customer_email ? ` · ${t.customer_email}` : ''}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <p className="text-xs font-semibold uppercase text-slate-500">Tracking link</p>
        <p className="mt-1 break-all font-mono text-xs text-slate-700">{trackingUrl || 'Not created yet'}</p>
        {tokenRow?.revoked_at ? (
          <p className="mt-1 text-xs text-red-700">Revoked {formatDateTimeUK(tokenRow.revoked_at)}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void copyLink()}
          className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          Copy tracking link
        </button>
        <button
          type="button"
          disabled={Boolean(busy) || !paid}
          onClick={() => void resend('driver_assigned', 'Driver details email')}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 disabled:opacity-50"
        >
          Resend driver details
        </button>
        <button
          type="button"
          disabled={Boolean(busy) || !paid}
          onClick={() => void resend('status_on_way', 'Tracking email')}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 disabled:opacity-50"
        >
          Resend tracking email
        </button>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void ensureLink()}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 disabled:opacity-50"
        >
          Ensure token
        </button>
      </div>

      {msg ? <p className="text-sm text-slate-700">{msg}</p> : null}

      <AdminJobEmailsSentPanel quoteId={quoteId} refreshKey={notifications.length} />
    </div>
  )
}
