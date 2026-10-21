import {
  PHONE_QUOTE_DEPOSIT_GBP,
  phoneQuoteFinalTotal,
  phoneQuotePaymentOptions,
} from './phoneQuotePaymentRules.ts'

type QuoteRow = Record<string, unknown> & { id: string; quote_ref: string }

function esc(v: unknown) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function gbp(n: unknown) {
  const v = Number(n)
  return Number.isFinite(v) ? `£${v.toFixed(2)}` : '—'
}

function formatMoveDate(v: unknown) {
  const s = String(v || '').trim()
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return s || 'To be confirmed'
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12))
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

export function arrivalText(q: QuoteRow) {
  return String(q.arrival_window || q.arrival_time || '').trim()
}

const PUBLIC_LOGO_PATH = '/logo.png'

/**
 * Absolute logo URL for the message that is actually delivered.
 * Relative paths do not load in an inbox. A configured URL is used only when it returns an image.
 */
export async function resolvePhoneQuoteLogoUrl(site: string, candidate: string) {
  const base = String(site || '').trim().replace(/\/$/, '') || 'https://www.shiftmyhome.co.uk'
  const fallback = `${base}${PUBLIC_LOGO_PATH}`
  const raw = String(candidate || '').trim()
  const configured = /^https:\/\/.+/i.test(raw) && !/localhost|127\.0\.0\.1/i.test(raw) ? raw : ''
  for (const url of [configured, fallback]) {
    if (!url) continue
    try {
      const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(4000) })
      const type = (res.headers.get('content-type') || '').toLowerCase()
      if (res.ok && type.includes('image/')) return url
    } catch {
      /* try the public site logo */
    }
  }
  return fallback
}

export function inventoryRows(q: QuoteRow) {
  const inv = Array.isArray(q.inventory) ? q.inventory : []
  return inv
    .filter((r) => r && typeof r === 'object')
    .map((r: Record<string, unknown>) => ({
      name: String(r.name || 'Item').trim(),
      quantity: Math.max(1, Number(r.quantity) || 1),
    }))
}

export function buildPhoneQuoteEmail(
  q: QuoteRow,
  params: {
    link: string
    site: string
    logoUrl?: string
    supportEmail?: string
    now?: number
    paymentChoice?: 'deposit' | 'full' | ''
  },
) {
  const total = phoneQuoteFinalTotal(q)
  const opts = phoneQuotePaymentOptions({
    moveDate: q.move_date,
    arrivalTime: q.arrival_time,
    total,
    amountPaid: q.amount_paid,
    paymentStatus: q.payment_status,
    now: params.now ?? Date.now(),
  })
  const ref = String(q.quote_ref || '')
  const firstName = String(q.full_name || '').trim().split(/\s+/)[0] || 'there'
  const choice = params.paymentChoice === 'deposit' && opts.depositAllowed
    ? 'deposit'
    : params.paymentChoice === 'full'
      ? 'full'
      : ''
  const link = params.link
  const site = params.site
  const configuredLogo = String(params.logoUrl || '').trim()
  const siteBase = String(site || '').trim().replace(/\/$/, '') || 'https://www.shiftmyhome.co.uk'
  const logoUrl = /^https:\/\/.+/i.test(configuredLogo) && !/localhost|127\.0\.0\.1/i.test(configuredLogo)
    ? configuredLogo
    : `${siteBase}/logo.png`
  const supportEmail = String(params.supportEmail || '').trim() || 'bookings@shiftmyhome.co.uk'
  const items = inventoryRows(q)
  const moveDate = formatMoveDate(q.move_date)
  const arrival = arrivalText(q)
  const subject = `Your ShiftMyHome quote ${ref} — ${gbp(total)}`

  const depositLabel = `Pay £${PHONE_QUOTE_DEPOSIT_GBP} Deposit`
  const fullLabel = 'Pay in Full'
  const showBoth = choice === '' && opts.depositAllowed
  const payBase = String(link || '').replace(/([?&])pay=(deposit|full)/, '').replace(/[?&]$/, '')
  const withPay = (type: 'deposit' | 'full') => `${payBase}${payBase.includes('?') ? '&' : '?'}pay=${type}`
  const depositLink = withPay('deposit')
  const fullLink = withPay('full')
  const paymentLine = showBoth
    ? `Choose ${depositLabel} or ${fullLabel}. A £${PHONE_QUOTE_DEPOSIT_GBP} deposit leaves a remaining balance of ${gbp(opts.balanceAfterDeposit)}.`
    : choice === 'deposit'
      ? `Pay a ${gbp(opts.deposit)} deposit now. The remaining balance of ${gbp(opts.balanceAfterDeposit)} is paid later.`
      : `Pay ${gbp(total)} in full to confirm your booking.`
  const buttonLabel = showBoth ? `${depositLabel} or ${fullLabel}` : choice === 'deposit' ? depositLabel : fullLabel
  const buttonStyle =
    'display:inline-block;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 28px;border-radius:12px;'
  const buttonsHtml = showBoth
    ? `<a href="${esc(depositLink)}" target="_blank" rel="noopener noreferrer" style="${buttonStyle}background:#2563eb;margin:0 0 10px 0;">${esc(depositLabel)}</a><br />
  <a href="${esc(fullLink)}" target="_blank" rel="noopener noreferrer" style="${buttonStyle}background:#047857;">${esc(fullLabel)}</a>`
    : `<a href="${esc(choice === 'deposit' ? link : fullLink)}" target="_blank" rel="noopener noreferrer" style="${buttonStyle}background:#2563eb;">${esc(buttonLabel)}</a>`
  const linkHtml = showBoth
    ? `${esc(depositLabel)}: <a href="${esc(depositLink)}" style="color:#2563eb;word-break:break-all;">${esc(depositLink)}</a><br />${esc(fullLabel)}: <a href="${esc(fullLink)}" style="color:#2563eb;word-break:break-all;">${esc(fullLink)}</a>`
    : `<a href="${esc(choice === 'deposit' ? link : fullLink)}" style="color:#2563eb;word-break:break-all;">${esc(choice === 'deposit' ? link : fullLink)}</a>`

  const itemsHtml = items.length
    ? items
        .map(
          (it) =>
            `<tr><td style="padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#334155;">${esc(it.name)}</td><td align="right" style="padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a;font-weight:600;">×${it.quantity}</td></tr>`,
        )
        .join('')
    : `<tr><td style="padding:6px 0;font-size:14px;color:#64748b;">No items listed</td></tr>`

  const row = (label: string, value: string) =>
    value
      ? `<tr><td style="padding:6px 0;font-size:13px;color:#64748b;width:120px;vertical-align:top;">${esc(label)}</td><td style="padding:6px 0;font-size:14px;color:#0f172a;font-weight:600;">${esc(value)}</td></tr>`
      : ''

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#eff6ff;font-family:Inter,Segoe UI,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;">Your quote ${esc(ref)} for ${esc(moveDate)} is ready — ${esc(gbp(total))}.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eff6ff;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:18px;border:1px solid #dbeafe;">
<tr><td style="padding:20px 24px;">
  <a href="${esc(site)}" style="text-decoration:none;"><img src="${esc(logoUrl)}" width="170" alt="ShiftMyHome" style="display:block;width:170px;max-width:100%;height:auto;border:0;" /></a>
</td></tr>
<tr><td style="padding:0 24px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#1d4ed8;border-radius:14px;"><tr><td style="padding:22px;">
    <div style="font-size:26px;line-height:1.2;color:#ffffff;font-weight:800;">Your moving quote is ready</div>
    <div style="margin-top:6px;font-size:13px;color:#dbeafe;">Reference ${esc(ref)}</div>
  </td></tr></table>
</td></tr>
<tr><td style="padding:20px 24px 0 24px;font-size:15px;line-height:1.6;color:#334155;">
  Hi ${esc(firstName)},<br />Thanks for speaking with us. Here is your quote from ShiftMyHome. Check the details below and choose how you would like to pay.
</td></tr>
<tr><td style="padding:16px 24px 0 24px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:12px;"><tr><td style="padding:12px 16px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      ${row('Reference', ref)}
      ${row('Move date', moveDate)}
      ${row('Arrival', arrival)}
      ${row('Collection', String(q.pickup_address || ''))}
      ${row('Delivery', String(q.delivery_address || ''))}
    </table>
  </td></tr></table>
</td></tr>
<tr><td style="padding:14px 24px 0 24px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:12px;"><tr><td style="padding:12px 16px;">
    <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:6px;">Inventory</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${itemsHtml}</table>
  </td></tr></table>
</td></tr>
<tr><td style="padding:14px 24px 0 24px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;"><tr><td style="padding:16px;">
    <div style="font-size:13px;color:#065f46;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">Total price</div>
    <div style="font-size:30px;font-weight:800;color:#047857;margin-top:4px;">${esc(gbp(total))}</div>
    <div style="font-size:13px;color:#065f46;margin-top:6px;line-height:1.5;">${esc(paymentLine)}</div>
  </td></tr></table>
</td></tr>
<tr><td align="center" style="padding:22px 24px 6px 24px;">
  ${buttonsHtml}
</td></tr>
<tr><td style="padding:6px 24px 0 24px;font-size:12px;color:#64748b;text-align:center;line-height:1.5;">
  If a button does not work, copy this link:<br />${linkHtml}
</td></tr>
<tr><td style="padding:20px 24px 24px 24px;font-size:12px;color:#94a3b8;line-height:1.6;border-top:1px solid #f1f5f9;">
  Questions? Reply to this email or contact <a href="mailto:${esc(supportEmail)}" style="color:#2563eb;">${esc(supportEmail)}</a>.<br />
  ShiftMyHome · <a href="${esc(site)}" style="color:#2563eb;">${esc(site.replace(/^https?:\/\//, ''))}</a>
</td></tr>
</table>
</td></tr></table>
</body></html>`

  const text = [
    `Hi ${firstName},`,
    '',
    `Your ShiftMyHome quote ${ref} is ready.`,
    `Move date: ${moveDate}${arrival ? ` (${arrival})` : ''}`,
    `Collection: ${q.pickup_address || ''}`,
    `Delivery: ${q.delivery_address || ''}`,
    '',
    'Inventory:',
    ...(items.length ? items.map((it) => `- ${it.name} x${it.quantity}`) : ['- No items listed']),
    '',
    `Total price: ${gbp(total)}`,
    paymentLine,
    '',
    ...(showBoth
      ? [`${depositLabel}: ${depositLink}`, `${fullLabel}: ${fullLink}`]
      : [`${buttonLabel}: ${choice === 'deposit' ? link : fullLink}`]),
  ].join('\n')

  return { subject, html, text, link, total }
}

