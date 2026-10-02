export function providerStatusFromResendEvent(type) {
  const name = String(type || '').toLowerCase()
  if (name === 'email.delivered' || name === 'email.opened' || name === 'email.clicked') return 'delivered'
  if (name === 'email.bounced' || name === 'email.complained' || name === 'email.failed') return 'failed'
  if (name === 'email.sent' || name === 'email.delivery_delayed') return 'sent'
  return ''
}

export function providerStatusFromLastEvent(lastEvent) {
  const name = String(lastEvent || '').toLowerCase()
  if (name === 'delivered' || name === 'opened' || name === 'clicked') return 'delivered'
  if (name === 'bounced' || name === 'complained' || name === 'failed') return 'failed'
  if (name === 'sent' || name === 'delivery_delayed') return 'sent'
  return ''
}

/** Labels for customer booking emails. Admin-only notices are not included. */
const EVENT_LABELS = {
  payment_confirmation: 'Payment confirmation',
  driver_assigned: 'Driver assigned',
  driver_reassigned: 'Driver reassigned',
  status_on_way: 'Driver on the way',
  status_arrived_pickup: 'Arrived at pickup',
  status_pickup_completed: 'Pickup completed',
  status_in_transit: 'On the way to delivery',
  status_arrived_delivery: 'Arrived at delivery',
  status_completed: 'Job completed',
  tip_received: 'Tip received confirmation',
}

export function customerEmailEventLabel(eventKey) {
  const key = String(eventKey || '')
  if (key.startsWith('payment_confirmation')) return EVENT_LABELS.payment_confirmation
  return EVENT_LABELS[key] || key || 'Email'
}

export function isCustomerBookingEmail(eventKey) {
  const key = String(eventKey || '')
  return Boolean(key) && !key.startsWith('admin_')
}

/**
 * Provider-confirmed outcome. delivery_status stays the send lock and is only a fallback.
 * @returns {'sent'|'delivered'|'failed'|'pending'}
 */
export function displayProviderStatus(row) {
  const provider = String(row?.provider_status || '').toLowerCase()
  if (provider === 'delivered' || provider === 'sent' || provider === 'failed') return provider
  const delivery = String(row?.delivery_status || '').toLowerCase()
  if (delivery === 'failed' || delivery === 'error' || delivery === 'bounced' || delivery === 'complained') {
    return 'failed'
  }
  if (delivery === 'delivered') return 'delivered'
  if (delivery === 'pending') return 'pending'
  return 'sent'
}

export function providerStatusLabel(status) {
  if (status === 'delivered') return 'Delivered'
  if (status === 'failed') return 'Failed'
  if (status === 'pending') return 'Pending'
  return 'Sent'
}

/**
 * A later "sent" event must not wipe delivered or failed.
 * A failure from the provider replaces sent or delivered.
 */
export function nextProviderStatus(current, incoming) {
  const inc = String(incoming || '').toLowerCase()
  const cur = String(current || '').toLowerCase()
  if (inc === 'failed') return 'failed'
  if (cur === 'failed') return 'failed'
  if (inc === 'delivered' || cur === 'delivered') return 'delivered'
  return 'sent'
}

/**
 * One row per saved send, plus older notification rows that have no saved copy.
 * @param {{ notifications?: object[], archives?: object[], quote?: object }} input
 */
export function buildCustomerEmailList({ notifications = [], archives = [], quote = null } = {}) {
  const notes = (notifications || []).filter((row) => isCustomerBookingEmail(row?.event_key))
  const usedNoteIds = new Set()
  const rows = []

  for (const archive of archives || []) {
    if (!isCustomerBookingEmail(archive?.event_key)) continue
    const note = notes.find(
      (item) =>
        (archive.notification_id && item.id === archive.notification_id) ||
        (archive.provider_message_id &&
          item.provider_message_id &&
          item.provider_message_id === archive.provider_message_id),
    )
    if (note?.id) usedNoteIds.add(note.id)
    const html = String(archive.html_snapshot || '')
    rows.push({
      key: `archive:${archive.id}`,
      archiveId: archive.id,
      subject: archive.subject || note?.event_label || customerEmailEventLabel(archive.event_key),
      recipient: archive.recipient_email || note?.recipient_email || '',
      sentAt: archive.sent_at || note?.sent_at || archive.created_at,
      status: displayProviderStatus({
        provider_status: archive.provider_status || note?.provider_status,
        delivery_status: note?.delivery_status,
      }),
      hasSnapshot: html.trim().length > 0,
      html: html.trim() ? html : '',
      hasInvoice: Boolean(archive.invoice_path),
      invoiceFilename: archive.invoice_filename || 'invoice.pdf',
      eventKey: archive.event_key,
    })
  }

  for (const note of notes) {
    if (usedNoteIds.has(note.id)) continue
    rows.push({
      key: `note:${note.id}`,
      archiveId: null,
      subject: note.event_label || customerEmailEventLabel(note.event_key),
      recipient: note.recipient_email || '',
      sentAt: note.sent_at || note.created_at,
      status: displayProviderStatus(note),
      hasSnapshot: false,
      html: '',
      hasInvoice: false,
      invoiceFilename: '',
      eventKey: note.event_key,
    })
  }

  const hasPayment = rows.some((row) => String(row.eventKey || '').startsWith('payment_confirmation'))
  if (!hasPayment && quote?.payment_confirmation_email_sent_at) {
    rows.push({
      key: 'legacy-payment',
      archiveId: null,
      subject: 'Payment confirmation',
      recipient: quote.email || quote.customer_email || '',
      sentAt: quote.payment_confirmation_email_sent_at,
      status: 'sent',
      hasSnapshot: false,
      html: '',
      hasInvoice: false,
      invoiceFilename: '',
      eventKey: 'payment_confirmation',
    })
  }

  rows.sort((a, b) => new Date(b.sentAt || 0).getTime() - new Date(a.sentAt || 0).getTime())
  return rows
}

export function bookingInvoiceArchive(archives) {
  const withFile = (archives || []).filter((row) => row?.invoice_path)
  withFile.sort((a, b) => new Date(b.sent_at || 0).getTime() - new Date(a.sent_at || 0).getTime())
  return withFile[0] || null
}
