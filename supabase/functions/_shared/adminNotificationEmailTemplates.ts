/**
 * Admin notification email templates (booking confirmed + abandoned quote).
 */

function escHtml(v: unknown) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export type AdminLeadEmailFields = {
  customerName: string
  telephone: string
  email: string
  collectionAddress: string
  deliveryAddress: string
  movingDate: string
  inventoryVolume: string
  inventorySummary?: string
  movers: string
  quotedPrice: string
  reference: string
  adminUrl: string
  bannerHtml?: string
}

function detailRow(label: string, value: string) {
  return `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;width:38%;vertical-align:top;">
        ${escHtml(label)}
      </td>
      <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f172a;font-weight:600;vertical-align:top;">
        ${escHtml(value || '—')}
      </td>
    </tr>`
}

function adminLeadEmailHtml(params: {
  title: string
  intro: string
  fields: AdminLeadEmailFields
  ctaLabel: string
}) {
  const f = params.fields
  const banner = f.bannerHtml || ''
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden;">
          <tr>
            <td style="padding:22px 24px 8px 24px;background:#0f172a;color:#ffffff;">
              <div style="font-size:12px;letter-spacing:0.06em;text-transform:uppercase;opacity:0.8;">ShiftMyHome Admin</div>
              <div style="font-size:20px;font-weight:700;margin-top:6px;line-height:1.3;">${escHtml(params.title)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px 8px 24px;">
              ${banner}
              <p style="margin:0 0 16px 0;font-size:14px;line-height:1.55;color:#475569;">${escHtml(params.intro)}</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                ${detailRow('Customer name', f.customerName)}
                ${detailRow('Telephone', f.telephone)}
                ${detailRow('Email', f.email)}
                ${detailRow('Collection', f.collectionAddress)}
                ${detailRow('Delivery', f.deliveryAddress)}
                ${detailRow('Moving date', f.movingDate)}
                ${detailRow('Inventory volume', f.inventoryVolume)}
                ${detailRow('Inventory items', f.inventorySummary || '—')}
                ${detailRow('Movers', f.movers)}
                ${detailRow('Quoted price', f.quotedPrice)}
                ${detailRow('Reference', f.reference)}
                ${detailRow('Admin link', f.adminUrl)}
              </table>
              <p style="margin:20px 0 8px 0;">
                <a href="${escHtml(f.adminUrl)}" style="display:inline-block;background:#0ea5e9;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 18px;border-radius:10px;">
                  ${escHtml(params.ctaLabel)}
                </a>
              </p>
              <p style="margin:0 0 8px 0;font-size:12px;color:#94a3b8;word-break:break-all;">${escHtml(f.adminUrl)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function adminLeadEmailText(params: {
  title: string
  intro: string
  fields: AdminLeadEmailFields
  ctaLabel: string
}) {
  const f = params.fields
  return [
    params.title,
    '',
    params.intro,
    '',
    `Customer name: ${f.customerName || '—'}`,
    `Telephone: ${f.telephone || '—'}`,
    `Email: ${f.email || '—'}`,
    `Collection: ${f.collectionAddress || '—'}`,
    `Delivery: ${f.deliveryAddress || '—'}`,
    `Moving date: ${f.movingDate || '—'}`,
    `Inventory volume: ${f.inventoryVolume || '—'}`,
    `Inventory items: ${f.inventorySummary || '—'}`,
    `Movers: ${f.movers || '—'}`,
    `Quoted price: ${f.quotedPrice || '—'}`,
    `Reference: ${f.reference || '—'}`,
    `Admin link: ${f.adminUrl || '—'}`,
    '',
    `${params.ctaLabel}: ${f.adminUrl}`,
  ].join('\n')
}

export function renderAdminBookingConfirmedEmail(fields: AdminLeadEmailFields) {
  const ref = fields.reference || 'Booking'
  const subject = `New Booking Confirmed – ${ref}`
  const title = 'New booking confirmed'
  const intro = 'A customer has completed booking / payment. Open the job in the admin dashboard.'
  return {
    subject,
    html: adminLeadEmailHtml({
      title,
      intro,
      fields,
      ctaLabel: 'Open booking in admin',
    }),
    text: adminLeadEmailText({ title, intro, fields, ctaLabel: 'Open booking' }),
  }
}

export function renderAdminAbandonedQuoteEmail(fields: AdminLeadEmailFields) {
  const name = fields.customerName || 'Customer'
  const ref = fields.reference || 'Lead'
  const subject = `Abandoned Quote – ${name} – ${ref}`
  const title = 'Abandoned quote'
  const intro =
    'This customer started a quote but did not complete booking within 30 minutes. Follow up from the lead in admin.'
  return {
    subject,
    html: adminLeadEmailHtml({
      title,
      intro,
      fields,
      ctaLabel: 'Open lead in admin',
    }),
    text: adminLeadEmailText({ title, intro, fields, ctaLabel: 'Open lead' }),
  }
}

/** Legacy Available Jobs test / older callers. */
export function renderAdminAvailableJobEmail(params: {
  quoteRef: string
  customerName: string
  serviceType?: string
  pickupLabel: string
  deliveryLabel: string
  moveDate: string
  estimatedTotal: string
  paymentStatus?: string
  volumeCrew?: string
  viewJobUrl: string
  bannerHtml?: string
  headerTitle?: string
  telephone?: string
  email?: string
  movers?: string
  inventoryVolume?: string
}) {
  const volumeCrew = String(params.volumeCrew || '')
  let inventoryVolume = params.inventoryVolume || '—'
  let movers = params.movers || '—'
  if (!params.inventoryVolume && !params.movers && volumeCrew && volumeCrew !== '—') {
    const parts = volumeCrew.split('·').map((p) => p.trim())
    if (parts[0]) inventoryVolume = parts[0]
    if (parts[1]) movers = parts[1]
  }
  return renderAdminBookingConfirmedEmail({
    customerName: params.customerName,
    telephone: params.telephone || '—',
    email: params.email || '—',
    collectionAddress: params.pickupLabel,
    deliveryAddress: params.deliveryLabel,
    movingDate: params.moveDate,
    inventoryVolume,
    movers,
    quotedPrice: params.estimatedTotal,
    reference: params.quoteRef,
    adminUrl: params.viewJobUrl,
    bannerHtml: params.bannerHtml,
  })
}
