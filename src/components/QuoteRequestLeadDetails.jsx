import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AdminField } from './admin-workflow/AdminJobUiPrimitives'
import {
  deletePublicQuoteRequest,
  fetchPublicQuoteRequestById,
  markPublicQuoteRequestLost,
  updateQuoteWorkflowStatus,
} from '../lib/data/quotesAdminRepository'
import { formatDateTimeUK, formatDateUK } from '../lib/formatDateDisplay'

function statusTone(status) {
  const s = String(status ?? '').trim()
  if (s === 'Booked') return 'bg-emerald-50 text-emerald-900'
  if (s === 'Contacted') return 'bg-sky-50 text-sky-900'
  if (s === 'Cancelled') return 'bg-rose-50 text-rose-900'
  if (s === 'New') return 'bg-violet-50 text-violet-900'
  return 'bg-slate-100 text-slate-800'
}

function leadMessage(row) {
  const details = row?.details != null ? String(row.details).trim() : ''
  if (details) return details
  const message = row?.message != null ? String(row.message).trim() : ''
  return message || '—'
}

export default function QuoteRequestLeadDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [row, setRow] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const load = useCallback(async () => {
    if (!id) {
      setError('Missing lead id.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const q = await fetchPublicQuoteRequestById(id)
      if (!q) {
        setRow(null)
        setError('Quote request not found.')
      } else {
        setRow(q)
      }
    } catch (e) {
      setRow(null)
      setError(e?.message || 'Failed to load quote request.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function runStatusUpdate(status) {
    if (!id || actionBusy) return
    setActionBusy(true)
    setError('')
    try {
      await updateQuoteWorkflowStatus(id, status)
      await load()
    } catch (e) {
      setError(e?.message || 'Could not update status.')
    } finally {
      setActionBusy(false)
    }
  }

  async function handleMarkLost() {
    if (!id || actionBusy) return
    setActionBusy(true)
    setError('')
    try {
      await markPublicQuoteRequestLost(id)
      await load()
    } catch (e) {
      setError(e?.message || 'Could not mark lead as lost.')
    } finally {
      setActionBusy(false)
    }
  }

  async function handleDeleteConfirm() {
    if (!id || deleteBusy) return
    setDeleteBusy(true)
    setError('')
    try {
      await deletePublicQuoteRequest(id)
      navigate('/admin/quote-requests', { replace: true })
    } catch (e) {
      setError(e?.message || 'Could not delete lead.')
      setDeleteBusy(false)
      setDeleteOpen(false)
    }
  }

  if (loading) {
    return <p className="p-8 text-center text-slate-500">Loading lead…</p>
  }

  if (!row) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
        <p className="text-slate-700">{error || 'Quote request not found.'}</p>
        <Link to="/admin/quote-requests" className="mt-4 inline-block font-semibold text-brand-700 hover:underline">
          Back to quote requests
        </Link>
      </div>
    )
  }

  const ref = row.quote_ref ? String(row.quote_ref) : '—'
  const status = row.status ? String(row.status) : 'New'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/admin/quote-requests"
            className="text-sm font-semibold text-brand-700 hover:underline"
          >
            ← Quote requests
          </Link>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">Lead detail</h2>
          <p className="mt-1 font-mono text-sm text-slate-600">{ref}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${statusTone(status)}`}
        >
          {status}
        </span>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Customer</h3>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <AdminField label="Lead reference" value={ref} mono />
              <AdminField label="Customer name" value={row.full_name} />
              <AdminField label="Phone" value={row.phone} />
              <AdminField label="Email" value={row.email} />
            </dl>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Move</h3>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <AdminField label="Service requested" value={row.service ?? row.service_type} />
              <AdminField label="Move date" value={formatDateUK(row.move_date)} />
              <div className="sm:col-span-2">
                <AdminField label="Pickup" value={row.pickup_address} />
              </div>
              <div className="sm:col-span-2">
                <AdminField label="Delivery" value={row.delivery_address} />
              </div>
              <div className="sm:col-span-2">
                <AdminField label="Details / message" value={leadMessage(row)} />
              </div>
              <AdminField label="Created" value={formatDateTimeUK(row.created_at)} />
              <AdminField label="Lead status" value={status} />
            </dl>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Lead actions</h3>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                disabled={actionBusy || status === 'Contacted'}
                onClick={() => runStatusUpdate('Contacted')}
                className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                Mark contacted
              </button>
              <button
                type="button"
                disabled={actionBusy || status === 'Booked'}
                onClick={() => runStatusUpdate('Booked')}
                className="min-h-[44px] rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
              >
                Mark booked
              </button>
              <button
                type="button"
                disabled={actionBusy || status === 'Cancelled'}
                onClick={handleMarkLost}
                className="min-h-[44px] rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
              >
                Mark lost / not valid
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => setDeleteOpen(true)}
                className="min-h-[44px] rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
              >
                Delete lead
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-brand-200 bg-brand-50/40 p-5 shadow-card">
            <h3 className="text-sm font-bold uppercase tracking-wide text-brand-800">Convert</h3>
            <p className="mt-2 text-sm text-slate-700">
              Open job control only when you are ready to treat this enquiry as an operational job.
            </p>
            <Link
              to={`/admin/available-jobs/${id}`}
              className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Convert to job
            </Link>
          </section>
        </aside>
      </div>

      {deleteOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-lead-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 id="delete-lead-title" className="text-lg font-bold text-slate-900">
              Delete lead
            </h3>
            <p className="mt-2 text-sm text-slate-700">
              Delete this lead? This cannot be undone.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => setDeleteOpen(false)}
                className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={handleDeleteConfirm}
                className="min-h-[44px] rounded-xl bg-rose-600 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {deleteBusy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
