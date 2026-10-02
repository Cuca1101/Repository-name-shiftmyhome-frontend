import { useCallback, useEffect, useState } from 'react'
import { formatDateTimeUK } from '../../lib/formatDateDisplay'
import {
  bookingInvoiceArchive,
  buildCustomerEmailList,
  providerStatusLabel,
} from '../../lib/customerEmailArchive'
import { fetchJobCustomerNotifications } from '../../lib/jobCustomerTracking'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'

const STATUS_TONE = {
  delivered: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  sent: 'bg-sky-50 text-sky-900 ring-sky-200',
  failed: 'bg-red-50 text-red-800 ring-red-200',
  pending: 'bg-amber-50 text-amber-900 ring-amber-200',
}

function base64ToPdfBlob(contentBase64) {
  const binary = atob(contentBase64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: 'application/pdf' })
}

/**
 * Saved customer emails and the invoice file that was attached.
 * Preview and download read stored copies. They do not send mail or build a new invoice.
 * @param {{ quote?: Record<string, unknown> }} props
 */
export default function CustomerEmailsSection({ quote }) {
  const quoteId = String(quote?.id || '').trim()
  const quoteEmail = String(quote?.email || '')
  const paymentSentAt = quote?.payment_confirmation_email_sent_at || null
  const [rows, setRows] = useState([])
  const [invoiceArchive, setInvoiceArchive] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const [invoiceUrl, setInvoiceUrl] = useState('')
  const [invoiceName, setInvoiceName] = useState('invoice.pdf')
  const [fileError, setFileError] = useState('')
  const [fileBusy, setFileBusy] = useState(false)

  const load = useCallback(async () => {
    if (!quoteId || !isSupabaseConfigured || !supabase) {
      setRows([])
      setInvoiceArchive(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      await supabase.functions.invoke('admin-booking-archive', { body: { quoteId, sync: true } })
      const notifications = await fetchJobCustomerNotifications(quoteId)
      const archiveResult = await supabase
        .from('customer_email_archive')
        .select(
          'id, quote_id, notification_id, event_key, subject, recipient_email, html_snapshot, provider_message_id, provider_status, invoice_path, invoice_filename, sent_at',
        )
        .eq('quote_id', quoteId)
        .order('sent_at', { ascending: false })
      const archives = archiveResult.error ? [] : archiveResult.data || []
      if (archiveResult.error) setError(archiveResult.error.message)
      setInvoiceArchive(bookingInvoiceArchive(archives))
      setRows(
        buildCustomerEmailList({
          notifications,
          archives,
          quote: { email: quoteEmail, payment_confirmation_email_sent_at: paymentSentAt },
        }),
      )
    } catch (loadError) {
      setError(loadError?.message || 'Could not load customer emails.')
      setRows([])
      setInvoiceArchive(null)
    } finally {
      setLoading(false)
    }
  }, [paymentSentAt, quoteEmail, quoteId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    return () => {
      if (invoiceUrl) URL.revokeObjectURL(invoiceUrl)
    }
  }, [invoiceUrl])

  async function loadStoredInvoice(target) {
    if (!supabase) throw new Error('Supabase is not configured.')
    const { data, error: invokeError } = await supabase.functions.invoke('admin-booking-archive', {
      body: target,
    })
    if (invokeError) throw new Error(invokeError.message || 'Could not open the stored invoice.')
    if (!data?.ok || !data.contentBase64) {
      throw new Error('Original invoice file is not saved for this booking.')
    }
    return { blob: base64ToPdfBlob(data.contentBase64), filename: data.filename || 'invoice.pdf' }
  }

  async function openStoredInvoice(target) {
    setFileBusy(true)
    setFileError('')
    try {
      const file = await loadStoredInvoice(target)
      if (invoiceUrl) URL.revokeObjectURL(invoiceUrl)
      const url = URL.createObjectURL(file.blob)
      setInvoiceUrl(url)
      setInvoiceName(file.filename)
    } catch (openError) {
      setFileError(openError?.message || 'Original invoice file is not saved for this booking.')
    } finally {
      setFileBusy(false)
    }
  }

  function downloadCurrentInvoice() {
    if (!invoiceUrl) return
    const link = document.createElement('a')
    link.href = invoiceUrl
    link.download = invoiceName
    link.click()
  }

  async function downloadStoredInvoice(target, filename) {
    setFileBusy(true)
    setFileError('')
    try {
      const file = await loadStoredInvoice(target)
      const url = URL.createObjectURL(file.blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename || file.filename
      link.click()
      URL.revokeObjectURL(url)
    } catch (downloadError) {
      setFileError(downloadError?.message || 'Original invoice file is not saved for this booking.')
    } finally {
      setFileBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
        <p className="text-sm font-semibold text-slate-900">Invoice</p>
        <p className="mt-1 text-xs text-slate-600">
          Preview and download use the PDF saved with the payment email.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={fileBusy || !invoiceArchive}
            onClick={() => void openStoredInvoice({ archiveId: invoiceArchive.id })}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            Preview invoice
          </button>
          <button
            type="button"
            disabled={fileBusy || !invoiceArchive}
            onClick={() => void downloadStoredInvoice({ archiveId: invoiceArchive.id }, invoiceArchive.invoice_filename)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            Download PDF
          </button>
        </div>
        {!loading && !invoiceArchive ? (
          <p className="mt-2 text-xs text-slate-600">Original invoice file is not saved for this booking.</p>
        ) : null}
        {fileError ? <p className="mt-2 text-xs text-amber-900">{fileError}</p> : null}
      </div>

      {loading ? <p className="text-sm text-slate-500">Loading emails…</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {!loading && !error && rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
          No customer emails logged yet.
        </p>
      ) : null}

      {rows.length > 0 ? (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.key} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{row.subject}</p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {row.recipient || '—'}
                    {' · '}
                    {row.sentAt ? formatDateTimeUK(row.sentAt) : '—'}
                  </p>
                </div>
                <span
                  className={`inline-flex w-fit shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${STATUS_TONE[row.status] || STATUS_TONE.sent}`}
                >
                  {providerStatusLabel(row.status)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPreview(row)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Preview
                </button>
                {row.hasInvoice ? (
                  <>
                    <button
                      type="button"
                      disabled={fileBusy}
                      onClick={() => void openStoredInvoice({ archiveId: row.archiveId })}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                    >
                      View invoice
                    </button>
                    <button
                      type="button"
                      disabled={fileBusy}
                      onClick={() => void downloadStoredInvoice({ archiveId: row.archiveId }, row.invoiceFilename)}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Download PDF
                    </button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {preview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">{preview.subject}</p>
                <p className="text-xs text-slate-500">{preview.recipient}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            {preview.hasSnapshot && preview.html ? (
              <iframe
                title="Customer email preview"
                sandbox=""
                srcDoc={preview.html}
                className="h-[70vh] w-full bg-white"
              />
            ) : (
              <p className="px-4 py-8 text-sm text-slate-700">Original preview unavailable</p>
            )}
          </div>
        </div>
      ) : null}

      {invoiceUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <p className="truncate font-semibold text-slate-900">{invoiceName}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={downloadCurrentInvoice}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(invoiceUrl)
                    setInvoiceUrl('')
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
            <iframe title="Stored invoice" src={invoiceUrl} className="h-[70vh] w-full bg-white" />
          </div>
        </div>
      ) : null}
    </div>
  )
}
