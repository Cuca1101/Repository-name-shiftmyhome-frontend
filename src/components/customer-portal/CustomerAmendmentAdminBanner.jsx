import { useCallback, useEffect, useState } from 'react'
import { reviewPortalAmendment } from '../../lib/customerPortalApi'
import { formatGbp } from '../../lib/customerPortalModel'
import { supabase } from '../../lib/supabase'

const OPEN = new Set(['pending_approval', 'pending_payment', 'paid_needs_review'])

export default function CustomerAmendmentAdminBanner({ quoteId }) {
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    if (!supabase || !quoteId) return
    const { data } = await supabase
      .from('customer_booking_amendments')
      .select('id, status, previous_total, next_total, payment_delta, changes, refund_due, created_at, paid_at')
      .eq('quote_id', quoteId)
      .order('created_at', { ascending: false })
      .limit(5)
    setRows(Array.isArray(data) ? data : [])
  }, [quoteId])

  useEffect(() => {
    load()
  }, [load])

  const open = rows.filter((row) => OPEN.has(row.status))
  if (!open.length) return null

  async function act(id, action) {
    setBusy(true)
    setMessage('')
    try {
      await reviewPortalAmendment(id, action)
      setMessage(action === 'approve' ? 'Change updated.' : 'Change declined. The booking was left as it was.')
      await load()
    } catch (error) {
      setMessage(error?.message || 'Could not update the change.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
      <p className="font-bold">Customer portal change — pending</p>
      {open.map((row) => (
        <div key={row.id} className="mt-2">
          <p>
            {row.status === 'pending_approval'
              ? 'Pending approval'
              : row.status === 'paid_needs_review'
                ? 'Paid, not applied — the confirmed booking is unchanged'
                : 'Waiting for the customer to pay the difference'}
            {' · '}
            {formatGbp(row.previous_total)} → {formatGbp(row.next_total)}
            {Number(row.refund_due) > 0 ? ` · refund to review ${formatGbp(row.refund_due)}` : ''}
          </p>
          {row.status !== 'pending_payment' ? (
            <div className="mt-2 flex gap-2">
              <button type="button" disabled={busy} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50" onClick={() => act(row.id, 'approve')}>
                Approve
              </button>
              <button type="button" disabled={busy} className="rounded-lg border border-amber-400 px-3 py-1.5 text-xs font-semibold disabled:opacity-50" onClick={() => act(row.id, 'decline')}>
                Decline
              </button>
            </div>
          ) : null}
        </div>
      ))}
      {message ? <p className="mt-2">{message}</p> : null}
    </div>
  )
}
