/**
 * HTML for quote-based Job Sheet PDF (captured via PdfGenerator html2canvas + jsPDF).
 * Compact operational layout — stacked text, minimal decoration.
 */

/**
 * @param {unknown} v
 */
function escapeHtml(v) {
  if (v == null) return ''
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const FONT = 'Arial,Helvetica,sans-serif'
const BODY = `margin:0;padding:0;background:#fff;color:#111827;font-family:${FONT};font-size:11px;line-height:1.4;`
const H1 = 'margin:0;font-size:13px;font-weight:700;color:#1e40af;'
const RULE = 'border:none;border-top:1px solid #cbd5e1;margin:8px 0;'
const LABEL = 'font-weight:700;color:#374151;'
const MUTED = 'color:#6b7280;font-size:10px;'
const BLOCK = 'margin:0 0 2px;'
const HEAD = 'margin:10px 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#111827;'

/**
 * @param {string} label
 * @param {string} value
 */
function line(label, value) {
  if (!value || value === 'N/A') return ''
  return `<p style="${BLOCK}"><span style="${LABEL}">${escapeHtml(label)}:</span> ${escapeHtml(value)}</p>`
}

/**
 * @param {string} title
 * @param {string} bodyHtml
 */
function block(title, bodyHtml) {
  if (!bodyHtml.trim()) return ''
  return `<h2 style="${HEAD}">${escapeHtml(title)}</h2>${bodyHtml}`
}

/** Minimal one-page fallback if model is missing. */
export function buildMinimalJobSheetHtml() {
  return `
    <div id="job-sheet-pdf-root" style="max-width:100%;${BODY}">
      <div id="job-sheet-pdf-main" style="padding:12px 14px;">
        <p style="${H1}">ShiftMyHome</p>
        <p style="margin:8px 0 0;">Job Sheet PDF — capture pipeline OK. Reload the job and try again.</p>
      </div>
    </div>
  `
}

/**
 * @param {ReturnType<import('./buildJobSheetPdfModel').buildJobSheetPdfModel>} model
 */
export function buildQuoteJobSheetHtml(model) {
  const notices = (model.operationalNotices || [])
    .map(
      (n) =>
        `<p style="margin:0 0 3px;padding:3px 6px;background:#fef9c3;border-left:3px solid #eab308;font-size:10px;color:#713f12;">${escapeHtml(n)}</p>`,
    )
    .join('')

  const invRows =
    model.inventory.length > 0
      ? model.inventory
          .map(
            (r) => `
        <tr>
          <td style="padding:3px 6px 3px 0;text-align:center;width:28px;border-bottom:1px solid #e5e7eb;">${escapeHtml(r.qty)}</td>
          <td style="padding:3px 6px;border-bottom:1px solid #e5e7eb;">${escapeHtml(r.item)}</td>
          <td style="padding:3px 0 3px 6px;border-bottom:1px solid #e5e7eb;font-size:10px;color:#4b5563;">${escapeHtml(r.volume)}${r.notes !== 'N/A' ? ` · ${escapeHtml(r.notes)}` : ''}</td>
        </tr>`,
          )
          .join('')
      : `<tr><td colspan="3" style="padding:6px 0;color:#6b7280;font-style:italic;">No inventory lines on file.</td></tr>`

  const bullets =
    model.specialInstructionsBullets && model.specialInstructionsBullets.length > 0
      ? `<ul style="margin:4px 0 0;padding:0 0 0 16px;">${model.specialInstructionsBullets.map((b) => `<li style="margin:0 0 3px;">${escapeHtml(b)}</li>`).join('')}</ul>`
      : `<p style="margin:4px 0 0;color:#6b7280;">No special instructions provided.</p>`

  const pickupBody = [
    line('Contact', model.pickup.contactName),
    line('Phone', model.pickup.phone),
    line('Address', model.pickup.address),
    line('Floor', model.pickup.floor),
    line('Lift', model.pickup.lift),
    line('Parking', model.pickup.parking),
    line('Walking distance', model.pickup.walking),
    line('Notes', model.pickup.accessNotes),
  ].join('')

  const deliveryBody = [
    line('Contact', model.delivery.contactName),
    line('Phone', model.delivery.phone),
    line('Address', model.delivery.address),
    line('Floor', model.delivery.floor),
    line('Lift', model.delivery.lift),
    line('Parking', model.delivery.parking),
    line('Walking distance', model.delivery.walking),
    line('Notes', model.delivery.accessNotes),
  ].join('')

  const crewLines = [
    model.crewLine ? `<p style="${BLOCK}">${escapeHtml(model.crewLine)}</p>` : '',
    model.move.service !== 'N/A' ? `<p style="${BLOCK}">${escapeHtml(model.move.service)}</p>` : '',
    model.move.volume !== 'N/A' ? `<p style="${BLOCK}">${escapeHtml(model.move.volume)}</p>` : '',
    model.operations.driver !== 'N/A' ? `<p style="${BLOCK}"><span style="${LABEL}">Driver:</span> ${escapeHtml(model.operations.driver)}</p>` : '',
    model.operations.partner !== 'N/A' ? `<p style="${BLOCK}"><span style="${LABEL}">Partner:</span> ${escapeHtml(model.operations.partner)}</p>` : '',
  ]
    .filter(Boolean)
    .join('')

  const podSection = `
    <div id="job-sheet-pdf-checkin" style="page-break-before:always;padding:12px 14px 0;${BODY}">
      <p style="${H1}">ShiftMyHome — Proof of delivery</p>
      <p style="${MUTED}margin:2px 0 10px;">${escapeHtml(model.quoteRef)} · ${escapeHtml(model.customer.name)}</p>
      <hr style="${RULE}" />

      <p style="${HEAD}margin-top:0;">Overall condition</p>
      <p style="margin:0 0 10px;font-size:10px;">☐ Brand New &nbsp;&nbsp; ☐ Good &nbsp;&nbsp; ☐ Average &nbsp;&nbsp; ☐ Poor</p>

      <p style="${HEAD}">Existing damage / notes</p>
      <div style="min-height:40px;border-bottom:1px solid #9ca3af;margin-bottom:10px;">&nbsp;</div>

      <p style="${BLOCK}"><span style="${LABEL}">Furniture / items collected at:</span> _________________________________</p>
      <p style="margin:0 0 10px;"><span style="${LABEL}">Furniture / items delivered at:</span> _________________________________</p>

      <p style="${HEAD}">Shipment received in same condition</p>
      <p style="margin:0 0 10px;font-size:10px;">☐ Yes &nbsp;&nbsp;&nbsp; ☐ No</p>

      <p style="${HEAD}">Transporter / driver sign off</p>
      <div style="height:32px;border-bottom:1px solid #9ca3af;margin-bottom:10px;">&nbsp;</div>

      <p style="${HEAD}">Customer sign off</p>
      <div style="height:32px;border-bottom:1px solid #9ca3af;margin-bottom:10px;">&nbsp;</div>

      <p style="margin:0;font-size:9px;line-height:1.45;color:#4b5563;">
        <strong>Delivery confirmation:</strong> I confirm goods were collected and delivered as described on this job sheet, subject to any damage or exceptions noted above.
      </p>
      <p style="${MUTED}margin-top:8px;">${escapeHtml(model.footer.disclaimer)}</p>
    </div>
  `

  return `
    <div id="job-sheet-pdf-root" style="max-width:100%;width:100%;${BODY}">
      <div id="job-sheet-pdf-main" style="padding:10px 14px 14px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:6px;">
          <tr>
            <td style="vertical-align:top;">
              <p style="${H1}">ShiftMyHome</p>
              <p style="margin:3px 0 0;font-size:12px;font-weight:700;color:#111827;">${escapeHtml(model.titleLine)}</p>
            </td>
            <td style="vertical-align:top;text-align:right;width:100px;">
              <span style="display:inline-block;padding:2px 6px;font-size:9px;font-weight:700;background:${model.paymentBadge.bg};color:${model.paymentBadge.color};">${escapeHtml(model.paymentBadge.label)}</span>
            </td>
          </tr>
        </table>

        <hr style="${RULE}" />

        <p style="${HEAD}margin-top:0;">Job booked by</p>
        ${line('Name', model.customer.name)}
        ${line('Phone', model.customer.phone)}
        ${line('Email', model.customer.email)}

        <div style="margin:8px 0;">${notices}</div>

        <p style="margin:0 0 10px;font-size:10px;line-height:1.45;">${escapeHtml(model.jobSummaryLine)}</p>

        <hr style="${RULE}" />

        ${block('Pickup', pickupBody)}
        ${block('Delivery', deliveryBody)}

        ${crewLines ? `<hr style="${RULE}" />${block('Crew / service', crewLines)}` : ''}

        <hr style="${RULE}" />
        <h2 style="${HEAD}">Inventory</h2>
        <table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:10px;">
          <thead>
            <tr>
              <th style="text-align:center;padding:0 6px 4px 0;font-size:9px;font-weight:700;color:#6b7280;border-bottom:1px solid #9ca3af;width:28px;">Qty</th>
              <th style="text-align:left;padding:0 6px 4px;font-size:9px;font-weight:700;color:#6b7280;border-bottom:1px solid #9ca3af;">Item</th>
              <th style="text-align:left;padding:0 0 4px 6px;font-size:9px;font-weight:700;color:#6b7280;border-bottom:1px solid #9ca3af;">Vol / notes</th>
            </tr>
          </thead>
          <tbody>${invRows}</tbody>
        </table>

        <hr style="${RULE}" />
        <h2 style="${HEAD}">Special instructions</h2>
        ${bullets}

        <hr style="${RULE}" />
        <p style="${MUTED}text-align:center;margin:0;">
          ${escapeHtml(model.footer.brand)} · ${escapeHtml(model.footer.phone)} · ${escapeHtml(model.footer.email)} · ${escapeHtml(model.footer.website)}
        </p>
        <p style="${MUTED}text-align:center;margin:4px 0 0;font-size:9px;">${escapeHtml(model.footer.disclaimer)}</p>
      </div>

      ${podSection}
    </div>
  `
}
