import { useCallback, useEffect, useState } from 'react'
import { formatDateTimeUK } from '../../lib/formatDateDisplay'
import {
  fetchCustomerLeadNotifications,
  fetchJobCustomerNotifications,
} from '../../lib/jobCustomerTracking'
import { isSupabaseConfigured } from '../../lib/supabase'

const EVENT_LABELS = {
  driver_assigned: 'Driver assigned',
  driver_reassigned: 'Driver reassigned',
  status_on_way: 'Driver on the way',
  status_arrived_pickup: 'Arrived at pickup',
  status_pickup_completed: 'Pickup completed',
  status_in_transit: 'On the way to delivery',
  status_arrived_delivery: 'Arrived at delivery',
  status_completed: 'Completion thank-you',
  tip_received: 'Tip received confirmation',
  admin_booking_confirmed: 'Admin: new booking confirmed',
  admin_abandoned_quote: 'Admin: abandoned quote',
}

function statusTone(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'sent') return 'bg-emerald-50 text-emerald-800 ring-emerald-200'
  if (s === 'failed' || s === 'error') return 'bg-red-50 text-red-800 ring-red-200'
  if (s === 'pending') return 'bg-amber-50 text-amber-900 ring-amber-200'
  return 'bg-slate-100 text-slate-700 ring-slate-200'
}

/**
 * Read-only Email History for a booking (quote) and/or customer lead.
 * @param {{ quoteId?: string, customerLeadId?: string, compact?: boolean, refreshKey?: number|string }} props
 */
export default function AdminJobEmailsSentPanel({
  quoteId,
  customerLeadId,
  compact = false,
  refreshKey = 0,
}) {
  const qid = String(quoteId || '').trim()
  const lid = String(customerLeadId || '').trim()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if ((!qid && !lid) || !isSupabaseConfigured) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const [jobRows, leadRows] = await Promise.all([
        qid ? fetchJobCustomerNotifications(qid) : Promise.resolve([]),
        lid ? fetchCustomerLeadNotifications(lid) : Promise.resolve([]),
      ])
      const merged = [...(Array.isArray(jobRows) ? jobRows : []), ...(Array.isArray(leadRows) ? leadRows : [])]
      merged.sort((a, b) => {
        const ta = new Date(a?.sent_at || a?.created_at || 0).getTime()
        const tb = new Date(b?.sent_at || b?.created_at || 0).getTime()
        return tb - ta
      })
      setRows(merged)
    } catch (e) {
      setError(e?.message || 'Could not load emails.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [qid, lid])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  if (!qid && !lid) return null

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Email History
          {!loading ? (
            <span className="ml-2 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold normal-case text-slate-600">
              {rows.length}
            </span>
          ) : null}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="text-xs font-semibold text-brand-700 hover:underline"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading emails…</p>
      ) : error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
          No emails logged yet.
        </p>
      ) : (
        <ul className={`space-y-2 ${compact ? 'max-h-48 overflow-auto' : 'max-h-80 overflow-auto'}`}>
          {rows.map((n) => {
            const key = String(n.event_key || '')
            const label = n.event_label || EVENT_LABELS[key] || key
            const status = String(n.delivery_status || 'sent')
            return (
              <li
                key={n.id}
                className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">{label}</div>
                  <div className="mt-0.5 text-xs text-slate-600">
                    {n.sent_at ? formatDateTimeUK(n.sent_at) : '—'}
                    {n.recipient_email ? ` · ${n.recipient_email}` : ''}
                  </div>
                </div>
                <span
                  className={`inline-flex w-fit shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${statusTone(status)}`}
                >
                  {status === 'sent' ? 'Sent ✓' : status}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
