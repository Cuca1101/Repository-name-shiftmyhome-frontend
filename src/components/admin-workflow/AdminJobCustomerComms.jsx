import { useCallback, useEffect, useState } from 'react'
import { formatDateTimeUK } from '../../lib/formatDateDisplay'
import {
  buildJobTrackingUrl,
  copyTextToClipboard,
  ensureJobTrackingToken,
  fetchJobCustomerNotifications,
  fetchJobTrackingTokenRow,
  sendJobCustomerNotify,
} from '../../lib/jobCustomerTracking'
import { isDriverLocationStale } from '../../lib/data/driverLivePositionsRepository'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'

/**
 * Admin: customer communication / tracking for a paid booking.
 * @param {{ quote: Record<string, unknown>, onRefresh?: () => void }} props
 */
export default function AdminJobCustomerComms({ quote, onRefresh }) {
  const quoteId = String(quote?.id || '').trim()
  const [tokenRow, setTokenRow] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [driverLoc, setDriverLoc] = useState(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState('')

  const paid =
    String(quote?.payment_status || '').toLowerCase() === 'paid' ||
    String(quote?.payment_status || '').toLowerCase() === 'deposit_paid'

  const load = useCallback(async () => {
    if (!quoteId || !isSupabaseConfigured) return
    const [tok, notes] = await Promise.all([
      fetchJobTrackingTokenRow(quoteId),
      fetchJobCustomerNotifications(quoteId),
    ])
    setTokenRow(tok)
    setNotifications(notes)

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

  async function resend(eventKey, label) {
    setBusy(eventKey)
    setMsg('')
    try {
      if (!paid) throw new Error('Booking must be paid before sending customer emails.')
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
          Customer tracking emails send only after payment is confirmed.
        </p>
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
          <p className="text-xs font-semibold uppercase text-slate-500">Tips</p>
          <p className="font-medium text-slate-900">
            {Number(quote?.tip_total_gbp) > 0
              ? `£${Number(quote.tip_total_gbp).toFixed(2)} paid`
              : 'None'}
          </p>
        </div>
      </div>

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
          disabled={Boolean(busy) || !paid}
          onClick={() => void resend('status_completed', 'Job completed email')}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 disabled:opacity-50"
        >
          Resend job completed
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

      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Notification history</p>
        {notifications.length === 0 ? (
          <p className="text-sm text-slate-600">No outbound customer emails logged yet.</p>
        ) : (
          <ul className="max-h-56 space-y-2 overflow-auto text-sm">
            {notifications.map((n) => (
              <li key={n.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="font-medium text-slate-900">{n.event_label || n.event_key}</div>
                <div className="text-xs text-slate-600">
                  {formatDateTimeUK(n.sent_at)} · {n.delivery_status || 'sent'}
                  {n.recipient_email ? ` · ${n.recipient_email}` : ''}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
