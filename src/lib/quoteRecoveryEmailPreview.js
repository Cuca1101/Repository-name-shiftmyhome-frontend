/**
 * Client-side recovery email HTML preview (mirrors edge template content).
 */
import { formatDateUK } from './formatDateDisplay'

/**
 * @param {{
 *   kind: 'abandoned' | 'abandoned_reminder' | 'abandoned_final' | 'payment_failed',
 *   customerName?: string,
 *   quoteRef?: string,
 *   routeLabel?: string,
 *   serviceType?: string,
 *   moveDate?: string,
 *   crewSize?: string|number|null,
 *   inventoryLines?: Array<{ name?: string, label?: string, qty?: number, quantity?: number }>,
 *   estimatedTotal?: number|null,
 *   agreedPrice?: number|null,
 *   calculatedTotal?: number|null,
 *   resumeUrl?: string,
 *   payUrl?: string,
 *   siteUrl?: string,
 * }} data
 */
export function buildQuoteRecoveryEmailPreview(data) {
  const kind = data.kind || 'abandoned'
  const name = String(data.customerName || 'there').trim() || 'there'
  const quoteRef = String(data.quoteRef || '').trim() || '—'
  const route = String(data.routeLabel || '').trim() || '—'
  const service = String(data.serviceType || '').trim() || '—'
  const moveDate = formatDateUK(data.moveDate)
  const crew = data.crewSize != null && String(data.crewSize).trim() ? String(data.crewSize) : '—'
  const agreed =
    data.agreedPrice != null && Number.isFinite(Number(data.agreedPrice))
      ? Number(data.agreedPrice)
      : null
  const calculated =
    data.calculatedTotal != null && Number.isFinite(Number(data.calculatedTotal))
      ? Number(data.calculatedTotal)
      : data.estimatedTotal != null && Number.isFinite(Number(data.estimatedTotal))
        ? Number(data.estimatedTotal)
        : null
  const charge = agreed ?? calculated
  const total = charge != null ? `£${charge.toFixed(2)}` : '—'
  const hasOverride =
    agreed != null && calculated != null && Math.abs(agreed - calculated) > 0.009
  const resumeUrl = data.resumeUrl || '#'
  const payUrl = data.payUrl || '#'
  const siteUrl = (data.siteUrl || 'https://www.shiftmyhome.co.uk').replace(/\/$/, '')

  const inventory = Array.isArray(data.inventoryLines) ? data.inventoryLines : []
  const invRows = inventory.length
    ? inventory
        .map((line) => {
          const label = String(line.name || line.label || 'Item').trim()
          const qty = Number(line.qty ?? line.quantity ?? 1) || 1
          return `<tr><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;">${esc(label)}</td><td style="padding:6px 0;border-bottom:1px solid #e2e8f0;text-align:right;">×${qty}</td></tr>`
        })
        .join('')
    : `<tr><td colspan="2" style="padding:6px 0;color:#64748b;">No inventory items saved</td></tr>`

  const titles = {
    abandoned: 'Your quote is still reserved',
    abandoned_reminder: 'Reminder: your quote is waiting',
    abandoned_final: 'Final reminder: complete your booking',
    payment_failed: 'Payment unsuccessful — retry anytime',
  }
  const intros = {
    abandoned: `Hi ${esc(name)}, you left before completing payment. Good news — your quote is still reserved.`,
    abandoned_reminder: `Hi ${esc(name)}, just a reminder that your ShiftMyHome quote is still reserved and ready to finish.`,
    abandoned_final: `Hi ${esc(name)}, this is your final reminder. Your quote is still reserved — resume or pay now to secure your move.`,
    payment_failed: `Hi ${esc(name)}, your payment for quote ${esc(quoteRef)} didn’t go through. No charge was made — you can retry payment or resume your quote below.`,
  }

  const subject =
    kind === 'payment_failed'
      ? `[ShiftMyHome] Payment failed — retry for ${quoteRef}`
      : `[ShiftMyHome] Your quote ${quoteRef} is still reserved`

  const html = `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Inter,Segoe UI,Arial,sans-serif;">
  <div style="max-width:560px;margin:24px auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">
    <h1 style="margin:0 0 8px;font-size:22px;color:#0f172a;">${titles[kind] || titles.abandoned}</h1>
    <p style="margin:0 0 16px;color:#475569;line-height:1.55;">${intros[kind] || intros.abandoned}</p>
    <table width="100%" style="font-size:14px;color:#334155;margin-bottom:16px;">
      <tr><td style="padding:4px 0;"><strong>Quote</strong></td><td style="padding:4px 0;text-align:right;">${esc(quoteRef)}</td></tr>
      <tr><td style="padding:4px 0;"><strong>Route</strong></td><td style="padding:4px 0;text-align:right;">${esc(route)}</td></tr>
      <tr><td style="padding:4px 0;"><strong>Service</strong></td><td style="padding:4px 0;text-align:right;">${esc(service)}</td></tr>
      <tr><td style="padding:4px 0;"><strong>Move date</strong></td><td style="padding:4px 0;text-align:right;">${esc(moveDate)}</td></tr>
      <tr><td style="padding:4px 0;"><strong>Crew</strong></td><td style="padding:4px 0;text-align:right;">${esc(crew)}</td></tr>
      ${
        hasOverride
          ? `<tr><td style="padding:4px 0;"><strong>Calculated price</strong></td><td style="padding:4px 0;text-align:right;">£${calculated.toFixed(2)}</td></tr>
      <tr><td style="padding:4px 0;"><strong>Agreed price</strong></td><td style="padding:4px 0;text-align:right;font-weight:700;color:#0f172a;">${esc(total)}</td></tr>`
          : `<tr><td style="padding:4px 0;"><strong>Total</strong></td><td style="padding:4px 0;text-align:right;font-weight:700;color:#0f172a;">${esc(total)}</td></tr>`
      }
    </table>
    <h2 style="font-size:15px;margin:0 0 8px;color:#0f172a;">Inventory</h2>
    <table width="100%" style="font-size:14px;color:#334155;margin-bottom:20px;">${invRows}</table>
    <p style="margin:0 0 12px;">
      <a href="${esc(resumeUrl)}" style="display:inline-block;background:#0284c7;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px;">Resume Quote</a>
    </p>
    <p style="margin:0 0 16px;">
      <a href="${esc(payUrl)}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px;">${kind === 'payment_failed' ? 'Retry Payment' : 'Pay Now'}</a>
    </p>
    <p style="margin:0;font-size:12px;color:#94a3b8;">ShiftMyHome · <a href="${esc(siteUrl)}" style="color:#64748b;">${esc(siteUrl.replace(/^https?:\/\//, ''))}</a></p>
  </div>
</body></html>`

  const text = [
    titles[kind] || titles.abandoned,
    '',
    (intros[kind] || intros.abandoned).replace(/<[^>]+>/g, ''),
    `Quote: ${quoteRef}`,
    `Route: ${route}`,
    `Service: ${service}`,
    `Move date: ${moveDate}`,
    `Crew: ${crew}`,
    `Total: ${total}`,
    '',
    `Resume: ${resumeUrl}`,
    `Pay: ${payUrl}`,
  ].join('\n')

  return { subject, html, text }
}

/** @param {unknown} v */
function esc(v) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * Build inventory + crew from lead wizard_data for emails/admin.
 * @param {Record<string, unknown>|null|undefined} lead
 */
export function recoveryContentFromLead(lead) {
  const wd = lead?.wizard_data && typeof lead.wizard_data === 'object' ? lead.wizard_data : {}
  const s2 = wd.step2 && typeof wd.step2 === 'object' ? wd.step2 : {}
  const s3 = wd.step3 && typeof wd.step3 === 'object' ? wd.step3 : {}
  return {
    customerName: lead?.customer_name || s2.fullName || '',
    quoteRef: lead?.quote_ref || '',
    routeLabel: lead?.route_label || '',
    serviceType: lead?.service_type || '',
    moveDate: lead?.move_date || s3.selectedMoveDate || '',
    crewSize: s3.crewSize ?? s2.crewSize ?? null,
    inventoryLines: Array.isArray(s2.inventoryLines) ? s2.inventoryLines : [],
    estimatedTotal: lead?.estimated_total ?? s3.estimatedTotal ?? null,
    calculatedTotal: lead?.calculated_total ?? lead?.estimated_total ?? s3.estimatedTotal ?? null,
    agreedPrice: lead?.agreed_price ?? null,
  }
}
