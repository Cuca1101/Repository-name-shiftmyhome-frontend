export const BOOKING_INVOICE_BUCKET = 'booking-invoices'

export type CustomerEmailArchiveInput = {
  quoteId: string
  notificationId?: string | null
  eventKey: string
  subject: string
  recipientEmail: string
  html: string
  text: string
  providerMessageId?: string | null
  providerStatus?: string
  invoiceBucket?: string | null
  invoicePath?: string | null
  invoiceFilename?: string | null
  sentAt?: string
}

/**
 * Store the HTML and text that Resend accepted. Later template edits do not rewrite this row.
 */
export async function saveCustomerEmailArchive(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  input: CustomerEmailArchiveInput,
) {
  const html = String(input.html || '')
  if (!html.trim()) return { ok: false as const, reason: 'empty_html' }
  const { error } = await supabase.from('customer_email_archive').insert({
    quote_id: input.quoteId,
    notification_id: input.notificationId || null,
    event_key: input.eventKey,
    subject: input.subject,
    recipient_email: input.recipientEmail,
    html_snapshot: html,
    text_snapshot: String(input.text || ''),
    provider_message_id: input.providerMessageId || null,
    provider_status: input.providerStatus || 'sent',
    invoice_bucket: input.invoiceBucket || null,
    invoice_path: input.invoicePath || null,
    invoice_filename: input.invoiceFilename || null,
    sent_at: input.sentAt || new Date().toISOString(),
  })
  if (error) {
    console.error('[customer-email-archive] insert failed', error.message)
    return { ok: false as const, reason: error.message }
  }
  return { ok: true as const }
}

/**
 * Keep the PDF bytes that were attached. Does not build a new invoice.
 */
export async function storeSentInvoicePdf(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  quoteId: string,
  fileKey: string,
  bytes: Uint8Array,
  filename: string,
) {
  const safeKey = String(fileKey || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80)
  const safeQuote = String(quoteId || '').trim()
  if (!safeQuote || !safeKey || !bytes?.length) return null
  const path = `${safeQuote}/${safeKey}.pdf`
  const upload = await supabase.storage.from(BOOKING_INVOICE_BUCKET).upload(path, bytes, {
    contentType: 'application/pdf',
    upsert: true,
  })
  if (upload.error) {
    console.error('[customer-email-archive] invoice upload failed', upload.error.message)
    return null
  }
  return { bucket: BOOKING_INVOICE_BUCKET, path, filename }
}
