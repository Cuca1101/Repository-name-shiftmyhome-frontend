/**
 * Premium email template for extra charge payment requests sent to customers.
 */

function escHtml(v: unknown) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatCurrency(amount: number, currency: string) {
  const symbol = currency.toUpperCase() === 'GBP' ? '£' : currency.toUpperCase() === 'EUR' ? '€' : '$'
  return `${symbol}${amount.toFixed(2)}`
}

type AddedItem = {
  name?: string
  quantity?: number
  volume_m3?: number
  notes?: string
}

export function renderExtraChargeEmailTemplate(params: {
  bookingReference: string
  customerName: string
  approvedAmount: number
  currency: string
  addedItems: AddedItem[]
  paymentLink: string
  supportEmail: string
  reason?: string
}): { subject: string; html: string; text: string } {
  const { bookingReference, customerName, approvedAmount, currency, addedItems, paymentLink, supportEmail, reason } = params

  const formattedAmount = formatCurrency(approvedAmount, currency)
  const greeting = customerName ? `Hi ${escHtml(customerName)},` : 'Hi,'

  const itemsHtml = addedItems.length
    ? addedItems
        .map(
          (item) =>
            `<tr>
              <td style="padding:6px 10px;font-size:14px;color:#334155;border-bottom:1px solid #f1f5f9;">${escHtml(item.name || 'Item')}</td>
              <td style="padding:6px 10px;font-size:14px;color:#334155;border-bottom:1px solid #f1f5f9;text-align:center;">${item.quantity ?? 1}</td>
              <td style="padding:6px 10px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9;">${escHtml(item.notes || '—')}</td>
            </tr>`,
        )
        .join('')
    : '<tr><td colspan="3" style="padding:8px 10px;font-size:14px;color:#64748b;">Additional items as discussed with your driver.</td></tr>'

  const itemsText = addedItems.length
    ? addedItems.map((item) => `  • ${item.name || 'Item'} x${item.quantity ?? 1}${item.notes ? ` (${item.notes})` : ''}`).join('\n')
    : '  Additional items as discussed with your driver.'

  const subject = `[ShiftMyHome] Additional charges for booking ${bookingReference || 'your move'}`

  const html = `<!doctype html>
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
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Additional charges for your booking${bookingReference ? ` ${escHtml(bookingReference)}` : ''}</div>
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#eff6ff;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table class="smh-shell" role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;border-collapse:separate;border-spacing:0;border:1px solid #dbeafe;">
            <!-- Header -->
            <tr>
              <td class="smh-pad" style="padding:20px 24px 18px 24px;background:linear-gradient(180deg,#ffffff,#f8fbff);">
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="left">
                      <span style="display:inline-block;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:28px;line-height:1.1;font-weight:800;letter-spacing:-0.02em;color:#0f172a;">
                        ShiftMy<span style="color:#2563eb;">Home</span>
                      </span>
                    </td>
                    <td align="right" style="font-size:12px;line-height:1.4;color:#1e3a8a;font-weight:700;">
                      Trusted UK Removals
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Hero Banner -->
            <tr>
              <td class="smh-pad" style="padding:0 24px 0 24px;">
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:14px;">
                  <tr>
                    <td style="padding:24px 22px;">
                      <div style="font-size:26px;line-height:1.2;color:#ffffff;font-weight:800;letter-spacing:-0.02em;">
                        Additional Charges
                      </div>
                      <div style="margin-top:8px;font-size:13px;line-height:1.45;color:#fef3c7;">
                        Extra items were added during your move and require payment.
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td class="smh-pad" style="padding:20px 24px 0 24px;">
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:0 0 14px 0;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
                  <tr>
                    <td style="padding:18px 18px 6px 18px;font-size:15px;line-height:1.6;color:#334155;">
                      ${greeting}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 18px 12px 18px;font-size:14px;line-height:1.6;color:#475569;">
                      ${reason ? escHtml(reason) : 'During your move, additional items were identified that were not included in your original quote. Your driver has submitted an extra charge request which has been reviewed and approved by our team.'}
                    </td>
                  </tr>
                  ${bookingReference ? `<tr><td style="padding:0 18px 6px 18px;font-size:14px;color:#334155;"><strong>Booking reference:</strong> ${escHtml(bookingReference)}</td></tr>` : ''}
                  <tr><td style="padding:4px 18px 16px 18px;"></td></tr>
                </table>
              </td>
            </tr>

            <!-- Items table -->
            <tr>
              <td class="smh-pad" style="padding:0 24px 0 24px;">
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:0 0 14px 0;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
                  <tr>
                    <td style="padding:16px 18px 8px 18px;font-size:16px;line-height:1.3;color:#0f172a;font-weight:700;">
                      Items Added
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 12px 12px 12px;">
                      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                        <tr style="background:#f8fafc;">
                          <td style="padding:8px 10px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Item</td>
                          <td style="padding:8px 10px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;text-align:center;">Qty</td>
                          <td style="padding:8px 10px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Notes</td>
                        </tr>
                        ${itemsHtml}
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Amount & Pay button -->
            <tr>
              <td class="smh-pad" style="padding:0 24px 0 24px;">
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:0 0 14px 0;border-collapse:separate;border-spacing:0;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;">
                  <tr>
                    <td style="padding:18px 18px;text-align:center;">
                      <div style="font-size:14px;color:#92400e;font-weight:600;">Amount due</div>
                      <div style="font-size:32px;font-weight:800;color:#92400e;margin:4px 0;">${escHtml(formattedAmount)}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td class="smh-pad" style="padding:0 24px 16px 24px;text-align:center;">
                <a href="${escHtml(paymentLink)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:16px;line-height:1.2;font-weight:700;padding:16px 32px;border-radius:12px;">
                  Pay ${escHtml(formattedAmount)} now
                </a>
                <div style="margin-top:10px;font-size:12px;color:#64748b;">Secure payment powered by Stripe</div>
              </td>
            </tr>

            <!-- Support -->
            <tr>
              <td class="smh-pad" style="padding:0 24px 14px 24px;">
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                  <tr>
                    <td style="padding:14px 18px;font-size:13px;line-height:1.6;color:#475569;">
                      <strong>Questions?</strong> Reply to this email or contact us at
                      <a href="mailto:${escHtml(supportEmail)}" style="color:#2563eb;text-decoration:none;font-weight:600;">${escHtml(supportEmail)}</a>.
                      We are happy to explain any charges.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
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
                      &copy; ShiftMyHome Ltd — All rights reserved
                    </td>
                  </tr>
                  <tr>
                    <td class="smh-pad" style="padding:0 24px 6px 24px;text-align:center;font-size:13px;line-height:1.6;">
                      <a href="https://www.shiftmyhome.co.uk/terms" target="_blank" rel="noopener noreferrer" style="color:#93c5fd;text-decoration:none;">Terms</a>
                      <span style="color:#475569;padding:0 8px;">|</span>
                      <a href="https://www.shiftmyhome.co.uk/privacy" target="_blank" rel="noopener noreferrer" style="color:#93c5fd;text-decoration:none;">Privacy</a>
                      <span style="color:#475569;padding:0 8px;">|</span>
                      <a href="mailto:${escHtml(supportEmail)}" style="color:#93c5fd;text-decoration:none;">Contact Us</a>
                    </td>
                  </tr>
                  <tr>
                    <td class="smh-pad" style="padding:0 24px 18px 24px;text-align:center;font-size:12px;color:#94a3b8;">
                      <a href="https://www.shiftmyhome.co.uk" style="color:#93c5fd;text-decoration:none;">www.shiftmyhome.co.uk</a>
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
</html>`

  const text = [
    subject,
    '',
    greeting.replace(/,?$/, ''),
    '',
    reason || 'During your move, additional items were identified that were not included in your original quote.',
    '',
    bookingReference ? `Booking reference: ${bookingReference}` : '',
    '',
    'Items added:',
    itemsText,
    '',
    `Amount due: ${formatCurrency(approvedAmount, currency)}`,
    '',
    `Pay now: ${paymentLink}`,
    '',
    `Questions? Contact us at ${supportEmail}`,
    '',
    'Kind regards,',
    'ShiftMyHome Team',
    'www.shiftmyhome.co.uk',
  ]
    .filter((line) => line !== undefined)
    .join('\n')

  return { subject, html, text }
}
