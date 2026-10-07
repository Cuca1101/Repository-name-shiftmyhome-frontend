import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDateTimeUK, formatDateUK } from '../lib/formatDateDisplay'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

function money(n) {
  if (n == null || n === '') return '—'
  return `£${Number(n).toFixed(2)}`
}

/**
 * Admin list of customer tip payments (job_tips), separate from booking payments.
 */
export default function CustomerTipsAdmin() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const { data, error: qErr } = await supabase
        .from('job_tips')
        .select(
          'id, quote_id, quote_ref, customer_name, customer_email, amount_gbp, currency, status, paid_at, created_at, stripe_session_id, stripe_payment_intent_id, quotes(quote_ref, full_name, move_date)',
        )
        .order('created_at', { ascending: false })
        .limit(200)
      if (qErr) throw qErr
      setRows(data || [])
    } catch (e) {
      setError(e?.message || 'Could not load tips.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Customer Tips</h1>
        <p className="mt-1 text-sm text-slate-600">
          Optional tips paid via Stripe Checkout. Separate from booking price, deposit, balance and
          driver payout.
        </p>
      </div>

      {loading ? <p className="text-sm text-slate-500">Loading tips…</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {!loading && !error && rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
          No tip payments yet.
        </p>
      ) : null}

      {rows.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Date paid</th>
                  <th className="px-3 py-2">Booking</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Job date</th>
                  <th className="px-3 py-2 text-right">Tip</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Stripe</th>
                  <th className="px-3 py-2 text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const q = row.quotes || {}
                  const ref = String(row.quote_ref || q.quote_ref || '—')
                  const customer = String(row.customer_name || q.full_name || row.customer_email || '—')
                  const moveDate = q.move_date ? formatDateUK(q.move_date) : '—'
                  const href = row.quote_id
                    ? `/admin/active-jobs/${encodeURIComponent(String(row.quote_id))}`
                    : null
                  const stripeRef = row.stripe_payment_intent_id || row.stripe_session_id || '—'
                  return (
                    <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                      <td className="px-3 py-2 text-xs text-slate-700">
                        {row.paid_at ? formatDateTimeUK(row.paid_at) : formatDateTimeUK(row.created_at)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs font-semibold text-brand-700">{ref}</td>
                      <td className="px-3 py-2 text-xs font-medium text-slate-900">{customer}</td>
                      <td className="px-3 py-2 text-xs text-slate-700">{moveDate}</td>
                      <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums text-slate-900">
                        {money(row.amount_gbp)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            String(row.status) === 'paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {String(row.status || 'pending')}
                        </span>
                      </td>
                      <td className="max-w-[10rem] truncate px-3 py-2 font-mono text-[10px] text-slate-600" title={stripeRef}>
                        {stripeRef}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {href ? (
                          <Link
                            to={href}
                            className="inline-flex min-h-[28px] items-center rounded-md bg-slate-900 px-2.5 text-[11px] font-semibold text-white hover:bg-slate-800"
                          >
                            View Job
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
