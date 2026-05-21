type EmailTemplateKind =
  | 'payment_received'
  | 'booking_confirmed'
  | 'driver_assigned'
  | 'move_reminder'
  | 'invoice_receipt'
  | 'quote_created'

type BrandConfig = {
  companyName: string
  supportEmail: string
  websiteUrl: string
  companyAddress: string
  companyNumber: string
  logoUrl: string
  termsUrl: string
  privacyUrl: string
  contactUrl: string
}

type EmailTemplateData = {
  previewText?: string
  title: string
  intro: string
  bookingReference?: string
  paymentStatus?: string
  collectionSummary?: string
  deliverySummary?: string
  invoiceAttachedMessage?: string
  supportMessage?: string
  paymentSectionTitle?: string
  paymentSectionBody?: string
  invoiceSectionTitle?: string
  invoiceSectionBody?: string
  actionLabel?: string
  actionUrl?: string
  invoiceDownloadUrl?: string
}

type RenderResult = {
  subject: string
  html: string
  text: string
}

function escHtml(v: unknown) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function optionalRow(label: string, value?: string) {
  if (!value || !value.trim()) return ''
  return `
    <tr>
      <td style="padding:8px 0 0 0;font-size:14px;line-height:1.45;color:#334155;">
        <strong style="color:#0f172a;">${escHtml(label)}:</strong> ${escHtml(value)}
      </td>
    </tr>
  `
}

function cardBlock(title: string, body: string) {
  return `
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:0 0 14px 0;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
      <tr>
        <td style="padding:16px 18px 12px 18px;font-size:16px;line-height:1.3;color:#0f172a;font-weight:700;">
          ${escHtml(title)}
        </td>
      </tr>
      <tr>
        <td style="padding:0 18px 16px 18px;font-size:14px;line-height:1.6;color:#475569;">
          ${escHtml(body)}
        </td>
      </tr>
    </table>
  `
}

function baseLayout(params: { subject: string; data: EmailTemplateData; brand: BrandConfig }) {
  const { subject, data, brand } = params
  const heroTitle = data.title || subject
  const preview = data.previewText || data.intro || subject

  const actionButton =
    data.actionLabel && data.actionUrl
      ? `
      <tr>
        <td style="padding:4px 0 0 0;">
          <a href="${escHtml(data.actionUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#0ea5e9;color:#ffffff;text-decoration:none;font-size:14px;line-height:1.2;font-weight:700;padding:12px 18px;border-radius:10px;">
            ${escHtml(data.actionLabel)}
          </a>
        </td>
      </tr>
    `
      : ''

  const showCompanyNumber = Boolean(brand.companyNumber && brand.companyNumber.trim() && brand.companyNumber.trim().toUpperCase() !== 'N/A')
  const logoBlock = brand.logoUrl
    ? `
      <a href="${escHtml(brand.websiteUrl)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
        <img src="${escHtml(brand.logoUrl)}" width="170" alt="${escHtml(brand.companyName)}" style="display:block;width:170px;max-width:100%;height:auto;border:0;" />
      </a>
    `
    : `
      <a href="${escHtml(brand.websiteUrl)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
        <span style="display:inline-block;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:28px;line-height:1.1;font-weight:800;letter-spacing:-0.02em;color:#0f172a;">
          ShiftMy<span style="color:#2563eb;">Home</span>
        </span>
      </a>
    `

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escHtml(subject)}</title>
    <style>
      @media only screen and (max-width: 620px) {
        .smh-shell { width: 100% !important; }
        .smh-pad { padding-left: 14px !important; padding-right: 14px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#eff6ff;font-family:Inter,Segoe UI,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escHtml(preview)}</div>
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#eff6ff;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table class="smh-shell" role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;border-collapse:separate;border-spacing:0;border:1px solid #dbeafe;">
            <tr>
              <td class="smh-pad" style="padding:20px 24px 18px 24px;background:linear-gradient(180deg,#ffffff,#f8fbff);">
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="left">
                      ${logoBlock}
                    </td>
                    <td align="right" style="font-size:12px;line-height:1.4;color:#1e3a8a;font-weight:700;">
                      Trusted UK Removals
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td class="smh-pad" style="padding:0 24px 0 24px;">
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background:linear-gradient(135deg,#2563eb,#1d4ed8);border-radius:14px;">
                  <tr>
                    <td style="padding:24px 22px;">
                      <div style="font-size:30px;line-height:1.2;color:#ffffff;font-weight:800;letter-spacing:-0.02em;">
                        ${escHtml(heroTitle)}
                      </div>
                      <div style="margin-top:8px;font-size:13px;line-height:1.45;color:#dbeafe;">
                        Professional moving support, prepared with care by the ShiftMyHome team.
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td class="smh-pad" style="padding:20px 24px 0 24px;">
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:0 0 14px 0;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
                  <tr>
                    <td style="padding:18px 18px 6px 18px;font-size:15px;line-height:1.6;color:#334155;">
                      ${escHtml(data.intro)}
                    </td>
                  </tr>
                  ${optionalRow('Booking reference', data.bookingReference)}
                  ${optionalRow('Payment status', data.paymentStatus)}
                  ${optionalRow('Collection', data.collectionSummary)}
                  ${optionalRow('Delivery', data.deliverySummary)}
                  ${optionalRow('Invoice', data.invoiceAttachedMessage)}
                  ${optionalRow('Support', data.supportMessage)}
                  <tr><td style="padding:8px 18px 16px 18px;"></td></tr>
                </table>
              </td>
            </tr>

            <tr>
              <td class="smh-pad" style="padding:0 24px 0 24px;">
                ${data.paymentSectionTitle && data.paymentSectionBody ? cardBlock(data.paymentSectionTitle, data.paymentSectionBody) : ''}
                ${data.invoiceSectionTitle && data.invoiceSectionBody ? cardBlock(data.invoiceSectionTitle, data.invoiceSectionBody) : ''}
              </td>
            </tr>

            <tr>
              <td class="smh-pad" style="padding:0 24px 16px 24px;">
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                  ${actionButton}
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:0 24px;">
                <div style="height:1px;background:#e2e8f0;line-height:1px;font-size:1px;">&nbsp;</div>
              </td>
            </tr>

            <tr>
              <td style="padding:0;">
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#0f172a;">
                  <tr>
                    <td class="smh-pad" style="padding:18px 24px 8px 24px;font-size:13px;line-height:1.6;color:#cbd5e1;text-align:center;">
                      &copy; ${escHtml(brand.companyName)} — All rights reserved
                    </td>
                  </tr>
                  <tr>
                    <td class="smh-pad" style="padding:0 24px 6px 24px;text-align:center;font-size:13px;line-height:1.6;">
                      <a href="${escHtml(brand.termsUrl)}" target="_blank" rel="noopener noreferrer" style="color:#93c5fd;text-decoration:none;">Terms &amp; Conditions</a>
                      <span style="color:#475569;padding:0 8px;">|</span>
                      <a href="${escHtml(brand.privacyUrl)}" target="_blank" rel="noopener noreferrer" style="color:#93c5fd;text-decoration:none;">Privacy Policy</a>
                      <span style="color:#475569;padding:0 8px;">|</span>
                      <a href="${escHtml(brand.contactUrl)}" target="_blank" rel="noopener noreferrer" style="color:#93c5fd;text-decoration:none;">Contact Us</a>
                    </td>
                  </tr>
                  <tr>
                    <td class="smh-pad" style="padding:0 24px 4px 24px;text-align:center;font-size:13px;line-height:1.6;color:#cbd5e1;">
                      ${escHtml(brand.companyName)} Ltd
                    </td>
                  </tr>
                  <tr>
                    <td class="smh-pad" style="padding:0 24px 4px 24px;text-align:center;font-size:13px;line-height:1.6;color:#cbd5e1;">
                      ${escHtml(brand.companyAddress)}
                    </td>
                  </tr>
                  <tr>
                    <td class="smh-pad" style="padding:0 24px 4px 24px;text-align:center;font-size:13px;line-height:1.6;">
                      <a href="mailto:${escHtml(brand.supportEmail)}" style="color:#93c5fd;text-decoration:none;">${escHtml(brand.supportEmail)}</a>
                    </td>
                  </tr>
                  <tr>
                    <td class="smh-pad" style="padding:0 24px 4px 24px;text-align:center;font-size:13px;line-height:1.6;">
                      <a href="${escHtml(brand.websiteUrl)}" target="_blank" rel="noopener noreferrer" style="color:#93c5fd;text-decoration:none;">${escHtml(brand.websiteUrl)}</a>
                    </td>
                  </tr>
                  ${showCompanyNumber ? `<tr><td class="smh-pad" style="padding:0 24px 8px 24px;text-align:center;font-size:13px;line-height:1.6;color:#94a3b8;">Company number: ${escHtml(brand.companyNumber)}</td></tr>` : ''}
                  <tr>
                    <td class="smh-pad" style="padding:0 24px 18px 24px;text-align:center;">
                      <a href="${escHtml(brand.websiteUrl)}" style="display:inline-block;width:30px;height:30px;line-height:30px;border-radius:999px;background:#1e293b;color:#ffffff;text-decoration:none;font-size:14px;margin:0 4px;">f</a>
                      <a href="${escHtml(brand.websiteUrl)}" style="display:inline-block;width:30px;height:30px;line-height:30px;border-radius:999px;background:#1e293b;color:#ffffff;text-decoration:none;font-size:14px;margin:0 4px;">x</a>
                      <a href="${escHtml(brand.websiteUrl)}" style="display:inline-block;width:30px;height:30px;line-height:30px;border-radius:999px;background:#1e293b;color:#ffffff;text-decoration:none;font-size:14px;margin:0 4px;">in</a>
                      <a href="${escHtml(brand.websiteUrl)}" style="display:inline-block;width:30px;height:30px;line-height:30px;border-radius:999px;background:#1e293b;color:#ffffff;text-decoration:none;font-size:14px;margin:0 4px;">ig</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`
}

function paymentReceivedTemplate(payload: {
  quoteRef: string
  paymentStatus: string
  collectionSummary: string
  deliverySummary: string
  supportEmail: string
  invoiceDownloadUrl?: string
}) {
  const data: EmailTemplateData = {
    previewText: `Payment received for booking ${payload.quoteRef}`,
    title: 'Payment received successfully',
    intro:
      'Thank you for choosing ShiftMyHome. Your payment has been received successfully and your move is now being prepared by our team.',
    bookingReference: payload.quoteRef,
    paymentStatus: payload.paymentStatus,
    collectionSummary: payload.collectionSummary,
    deliverySummary: payload.deliverySummary,
    invoiceAttachedMessage: payload.invoiceDownloadUrl
      ? 'Your invoice/receipt PDF is attached to this email. If your mail app hides attachments, use the Download Invoice PDF button below.'
      : 'Your invoice/receipt PDF is attached to this email.',
    supportMessage: `For any questions, contact ${payload.supportEmail}.`,
    paymentSectionTitle: 'Payment confirmation',
    paymentSectionBody:
      'Your payment has been processed successfully. We will confirm your move details shortly.',
    invoiceSectionTitle: 'Invoice / receipt',
    invoiceSectionBody:
      payload.invoiceDownloadUrl
        ? 'Your official invoice/receipt PDF is attached. You can also use the secure download link below as backup.'
        : 'This email includes your official invoice/receipt PDF attachment for your records.',
    actionLabel: payload.invoiceDownloadUrl ? 'Download Invoice PDF' : undefined,
    actionUrl: payload.invoiceDownloadUrl || undefined,
  }
  return {
    /** ASCII-only subject (matches isolated Resend test; avoids MIME edge cases). */
    subject: `[ShiftMyHome] Payment received (${payload.quoteRef})`,
    data,
    text: [
      'Payment successful',
      '',
      'Thank you for choosing ShiftMyHome. Your payment has been received successfully and your move is now being prepared by our team.',
      '',
      `Your booking reference: ${payload.quoteRef}`,
      `Payment status: ${payload.paymentStatus}`,
      `Collection: ${payload.collectionSummary}`,
      `Delivery: ${payload.deliverySummary}`,
      '',
      payload.invoiceDownloadUrl
        ? `Download invoice PDF: ${payload.invoiceDownloadUrl}`
        : 'Your invoice/receipt is attached to this email.',
      '',
      'We will confirm your move details shortly.',
      '',
      'Kind regards,',
      'ShiftMyHome Team',
    ].join('\n'),
  }
}

function simpleTemplate(subject: string, title: string, intro: string): { subject: string; data: EmailTemplateData; text: string } {
  const data: EmailTemplateData = {
    previewText: intro,
    title,
    intro,
    paymentSectionTitle: 'Update',
    paymentSectionBody: intro,
    invoiceSectionTitle: 'Support',
    invoiceSectionBody: 'If you need help, reply to this email and our team will assist you.',
  }
  return { subject, data, text: `${title}\n\n${intro}` }
}

export function renderTransactionalEmailTemplate(params: {
  kind: EmailTemplateKind
  brand: BrandConfig
  paymentPayload?: {
    quoteRef: string
    paymentStatus: string
    collectionSummary: string
    deliverySummary: string
    invoiceDownloadUrl?: string
  }
}): RenderResult {
  const { kind, brand, paymentPayload } = params

  let built: { subject: string; data: EmailTemplateData; text: string }
  if (kind === 'payment_received' && paymentPayload) {
    built = paymentReceivedTemplate({
      ...paymentPayload,
      supportEmail: brand.supportEmail,
    })
  } else if (kind === 'booking_confirmed') {
    built = simpleTemplate(
      'Booking confirmed – ShiftMyHome',
      'Booking confirmed',
      'Your booking has been confirmed. We look forward to helping with your move.',
    )
  } else if (kind === 'driver_assigned') {
    built = simpleTemplate(
      'Driver assigned – ShiftMyHome',
      'Driver assigned',
      'A driver has been assigned to your booking. We will share any further updates shortly.',
    )
  } else if (kind === 'move_reminder') {
    built = simpleTemplate(
      'Move reminder – ShiftMyHome',
      'Move reminder',
      'This is a reminder about your upcoming move. Please review your details and contact us if anything changed.',
    )
  } else if (kind === 'invoice_receipt') {
    built = simpleTemplate(
      'Invoice receipt – ShiftMyHome',
      'Invoice receipt',
      'Your invoice/receipt is ready. Please keep this email for your records.',
    )
  } else {
    built = simpleTemplate(
      'Quote created – ShiftMyHome',
      'Quote created',
      'Your quote has been created successfully. Our team will review it and contact you shortly.',
    )
  }

  const html = baseLayout({ subject: built.subject, data: built.data, brand })
  return { subject: built.subject, html, text: built.text }
}
