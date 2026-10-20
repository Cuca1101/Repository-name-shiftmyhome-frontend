import { useCallback, useEffect, useRef, useState } from 'react'
import { adminDecideOffer } from '../../lib/customerOfferApi'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { formatDateTimeUK } from '../../lib/formatDateDisplay'

function gbp(amount) {
  const n = Number(amount)
  if (!Number.isFinite(n)) return '—'
  return `£${n.toFixed(2)}`
}

const OPEN = new Set(['pending', 'countered'])

function offerStateNote(row) {
  const status = String(row?.status || '')
  const expired = Date.parse(row?.expires_at) <= Date.now()
  if (status === 'pending' && !expired) return 'Waiting for your decision.'
  if (status === 'pending') return 'Expired. No actions are available.'
  if (status === 'countered' && !expired) return 'Counteroffer sent. Waiting for the customer.'
  if (status === 'countered') return 'The counteroffer expired. No actions are available.'
  if (status === 'accepted' || status === 'counter_accepted') return 'Accepted. Checkout uses this agreed amount.'
  if (status === 'declined' || status === 'counter_declined') return 'Declined. No further action.'
  if (status === 'booked') return 'This offer was used for a booking.'
  if (status === 'superseded' || status === 'expired') return 'No longer active. No actions are available.'
  return 'No actions are available.'
}

export default function CustomerLeadOffersSection({ leadId, quoteRef = '', onOffers }) {
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [counter, setCounter] = useState({})
  const [notice, setNotice] = useState('')
  const [loaded, setLoaded] = useState(false)
  const onOffersRef = useRef(onOffers)
  onOffersRef.current = onOffers

  const load = useCallback(async () => {
    if (!leadId || !isSupabaseConfigured || !supabase) return
    const filters = [`lead_id.eq.${leadId}`]
    const ref = String(quoteRef || '').trim()
    if (ref) filters.push(`quote_ref.eq.${ref}`)
    const { data, error: loadError } = await supabase
      .from('customer_offers')
      .select('*')
      .or(filters.join(','))
      .order('created_at', { ascending: false })
    if (loadError) {
      setError(loadError.message || 'Offers could not be loaded.')
      setLoaded(true)
      return
    }
    setError('')
    setRows(data || [])
    setLoaded(true)
    onOffersRef.current?.(data || [])
  }, [leadId, quoteRef])

  useEffect(() => {
    void load()
  }, [load])

  const pending = rows.some((row) => OPEN.has(row.status) && Date.parse(row.expires_at) > Date.now())

  async function decide(row, action) {
    setBusyId(row.id)
    setNotice('')
    setError('')
    try {
      const draft = counter[row.id] || {}
      await adminDecideOffer(action, row.id, {
        counter_amount: draft.amount,
        message: draft.message || '',
      })
      setNotice(action === 'accept' ? 'Offer accepted and the customer has been emailed.' : action === 'decline' ? 'Offer declined and the customer has been emailed.' : 'Counteroffer sent.')
      await load()
    } catch (err) {
      setError(err?.message || 'Could not update this offer.')
    } finally {
      setBusyId('')
    }
  }

  if (!leadId) return null
  if (!loaded) {
    return (
      <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900">Customer offer</h3>
        <p className="mt-2 text-sm text-slate-500">Loading…</p>
      </section>
    )
  }

  return (
    <section className={`min-w-0 rounded-xl border p-4 shadow-sm ${pending ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900">Customer offer</h3>
        {pending ? (
          <span className="rounded-full bg-amber-200 px-2.5 py-1 text-xs font-bold text-amber-950">Needs a decision</span>
        ) : null}
      </div>
      {notice ? <p className="mt-2 text-sm text-emerald-800">{notice}</p> : null}
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      {!rows.length ? (
        <p className="mt-3 text-sm text-slate-600">No customer offer on this lead.</p>
      ) : null}
      <div className="mt-3 space-y-3">
        {rows.map((row) => {
          const history = Array.isArray(row.history) ? row.history : []
          const open = row.status === 'pending' && Date.parse(row.expires_at) > Date.now()
          const statusLabel = String(row.status || '').replaceAll('_', ' ')
          return (
            <article key={row.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold capitalize text-slate-900">Offer status: {statusLabel}</p>
                <p className="text-xs text-slate-500">Expires {formatDateTimeUK(row.expires_at)}</p>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Original quoted total</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{gbp(row.original_total)}</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">Customer’s proposed total</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-amber-950">{gbp(row.proposed_amount)}</p>
                </div>
                {row.counter_amount != null ? (
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Counteroffer</p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{gbp(row.counter_amount)}</p>
                  </div>
                ) : null}
                {row.agreed_amount != null ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">Agreed from this offer</p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-emerald-950">{gbp(row.agreed_amount)}</p>
                  </div>
                ) : null}
              </div>
              {row.message ? <p className="mt-2 text-sm text-slate-700">Message: {row.message}</p> : null}
              {row.date_flexibility ? <p className="mt-1 text-sm text-slate-700">Date flexibility: {row.date_flexibility}</p> : null}
              <p className="mt-2 text-sm text-slate-700">{offerStateNote(row)}</p>
              {history.length ? (
                <div className="mt-2 border-t border-slate-100 pt-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Negotiation history</p>
                <ol className="mt-1 space-y-1 text-xs text-slate-600">
                  {history.map((item, index) => (
                    <li key={`${item.at || index}`}>
                      {formatDateTimeUK(item.at)} · {item.actor_label || item.actor || 'Update'}
                      {item.amount != null ? ` · ${gbp(item.amount)}` : ''} · {item.status || item.type}
                      {item.message ? ` — ${item.message}` : ''}
                    </li>
                  ))}
                </ol>
                </div>
              ) : null}
              {open ? (
                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={busyId === row.id} onClick={() => decide(row, 'accept')} className="min-h-[40px] rounded-lg bg-brand-600 px-3 text-sm font-bold text-white disabled:opacity-60">Accept offer</button>
                    <button type="button" disabled={busyId === row.id} onClick={() => decide(row, 'decline')} className="min-h-[40px] rounded-lg border border-red-300 px-3 text-sm font-bold text-red-700 disabled:opacity-60">Decline offer</button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[140px_1fr_auto]">
                    <input
                      inputMode="decimal"
                      placeholder="Counter £"
                      value={counter[row.id]?.amount || ''}
                      onChange={(e) => setCounter((prev) => ({ ...prev, [row.id]: { ...prev[row.id], amount: e.target.value } }))}
                      className="min-h-[40px] rounded-lg border border-slate-200 px-2 text-sm"
                    />
                    <input
                      placeholder="Optional message"
                      value={counter[row.id]?.message || ''}
                      onChange={(e) => setCounter((prev) => ({ ...prev, [row.id]: { ...prev[row.id], message: e.target.value } }))}
                      className="min-h-[40px] rounded-lg border border-slate-200 px-2 text-sm"
                    />
                    <button type="button" disabled={busyId === row.id} onClick={() => decide(row, 'counter')} className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 disabled:opacity-60">Send counteroffer</button>
                  </div>
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}
