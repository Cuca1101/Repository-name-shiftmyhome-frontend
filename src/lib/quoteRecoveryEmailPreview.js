/**
 * Client-side recovery email HTML preview (mirrors edge template content).
 */
import { formatDateUK } from './formatDateDisplay'
import { notesForCustomerEmail } from './customerLeadMoveSync'

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
 *   specialInstructions?: string,
 *   customerPhone?: string,
 *   customerEmail?: string,
 *   collectionAddress?: string,
 *   dropoffAddress?: string,
 *   collectionFloor?: string,
 *   dropoffFloor?: string,
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
  const customerNote =
    data.customerNote != null
      ? String(data.customerNote).trim()
      : String(data.specialInstructions || '').trim()
  const inventory = Array.isArray(data.inventoryLines) ? data.inventoryLines : []
  const phone = String(data.customerPhone || '').trim()
  const email = String(data.customerEmail || '').trim()
  const collection = String(data.collectionAddress || '').trim() || route
  const dropoff = String(data.dropoffAddress || '').trim() || '—'
  const collectionFloor = floorLabel(data.collectionFloor)
  const dropoffFloor = floorLabel(data.dropoffFloor)
  const year = new Date().getFullYear()
  const itemTotal = totalItemQuantity(inventory)
  const itemTotalLabel = itemTotal === 1 ? '1 item' : `${itemTotal} items`
  const invRows = inventoryRowsHtml(inventory, esc)

  const firstName = name.split(/\s+/)[0] || 'there'
  const payLabel = kind === 'payment_failed' ? 'Retry Payment' : 'Pay Now'
  const banner =
    kind === 'payment_failed'
      ? 'Payment unsuccessful'
      : kind === 'abandoned_final'
        ? 'Final reminder: your quote is still reserved'
        : kind === 'abandoned_reminder'
          ? 'Reminder: your quote is still reserved'
          : 'Your quote is still reserved'
  const introPlain =
    kind === 'payment_failed'
      ? `Hi ${firstName}, your payment for quote ${quoteRef} didn’t go through. No charge was made. You can retry payment or resume your quote below.`
      : kind === 'abandoned_final'
        ? `Hi ${firstName}, this is your final reminder. Your quote is still reserved — resume or pay now to secure your move.`
        : kind === 'abandoned_reminder'
          ? `Hi ${firstName}, just a reminder that your ShiftMyHome quote is still reserved and ready to finish.`
          : `Hi ${firstName}, you left before completing payment. Good news — your quote is still reserved.`
  const intro = `Hi ${esc(firstName)},<br />${esc(introPlain.replace(/^Hi [^,]+, /, ''))}`
  const subject =
    kind === 'payment_failed'
      ? `Your ShiftMyHome quote ${quoteRef} — payment unsuccessful`
      : `Your ShiftMyHome quote ${quoteRef} — ${total}`
  const priceReason = String(data.priceReason || '').trim()
  const unpaidLine = kind === 'payment_failed' ? 'Not paid. No charge was made.' : 'Not paid yet.'
  const wasLabel = calculated != null ? `£${calculated.toFixed(2)}` : ''
  const reducedBy =
    hasOverride && agreed != null && calculated != null && calculated - agreed > 0.009
      ? calculated - agreed
      : 0
  const priceNote = hasOverride
    ? reducedBy
      ? `${unpaidLine} Was ${wasLabel}. Reduced by £${reducedBy.toFixed(2)}. Amount to pay ${total}.`
      : `${unpaidLine} Was ${wasLabel}. Amount to pay ${total}.`
    : `${unpaidLine} Amount to pay ${total}.`
  const priceBox = `<div style="font-size:13px;color:#065f46;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">Amount to pay</div>
    ${hasOverride ? `<div style="margin-top:6px;font-size:16px;line-height:1.3;color:#64748b;">Was <span style="text-decoration:line-through;">${esc(wasLabel)}</span></div>` : ''}
    <div style="font-size:30px;font-weight:800;color:#047857;margin-top:2px;">${esc(total)}</div>
    <div style="font-size:13px;color:#065f46;margin-top:6px;line-height:1.5;">${esc(priceNote)}</div>`
  const logoUrl = `${siteUrl}/logo.png`
  const splitLines = (value) =>
    String(value || '')
      .split(/\s*,\s*/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => esc(part))
      .join('<br />')
  const detailLabel =
    'font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;'
  const detailValue = 'margin-top:4px;font-size:13px;font-weight:600;line-height:1.4;color:#0f172a;'
  const buttonStyle =
    'display:inline-block;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 28px;border-radius:12px;'
  const includedHtml = priceReason
    ? `<div style="margin-top:12px;padding-top:10px;border-top:1px solid #f1f5f9;"><span style="display:inline-block;background:#ecfdf5;color:#047857;font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;border:1px solid #a7f3d0;border-radius:999px;padding:3px 8px;">Included in price</span><div style="margin-top:6px;font-size:14px;line-height:1.55;color:#334155;white-space:pre-wrap;">${esc(priceReason)}</div></div>`
    : ''
  const notesBlock =
    customerNote || priceReason
      ? `<tr><td style="padding:14px 24px 0 24px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:12px;"><tr><td style="padding:12px 16px;"><div style="font-size:15px;font-weight:700;color:#0f172a;">Special instructions</div>${customerNote ? `<div style="margin-top:6px;font-size:14px;line-height:1.55;color:#334155;white-space:pre-wrap;">${esc(customerNote)}</div>` : ''}${includedHtml}</td></tr></table></td></tr>`
      : ''

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#eff6ff;font-family:Inter,Segoe UI,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;">Your quote ${esc(quoteRef)} for ${esc(moveDate)} is still reserved — ${esc(total)}.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eff6ff;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:18px;border:1px solid #dbeafe;overflow:hidden;">
<tr><td style="padding:20px 24px;">
  <a href="${esc(siteUrl)}" style="text-decoration:none;"><img src="${esc(logoUrl)}" width="170" alt="ShiftMyHome" style="display:block;width:170px;max-width:100%;height:auto;border:0;" /></a>
</td></tr>
<tr><td style="padding:0 24px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#1d4ed8;border-radius:14px;"><tr><td style="padding:22px;">
    <div style="font-size:26px;line-height:1.2;color:#ffffff;font-weight:800;">${esc(banner)}</div>
    <div style="margin-top:6px;font-size:13px;color:#dbeafe;">Reference ${esc(quoteRef)}</div>
  </td></tr></table>
</td></tr>
<tr><td style="padding:20px 24px 0 24px;font-size:15px;line-height:1.6;color:#334155;">
  ${intro}
</td></tr>
<tr><td style="padding:16px 24px 0 24px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:12px;"><tr><td style="padding:12px 14px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td width="34%" valign="top" style="width:34%;padding-right:10px;border-right:1px solid #f1f5f9;">
          <div style="${detailLabel}">Name</div>
          <div style="${detailValue}">${esc(name)}</div>
          ${phone ? `<div style="margin-top:4px;font-size:12px;line-height:1.4;color:#334155;">${esc(phone)}</div>` : ''}
          ${email ? `<div style="margin-top:2px;font-size:12px;line-height:1.4;color:#334155;word-break:break-all;">${esc(email)}</div>` : ''}
        </td>
        <td width="33%" valign="top" style="width:33%;padding:0 10px;border-right:1px solid #f1f5f9;">
          <div style="${detailLabel}">Collection</div>
          <div style="${detailValue}">${splitLines(collection)}</div>
          ${collectionFloor ? `<div style="margin-top:4px;font-size:12px;line-height:1.4;color:#475569;">${esc(collectionFloor)}</div>` : ''}
        </td>
        <td width="33%" valign="top" style="width:33%;padding-left:10px;">
          <div style="${detailLabel}">Drop-off</div>
          <div style="${detailValue}">${splitLines(dropoff)}</div>
          ${dropoffFloor ? `<div style="margin-top:4px;font-size:12px;line-height:1.4;color:#475569;">${esc(dropoffFloor)}</div>` : ''}
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:10px;border-top:1px solid #f1f5f9;">
      <tr>
        <td width="34%" valign="top" style="width:34%;padding:8px 10px 0 0;">
          <div style="${detailLabel}">Move date</div>
          <div style="${detailValue}">${esc(moveDate)}</div>
        </td>
        <td width="33%" valign="top" style="width:33%;padding:8px 10px 0 10px;">
          <div style="${detailLabel}">Service</div>
          <div style="${detailValue}">${esc(service)}</div>
        </td>
        <td width="33%" valign="top" style="width:33%;padding:8px 0 0 10px;">
          <div style="${detailLabel}">Crew</div>
          <div style="${detailValue}">${esc(crew)}</div>
        </td>
      </tr>
    </table>
  </td></tr></table>
</td></tr>
<tr><td style="padding:14px 24px 0 24px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:12px;"><tr><td style="padding:12px 16px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:6px;"><tr>
      <td style="font-size:15px;font-weight:700;color:#0f172a;">Inventory</td>
      <td align="right" style="font-size:13px;font-weight:700;color:#1d4ed8;">${esc(itemTotalLabel)}</td>
    </tr></table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${invRows}</table>
  </td></tr></table>
</td></tr>
${notesBlock}
<tr><td style="padding:14px 24px 0 24px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;"><tr><td style="padding:16px;">
    ${priceBox}
  </td></tr></table>
</td></tr>
<tr><td align="center" style="padding:22px 24px 6px 24px;">
  <a href="${esc(payUrl)}" target="_blank" rel="noopener noreferrer" style="${buttonStyle}background:#2563eb;margin:0 0 10px 0;">${esc(payLabel)}</a><br />
  <a href="${esc(resumeUrl)}" target="_blank" rel="noopener noreferrer" style="${buttonStyle}background:#1d4ed8;">Resume Quote</a>
</td></tr>
<tr><td style="padding:6px 24px 0 24px;font-size:12px;color:#64748b;text-align:center;line-height:1.5;">
  If a button does not work, copy this link:<br />
  ${esc(payLabel)}: <a href="${esc(payUrl)}" style="color:#2563eb;word-break:break-all;">${esc(payUrl)}</a><br />
  Resume Quote: <a href="${esc(resumeUrl)}" style="color:#2563eb;word-break:break-all;">${esc(resumeUrl)}</a>
</td></tr>
<tr><td style="padding:18px 24px 0 24px;font-size:14px;line-height:1.55;color:#334155;">
  Kind regards,<br /><strong style="color:#0f172a;">The ShiftMyHome Team</strong>
</td></tr>
<tr><td style="padding:18px 24px 22px 24px;font-size:12px;line-height:1.65;background:#0f172a;color:#e2e8f0;">
  <strong style="color:#ffffff;font-size:13px;">ShiftMyHome Ltd</strong><br />
  128 City Road, London, EC1V 2NX<br />
  Company number 16730159<br />
  <a href="tel:+441414614813" style="color:#e2e8f0;text-decoration:none;">0141 461 4813</a>
  &nbsp;·&nbsp;
  <a href="mailto:admin@shiftmyhome.co.uk" style="color:#e2e8f0;text-decoration:none;">admin@shiftmyhome.co.uk</a>
  &nbsp;·&nbsp;
  <a href="${esc(siteUrl)}" style="color:#93c5fd;text-decoration:none;">www.shiftmyhome.co.uk</a><br />
  <a href="${esc(siteUrl)}/terms" style="color:#94a3b8;text-decoration:none;">Terms</a>
  <span style="color:#64748b;"> · © ${year} ShiftMyHome Ltd</span>
</td></tr>
</table>
</td></tr></table>
</body></html>`

  const text = [
    banner,
    '',
    introPlain,
    name,
    phone || null,
    email || null,
    `Collection: ${collection}${collectionFloor ? ` · ${collectionFloor}` : ''}`,
    `Drop-off: ${dropoff}${dropoffFloor ? ` · ${dropoffFloor}` : ''}`,
    `Quote: ${quoteRef}`,
    `Items: ${itemTotalLabel}`,
    `Crew: ${crew}`,
    `Total: ${total}`,
    '',
    hasOverride ? `Was: ${wasLabel}` : null,
    hasOverride && reducedBy ? `Reduced by: £${reducedBy.toFixed(2)}` : null,
    customerNote ? `Special instructions: ${customerNote}` : null,
    priceReason ? `Included in price: ${priceReason}` : null,
    '',
    `Resume: ${resumeUrl}`,
    `Pay: ${payUrl}`,
    '',
    'Kind regards,',
    'The ShiftMyHome Team',
    '',
    'ShiftMyHome Ltd',
    '128 City Road, London, EC1V 2NX',
    'Company number 16730159',
    '0141 461 4813 · admin@shiftmyhome.co.uk · www.shiftmyhome.co.uk',
    `${siteUrl}/terms`,
  ].filter((line) => line != null).join('\n')

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

const FLOOR_LABELS = {
  '-1': 'Basement',
  0: 'Ground Floor',
  1: '1st Floor',
  2: '2nd Floor',
  3: '3rd Floor',
  4: '4th Floor',
  5: '5th Floor',
  6: '6th Floor',
  7: '7th Floor',
  8: '8th Floor',
  9: '9th Floor',
  10: '10+ Floors',
}

/** @param {unknown} value */
function floorLabel(value) {
  if (value == null || value === '') return ''
  const n = Number(value)
  if (Number.isFinite(n) && FLOOR_LABELS[n]) return FLOOR_LABELS[n]
  const text = String(value).trim()
  if (/ground/i.test(text)) return 'Ground Floor'
  return text
}

/**
 * A short list stays in one column. A long list uses three columns so the email stays short.
 * @param {Array<{ name?: string, label?: string, qty?: number, quantity?: number }>} inventory
 * @param {(value: unknown) => string} escapeHtml
 */
/** Sum of quantities, so two sofas and one table count as 3 items. */
function totalItemQuantity(inventory) {
  if (!Array.isArray(inventory)) return 0
  return inventory.reduce((sum, line) => {
    const qty = Number(line?.qty ?? line?.quantity ?? 1)
    return sum + (Number.isFinite(qty) && qty > 0 ? qty : 0)
  }, 0)
}

function inventoryRowsHtml(inventory, escapeHtml) {
  if (!inventory.length) {
    return `<tr><td style="padding:6px 0;font-size:14px;color:#64748b;">No items listed</td></tr>`
  }
  const items = inventory.map((line) => ({
    label: String(line.name || line.label || 'Item').trim() || 'Item',
    qty: Number(line.qty ?? line.quantity ?? 1) || 1,
  }))
  if (items.length < 6) {
    return items
      .map(
        (item) =>
          `<tr><td style="padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#334155;">${escapeHtml(item.label)}</td><td align="right" style="padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a;font-weight:600;">×${item.qty}</td></tr>`,
      )
      .join('')
  }
  const rows = []
  for (let i = 0; i < items.length; i += 3) {
    const slice = items.slice(i, i + 3)
    while (slice.length < 3) slice.push(null)
    rows.push(
      `<tr>${slice
        .map((item) =>
          item
            ? `<td width="33%" valign="top" style="width:33%;padding:6px 8px 6px 0;border-bottom:1px solid #f1f5f9;font-size:13px;line-height:1.35;color:#334155;">${escapeHtml(item.label)} <span style="color:#0f172a;font-weight:600;white-space:nowrap;">×${item.qty}</span></td>`
            : `<td width="33%" style="width:33%;padding:6px 0;border-bottom:1px solid #f1f5f9;">&nbsp;</td>`,
        )
        .join('')}</tr>`,
    )
  }
  return rows.join('')
}

/**
 * Build inventory + crew from lead wizard_data for emails/admin.
 * @param {Record<string, unknown>|null|undefined} lead
 */
export function recoveryContentFromLead(lead) {
  const wd = lead?.wizard_data && typeof lead.wizard_data === 'object' ? lead.wizard_data : {}
  const s1 = wd.step1 && typeof wd.step1 === 'object' ? wd.step1 : {}
  const s2 = wd.step2 && typeof wd.step2 === 'object' ? wd.step2 : {}
  const s3 = wd.step3 && typeof wd.step3 === 'object' ? wd.step3 : {}
  const notes = notesForCustomerEmail(lead)
  return {
    customerName: lead?.customer_name || s2.fullName || '',
    customerPhone: lead?.customer_phone || s2.phone || '',
    customerEmail: lead?.customer_email || s2.email || '',
    collectionAddress: lead?.pickup_address || s1.pickupAddress || '',
    dropoffAddress: lead?.delivery_address || s1.deliveryAddress || '',
    collectionFloor: s1.pickupFloor,
    dropoffFloor: s1.deliveryFloor,
    quoteRef: lead?.quote_ref || lead?.lead_ref || '',
    routeLabel: lead?.route_label || '',
    serviceType: lead?.service_type || '',
    moveDate: lead?.move_date || s3.selectedMoveDate || '',
    crewSize: s3.crewSize ?? s2.crewSize ?? null,
    inventoryLines: Array.isArray(s2.inventoryLines) ? s2.inventoryLines : [],
    estimatedTotal: lead?.estimated_total ?? s3.estimatedTotal ?? null,
    calculatedTotal: lead?.calculated_total ?? lead?.estimated_total ?? s3.estimatedTotal ?? null,
    agreedPrice: lead?.agreed_price ?? null,
    customerNote: notes.customer,
    adminNote: notes.admin,
    priceReason: String(lead?.price_override_reason || '').trim(),
  }
}
