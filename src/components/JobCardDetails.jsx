import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteJob, fetchJobById, fetchJobItems, updateJob } from '../lib/data/jobsRepository'
import { fetchQuotesByQuoteRefs } from '../lib/data/quotesAdminRepository'
import { LEAD_STATUSES } from '../constants/leadStatus'
import { generateJobPdf } from '../lib/PdfGenerator'
import { formatDateTimeUK, formatDateUK } from '../lib/formatDateDisplay'
import { stripeDashboardSearchUrl } from '../lib/stripeDashboardUrl'
import { formatWizardServiceExtrasBlock } from '../lib/emailQuotePayload'
import AdminInventoryTable from './admin-workflow/AdminInventoryTable'

function money(n) {
  if (n == null || n === '') return '—'
  return `£${Number(n).toFixed(2)}`
}

/** @param {Record<string, unknown>|null} job */
function quoteRefFromJob(job) {
  const pi = job?.price_inputs
  if (pi && typeof pi === 'object' && pi.quoteRef != null) return String(pi.quoteRef).trim()
  return ''
}

export default function JobCardDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [job, setJob] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [finalPrice, setFinalPrice] = useState('')
  const [status, setStatus] = useState('New')
  const [linkedQuote, setLinkedQuote] = useState(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const j = await fetchJobById(id)
      if (!j) {
        setJob(null)
        return
      }
      setJob(j)
      setInternalNotes(j.internal_notes || '')
      setFinalPrice(j.final_price != null ? String(j.final_price) : '')
      setStatus(j.status || 'New')
      const ji = await fetchJobItems(id)
      setItems(ji)
    } catch (e) {
      setError(e?.message || 'Failed to load job.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!job) {
      setLinkedQuote(null)
      return
    }
    const ref = quoteRefFromJob(job)
    if (!ref) {
      setLinkedQuote(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const map = await fetchQuotesByQuoteRefs([ref])
        if (!cancelled) setLinkedQuote(map[ref] ?? null)
      } catch {
        if (!cancelled) setLinkedQuote(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [job])

  async function handleSave(e) {
    e.preventDefault()
    if (!id) return
    setSaving(true)
    setError('')
    try {
      const fp = finalPrice.trim() === '' ? null : parseFloat(finalPrice)
      const updated = await updateJob(id, {
        status,
        internal_notes: internalNotes.trim() || null,
        final_price: fp != null && Number.isFinite(fp) ? fp : null,
      })
      setJob(updated)
    } catch (err) {
      setError(err?.message || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!id) return
    if (!window.confirm('Delete this job card permanently?')) return
    setError('')
    try {
      await deleteJob(id)
      navigate('/admin/jobs', { replace: true })
    } catch (e) {
      setError(e?.message || 'Delete failed.')
    }
  }

  async function handlePdf() {
    if (!job) return
    setError('')
    try {
      const wizardExtras =
        job?.price_inputs &&
        typeof job.price_inputs === 'object' &&
        job.price_inputs.wizard &&
        typeof job.price_inputs.wizard === 'object'
          ? formatWizardServiceExtrasBlock(job.price_inputs.wizard).trim()
          : ''
      await generateJobPdf(
        {
          job_reference: job.job_reference,
          full_name: job.full_name,
          phone: job.phone,
          email: job.email,
          pickup_address: job.pickup_address,
          delivery_address: job.delivery_address,
          move_date: job.move_date,
          service_type: job.service_type,
          total_cubic_metres: job.total_cubic_metres,
          price_breakdown: job.price_breakdown,
          estimated_total: job.estimated_total,
          final_price: job.final_price,
          customer_message: job.customer_message,
          internal_notes: job.internal_notes,
          arrival_type: job.arrival_type,
          arrival_time: job.arrival_time,
          distance_miles: job.distance_miles,
          created_at: job.created_at,
        },
        {
          wizard_extras: wizardExtras,
          items: items.map((r) => ({
            item_name: r.item_name,
            quantity: r.quantity,
            cubic_metres_per_unit: r.cubic_metres_per_unit,
            line_volume_m3: r.line_volume_m3,
            is_custom: r.is_custom,
          })),
        },
      )
    } catch (e) {
      setError(e?.message || 'PDF failed.')
    }
  }

  if (loading) {
    return <p className="text-slate-600">Loading job…</p>
  }

  if (!job) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
        <p className="text-slate-600">Job not found.</p>
        <Link to="/admin/jobs" className="mt-4 inline-block font-semibold text-brand-700 hover:underline">
          Back to Job Cards
        </Link>
      </div>
    )
  }

  const breakdown = job.price_breakdown && typeof job.price_breakdown === 'object' ? job.price_breakdown : {}
  const rows = Array.isArray(breakdown.rows) ? breakdown.rows : []

  const wizardExtrasRaw =
    job?.price_inputs &&
    typeof job.price_inputs === 'object' &&
    job.price_inputs.wizard &&
    typeof job.price_inputs.wizard === 'object'
      ? formatWizardServiceExtrasBlock(job.price_inputs.wizard).trim()
      : ''

  const inventoryDisplayRows = items.map((r) => ({
    name: String(r.item_name || 'Item'),
    qty: r.quantity,
    volume:
      r.line_volume_m3 != null && Number.isFinite(Number(r.line_volume_m3))
        ? `${Number(r.line_volume_m3).toFixed(2)} m³`
        : '—',
    sizeType: [
      r.cubic_metres_per_unit != null && Number.isFinite(Number(r.cubic_metres_per_unit))
        ? `${Number(r.cubic_metres_per_unit).toFixed(2)} m³/unit`
        : null,
      r.is_custom ? 'Custom' : null,
      r.weight_type != null ? String(r.weight_type) : null,
    ]
      .filter(Boolean)
      .join(' · ') || '—',
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Link to="/admin/jobs" className="text-sm font-semibold text-brand-700 hover:underline">
            ← Job Cards
          </Link>
          <h2 className="mt-2 break-words font-mono text-xl font-bold text-slate-900 sm:text-2xl">
            {job.job_reference}
          </h2>
          <p className="text-sm text-slate-600">
            Created {formatDateTimeUK(job.created_at)}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={handlePdf}
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 sm:w-auto"
          >
            Generate PDF
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border border-red-200 bg-white px-5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 sm:w-auto"
          >
            Delete
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <h3 className="text-lg font-semibold text-slate-900">Customer</h3>
          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className="font-medium text-slate-500">Name</dt>
              <dd className="text-slate-900">{job.full_name}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Phone</dt>
              <dd>
                <a href={`tel:${job.phone}`} className="text-brand-700 hover:underline">
                  {job.phone}
                </a>
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Email</dt>
              <dd>
                <a href={`mailto:${job.email}`} className="break-words text-brand-700 hover:underline">
                  {job.email}
                </a>
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Pickup</dt>
              <dd className="break-words text-slate-800">{job.pickup_address}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Delivery</dt>
              <dd className="break-words text-slate-800">{job.delivery_address}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Move date</dt>
              <dd className="text-slate-800">{formatDateUK(job.move_date)}</dd>
            </div>
            {(job.arrival_type || job.arrival_time) && (
              <div>
                <dt className="font-medium text-slate-500">Arrival</dt>
                <dd className="text-slate-800">
                  {job.arrival_type === 'exact' && job.arrival_time
                    ? `${job.arrival_time} (Exact time)`
                    : String(job.arrival_type || 'Window')}
                </dd>
              </div>
            )}
            <div>
              <dt className="font-medium text-slate-500">Service type</dt>
              <dd className="text-slate-800">{job.service_type}</dd>
            </div>
            {wizardExtrasRaw ? (
              <div>
                <dt className="font-medium text-slate-500">Service extras (wizard)</dt>
                <dd className="whitespace-pre-wrap text-sm text-slate-800">{wizardExtrasRaw}</dd>
              </div>
            ) : null}
            {job.customer_message && (
              <div>
                <dt className="font-medium text-slate-500">Customer message</dt>
                <dd className="text-slate-800 whitespace-pre-wrap">{job.customer_message}</dd>
              </div>
            )}
          </dl>
        </div>

        <form onSubmit={handleSave} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <h3 className="text-lg font-semibold text-slate-900">Manage job</h3>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
              >
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Final price (£)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Optional — overrides estimate on PDF"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                value={finalPrice}
                onChange={(e) => setFinalPrice(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Internal notes</span>
              <textarea
                rows={4}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Staff-only notes…"
              />
            </label>
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 sm:w-auto sm:px-8"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <h3 className="text-lg font-semibold text-slate-900">Payment</h3>
        <p className="mt-1 text-sm text-slate-600">
          Pulled from the <code className="rounded bg-slate-100 px-1">quotes</code> table when the job&apos;s saved
          wizard quote ref matches.
        </p>
        {quoteRefFromJob(job) ? (
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-slate-500">Wizard quote ref</dt>
              <dd className="mt-1 font-mono text-sm text-slate-900">
                {linkedQuote?.id ? (
                  <Link to={`/admin/available-jobs/${linkedQuote.id}`} className="font-semibold text-brand-700 hover:underline">
                    {quoteRefFromJob(job)}
                  </Link>
                ) : (
                  quoteRefFromJob(job)
                )}
              </dd>
            </div>
            {linkedQuote ? (
              <>
                <div>
                  <dt className="text-sm font-medium text-slate-500">Status</dt>
                  <dd className="mt-1 text-slate-900">{linkedQuote.payment_status ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">Quote workflow status</dt>
                  <dd className="mt-1 text-slate-900">{linkedQuote.status ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">Type</dt>
                  <dd className="mt-1 text-slate-900">
                    {linkedQuote.payment_type === 'deposit'
                      ? 'Deposit'
                      : linkedQuote.payment_type === 'full'
                        ? 'Full'
                        : linkedQuote.payment_type ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">Amount paid</dt>
                  <dd className="mt-1 font-semibold tabular-nums text-slate-900">
                    {money(linkedQuote.amount_paid)}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-slate-500">Paid date / time</dt>
                  <dd className="mt-1 text-slate-900">{formatDateTimeUK(linkedQuote.paid_at)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-slate-500">Card payment ID</dt>
                  <dd className="mt-1 break-all font-mono text-sm text-slate-800">
                    {linkedQuote.stripe_payment_intent_id || '—'}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-slate-500">Checkout session ID (legacy)</dt>
                  <dd className="mt-1 break-all font-mono text-sm text-slate-800">
                    {linkedQuote.stripe_session_id || '—'}
                  </dd>
                </div>
              </>
            ) : (
              <p className="sm:col-span-2 mt-2 text-sm text-amber-800">
                No quote row found for this reference yet (customer may not have paid or saved the lead).
              </p>
            )}
          </dl>
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            This job has no <code className="rounded bg-slate-100 px-1">quoteRef</code> in pricing inputs — open{' '}
            <Link to="/admin/available-jobs" className="font-semibold text-brand-700 hover:underline">
              Available Jobs
            </Link>{' '}
            to find payments by customer email or quote reference.
          </p>
        )}
        {(linkedQuote?.stripe_payment_intent_id || linkedQuote?.stripe_session_id) && (
          <div className="mt-6">
            <a
              href={stripeDashboardSearchUrl(
                String(linkedQuote.stripe_payment_intent_id || linkedQuote.stripe_session_id),
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              View payment details
            </a>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.04] sm:p-6">
        <h3 className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">Inventory</h3>
        <p className="mt-1 text-sm text-slate-600">
          Total volume: <strong>{Number(job.total_cubic_metres).toFixed(2)} m³</strong>
        </p>
        <div className="mt-4">
          <AdminInventoryTable rows={inventoryDisplayRows} emptyLabel="No line items stored." />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <h3 className="text-lg font-semibold text-slate-900">Price breakdown</h3>
        {rows.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No detailed rows stored for this job.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {rows.map((r, i) => (
              <li key={i} className="flex justify-between py-2 text-sm">
                <span className="text-slate-700">{r.label}</span>
                <span className="tabular-nums font-medium text-slate-900">{money(r.amount)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4">
          <span className="font-semibold text-slate-900">Estimated total</span>
          <span className="text-lg font-bold text-brand-800">{money(job.estimated_total)}</span>
        </div>
      </div>
    </div>
  )
}
