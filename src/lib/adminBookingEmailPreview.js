import { formatDateUK } from './formatDateDisplay.js'

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

function money(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return '—'
  return `£${n.toFixed(2)}`
}

function row(label, value) {
  return `<tr>
    <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;width:38%;vertical-align:top;">${esc(label)}</td>
    <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f172a;font-weight:600;vertical-align:top;">${esc(value)}</td>
  </tr>`
}

function inventorySummary(quote) {
  const names = []
  const push = (name, qty) => {
    const label = String(name || '').trim()
    if (label.length < 2) return
    const n = Number(qty)
    const quantity = Number.isFinite(n) && n > 1 ? Math.round(n) : 1
    names.push(quantity > 1 ? `${label} ×${quantity}` : label)
  }
  const raw = quote?.inventory
  const rows = Array.isArray(raw) ? raw : raw && Array.isArray(raw.items) ? raw.items : []
  for (const item of rows) {
    if (!item || typeof item !== 'object') continue
    push(item.item_name || item.name || item.label, item.quantity || item.qty)
  }
  const lines = String(quote?.inventory_text || '')
  for (const line of lines.split(/[\r\n]+|•/g)) {
    const segment = line.trim().replace(/^[-*·•]\s*/, '')
    if (!segment) continue
    push(segment.replace(/(?:×|x)\s*\d+/gi, '').trim(), (segment.match(/(?:×|x)\s*(\d+)/i) || [])[1])
  }
  return names.slice(0, 12).join(', ') || '—'
}

function quotedPrice(quote) {
  const paid = Number(quote?.amount_paid)
  if (Number.isFinite(paid) && paid > 0) return money(paid)
  return money(quote?.agreed_price ?? quote?.calculated_total ?? quote?.estimated_total)
}

function volumeLabel(quote) {
  const direct = Number(quote?.total_volume_m3)
  if (Number.isFinite(direct) && direct > 0) return `${direct.toFixed(2)} m³`
  const raw = String(quote?.pricing || '')
  const match = raw.match(/total\s*([\d.]+)\s*m³/i)
  const parsed = match ? Number(match[1]) : NaN
  if (Number.isFinite(parsed) && parsed > 0) return `${parsed.toFixed(2)} m³`
  return '—'
}

function moversLabel(quote) {
  const n = Number(quote?.crew_size)
  if (!Number.isFinite(n) || n <= 0) return '—'
  const count = Math.round(n)
  return `${count} ${count === 1 ? 'mover' : 'movers'}`
}

/**
 * Same admin email that is sent when a paid job enters Available Jobs.
 * Preview only — this does not send mail.
 * @param {Record<string, unknown>} quote
 */
export function buildAdminBookingEmailPreview(quote) {
  const q = quote && typeof quote === 'object' ? quote : {}
  const reference = text(q.quote_ref || q.id)
  const id = String(q.id || '').trim()
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://www.shiftmyhome.co.uk'
  const adminUrl = id ? `${origin}/admin/available-jobs/${encodeURIComponent(id)}` : `${origin}/admin/available-jobs`
  const subject = `New Booking Confirmed – ${reference === '—' ? 'Booking' : reference}`
  const title = 'New booking confirmed'
  const intro = 'A customer has completed booking / payment. Open the job in the admin dashboard.'
  const fields = [
    ['Customer name', text(q.full_name || q.customer_name)],
    ['Telephone', text(q.phone)],
    ['Email', text(q.email)],
    ['Collection', text(q.pickup_address)],
    ['Delivery', text(q.delivery_address)],
    ['Moving date', q.move_date ? formatDateUK(q.move_date) : '—'],
    ['Inventory volume', volumeLabel(q)],
    ['Inventory items', inventorySummary(q)],
    ['Movers', moversLabel(q)],
    ['Quoted price', quotedPrice(q)],
    ['Reference', reference],
    ['Admin link', adminUrl],
  ]
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden;">
        <tr><td style="padding:22px 24px 8px 24px;background:#0f172a;color:#ffffff;">
          <div style="font-size:12px;letter-spacing:0.06em;text-transform:uppercase;opacity:0.8;">ShiftMyHome Admin</div>
          <div style="font-size:20px;font-weight:700;margin-top:6px;line-height:1.3;">${esc(title)}</div>
        </td></tr>
        <tr><td style="padding:20px 24px 8px 24px;">
          <p style="margin:0 0 16px 0;font-size:14px;line-height:1.55;color:#475569;">${esc(intro)}</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            ${fields.map(([label, value]) => row(label, value)).join('')}
          </table>
          <p style="margin:20px 0 8px 0;">
            <a href="${esc(adminUrl)}" style="display:inline-block;background:#0ea5e9;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 18px;border-radius:10px;">Open booking in admin</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
  return { subject, html }
}
