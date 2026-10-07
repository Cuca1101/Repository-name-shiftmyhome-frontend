import { formatDateUK } from './formatDateDisplay'
import { buildJobTrackingUrl, customerJobStatusLabel } from './jobCustomerTracking'

const GOOGLE_REVIEW_URL = 'https://g.page/r/CWmwRUPz2dC7EAE/review'

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function text(value) {
  const s = String(value ?? '').trim()
  return s || '—'
}

function firstName(fullName) {
  const n = String(fullName || '').trim()
  if (!n) return 'there'
  return n.split(/\s+/)[0] || 'there'
}

function shell({ title, intro, rows = [], primary, secondary = [], footerNote = '' }) {
  const rowsHtml = rows
    .filter((row) => String(row.value || '').trim())
    .map(
      (row) =>
        `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;">${esc(row.label)}</td><td style="padding:6px 0;text-align:right;color:#0f172a;font-size:13px;font-weight:600;">${esc(row.value)}</td></tr>`,
    )
    .join('')
  const primaryHtml = primary?.url
    ? `<p style="margin:20px 0 10px;"><a href="${esc(primary.url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#0284c7;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px;">${esc(primary.label)}</a></p>`
    : ''
  const secondaryHtml = secondary
    .filter((item) => item?.url)
    .map(
      (item) =>
        `<a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:0 8px 8px 0;background:#0f172a;color:#fff;text-decoration:none;font-weight:700;padding:10px 14px;border-radius:10px;font-size:13px;">${esc(item.label)}</a>`,
    )
    .join('')
  const footer = footerNote
    ? `<p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">${esc(footerNote)}</p>`
    : ''
  return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Inter,Segoe UI,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 12px;"><tr><td align="center">
  <table width="560" style="max-width:560px;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:12px;"><tr><td style="padding:24px;">
    <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">${esc(title)}</h1>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#475569;">${esc(intro)}</p>
    <table width="100%">${rowsHtml}</table>
    ${primaryHtml}
    ${secondaryHtml ? `<p style="margin:8px 0 0;">${secondaryHtml}</p>` : ''}
    ${footer}
  </td></tr></table>
  </td></tr></table></body></html>`
}

/**
 * Preview for a customer email when the saved HTML copy is missing.
 * Uses the booking on screen. It does not send mail.
 * @param {{ quote?: Record<string, unknown>, eventKey?: string, trackingToken?: string }} input
 */
export function buildCustomerSentEmailPreview({ quote = {}, eventKey = '', trackingToken = '' } = {}) {
  const key = String(eventKey || '').split(':')[0]
  const name = text(quote.full_name) === '—' ? 'there' : String(quote.full_name).trim()
  const quoteRef = text(quote.quote_ref || quote.id)
  const driverName = text(quote.assigned_driver_name) === '—' ? 'Your driver' : String(quote.assigned_driver_name).trim()
  const track = trackingToken ? buildJobTrackingUrl(trackingToken) : ''
  const moveDate = quote.move_date ? formatDateUK(quote.move_date) : ''

  if (key === 'payment_confirmation' || key === 'payment_received') {
    return shell({
      title: 'Payment received successfully',
      intro:
        'Thank you for choosing ShiftMyHome. Your payment has been received successfully and your move is now being prepared by our team.',
      rows: [
        { label: 'Booking reference', value: quoteRef },
        { label: 'Payment status', value: 'Paid' },
        { label: 'Collection', value: String(quote.pickup_address || '').trim() },
        { label: 'Delivery', value: String(quote.delivery_address || '').trim() },
      ],
      footerNote: 'Your invoice/receipt PDF is attached to this email.',
    })
  }

  if (key === 'status_completed') {
    const first = firstName(quote.full_name)
    const tipHref = trackingToken ? `${track}/tip` : ''
    // Match buildJobCompletedThankYouEmailHtml (edge) so Admin Preview matches the sent email.
    return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 12px;"><tr><td align="center">
  <table width="560" style="max-width:560px;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:12px;"><tr><td style="padding:28px 24px;">
    <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#334155;">Hi ${esc(first)},</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#334155;">
      Thank you for choosing ShiftMyHome for your move. We hope everything went smoothly and that you were happy with the service provided by our team.
    </p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#334155;">
      Your feedback means a lot to us and helps other customers choose a reliable moving company.
    </p>
    <p style="margin:0 0 24px;">
      <a href="${esc(GOOGLE_REVIEW_URL)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#0284c7;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:10px;font-size:15px;">⭐ Leave us a Google Review</a>
    </p>
    <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#0f172a;">Would you like to thank your moving team?</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#475569;">
      If you feel the team did a great job, you can optionally leave them a tip. This is completely optional and there is absolutely no obligation.
    </p>
    ${
      tipHref
        ? `<p style="margin:0 0 24px;">
      <a href="${esc(tipHref)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:10px;font-size:15px;">💷 Leave a Tip</a>
    </p>`
        : ''
    }
    <p style="margin:0 0 8px;font-size:15px;line-height:1.55;color:#334155;">Thank you again for trusting ShiftMyHome with your move.</p>
    <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:#0f172a;">The ShiftMyHome Team</p>
    <p style="margin:0;font-size:13px;color:#94a3b8;">Moving made simple.</p>
  </td></tr></table>
  </td></tr></table>
</body></html>`
  }

  if (key === 'driver_assigned' || key === 'driver_reassigned') {
    const updated = key === 'driver_reassigned'
    return shell({
      title: updated ? 'Your driver has been updated' : 'Your driver has been assigned',
      intro: updated
        ? `Hi ${name}, we’ve assigned a new driver to your booking.`
        : `Hi ${name}, a driver has been assigned to your paid booking.`,
      rows: [
        { label: 'Booking reference', value: quoteRef },
        { label: 'Move date', value: moveDate },
        { label: 'Arrival window', value: String(quote.arrival_window || '').trim() },
        { label: 'Pickup', value: String(quote.pickup_address || '').trim() },
        { label: 'Delivery', value: String(quote.delivery_address || '').trim() },
        { label: 'Driver', value: driverName },
      ],
      primary: track ? { label: 'View My Booking', url: track } : null,
      footerNote: 'This link is private to your booking.',
    })
  }

  if (key === 'status_on_way') {
    return shell({
      title: 'Your driver is on the way',
      intro: `Hi ${name}, ${driverName} is on the way to your pickup.`,
      rows: [
        { label: 'Booking reference', value: quoteRef },
        { label: 'Driver', value: driverName },
        { label: 'Status', value: customerJobStatusLabel('on_way') },
      ],
      primary: track ? { label: 'Track My Driver', url: track } : null,
    })
  }

  if (key.startsWith('status_')) {
    const label = customerJobStatusLabel(key.replace('status_', ''))
    return shell({
      title: label,
      intro: `Hi ${name}, your booking status is now: ${label}.`,
      rows: [
        { label: 'Booking reference', value: quoteRef },
        { label: 'Driver', value: driverName },
        { label: 'Status', value: label },
      ],
      primary: track ? { label: 'Track My Driver', url: track } : null,
    })
  }

  if (key === 'tip_received') {
    return shell({
      title: 'Tip payment received',
      intro: `Hi ${name}, thank you — your tip has been received.`,
      rows: [{ label: 'Booking reference', value: quoteRef }],
      primary: track ? { label: 'View My Booking', url: track } : null,
    })
  }

  return shell({
    title: 'Booking update',
    intro: `Hi ${name}, here’s an update on your ShiftMyHome booking.`,
    rows: [{ label: 'Booking reference', value: quoteRef }],
    primary: track ? { label: 'View My Booking', url: track } : null,
  })
}
