/**
 * HTML for quote-based Job Sheet PDF (captured via PdfGenerator html2canvas + jsPDF).
 * Visual layout matches the customer invoice. The content stays operational for the crew.
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
const NAVY = '#0c1326'
const BLUE = '#1c4fd9'
const TEXT = '#12171f'
const MUTED = '#637087'
const LINE = '#dbe3ed'
const SOFT = '#f4f6f8'
const BODY = `margin:0;padding:0;background:#fff;color:${TEXT};font-family:${FONT};font-size:11px;line-height:1.4;`

/**
 * @param {unknown} value
 */
function shown(value) {
  const text = String(value ?? '').trim()
  if (!text || text === 'N/A' || text === '—') return ''
  return text
}

/**
 * @param {string} label
 */
function badgeStyle(label) {
  if (/PAID IN FULL/i.test(label)) return 'background:#ecfdf3;color:#0d7350;border:1px solid #86efac;'
  if (/DEPOSIT/i.test(label)) return 'background:#eff6ff;color:#1d4ed8;border:1px solid #93c5fd;'
  return 'background:#fff7ed;color:#c2410c;border:1px solid #fdba74;'
}

/**
 * @param {{ qty?: string, item?: string, volume?: string, notes?: string }} row
 */
function inventoryExtra(row) {
  const parts = []
  if (row.volume && row.volume !== 'N/A') parts.push(row.volume)
  if (row.notes && row.notes !== 'N/A') parts.push(row.notes)
  return parts.join(' · ')
}

/**
 * @param {{ qty?: string, item?: string, volume?: string, notes?: string }} row
 */
function inventoryNameCell(row) {
  const extra = inventoryExtra(row)
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="vertical-align:top;padding:0 8px 0 0;font-size:9.5px;line-height:1.35;color:${TEXT};">${escapeHtml(row.item)}${extra ? `<div style="margin-top:1px;font-size:8px;color:${MUTED};">${escapeHtml(extra)}</div>` : ''}</td>
        <td style="width:28px;vertical-align:top;text-align:right;font-size:9.5px;color:${TEXT};">${escapeHtml(row.qty)}</td>
      </tr>
    </table>`
}

/**
 * One column for a short list. Three columns when the crew has more than six lines.
 * @param {Array<{ qty?: string, item?: string, volume?: string, notes?: string }>} rows
 */
function renderJobSheetInventory(rows) {
  if (!rows?.length) {
    return `<p style="margin:0;color:${MUTED};font-style:italic;">No inventory lines on file.</p>`
  }
  const columns = rows.length > 6 ? 3 : 1
  const header = Array.from({ length: columns }, (_, index) => {
    const title = index === 0 ? 'INVENTORY' : ''
    return `
      <th style="width:${Math.floor(100 / columns)}%;text-align:left;padding:0 12px 6px 0;font-size:8px;font-weight:700;color:${MUTED};border-bottom:1px solid ${LINE};">
        <table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;"><tr>
          <td style="font-size:8px;font-weight:700;letter-spacing:0.04em;color:${MUTED};">${title}</td>
          <td style="text-align:right;font-size:8px;font-weight:700;letter-spacing:0.04em;color:${MUTED};">QTY</td>
        </tr></table>
      </th>`
  }).join('')
  const body = []
  for (let index = 0; index < rows.length; index += columns) {
    const cells = []
    for (let column = 0; column < columns; column += 1) {
      const row = rows[index + column]
      cells.push(
        `<td style="width:${Math.floor(100 / columns)}%;vertical-align:top;padding:3px 12px 4px 0;">${row ? inventoryNameCell(row) : ''}</td>`,
      )
    }
    body.push(`<tr>${cells.join('')}</tr>`)
  }
  const totalItems = rows.reduce((sum, row) => sum + (Number(row.qty) || 0), 0)
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
      <thead><tr>${header}</tr></thead>
      <tbody>${body.join('')}</tbody>
    </table>
    <div style="margin-top:6px;font-size:9px;font-weight:700;color:${TEXT};">Total items: ${totalItems}</div>`
}

/**
 * @param {string} title
 * @param {string[]} lines
 */
function addressBox(title, lines) {
  const body = lines.filter(Boolean).map((line) => `<div style="margin:0 0 2px;">${line}</div>`).join('')
  return `
    <td style="width:50%;vertical-align:top;background:${SOFT};border:1px solid ${LINE};padding:8px 10px;">
      <div style="margin:0 0 4px;font-size:8px;font-weight:700;letter-spacing:0.04em;color:${BLUE};">${escapeHtml(title)}</div>
      <div style="font-size:10px;line-height:1.4;color:${TEXT};">${body || '—'}</div>
    </td>`
}

/**
 * @param {unknown} label
 */
function invoiceStatusBadge(label) {
  const text = String(label || '')
  if (/PAID IN FULL|^PAID$/i.test(text)) return 'PAID'
  if (/DEPOSIT|PARTIAL/i.test(text)) return 'PARTIALLY PAID'
  return 'UNPAID'
}

/**
 * Same address box as the invoice: the address, then floor and lift only when they matter.
 * @param {{ address?: string, floor?: string, lift?: string } | undefined} stop
 */
function invoiceStopLines(stop) {
  const lines = []
  if (shown(stop?.address)) lines.push(`<div>${escapeHtml(stop.address)}</div>`)
  const floor = shown(stop?.floor)
  if (floor && floor !== '0' && !/ground|typical|house/i.test(floor)) {
    lines.push(`<div style="margin-top:4px;font-size:8.5px;color:${MUTED};">Floor ${escapeHtml(floor)}</div>`)
  }
  const lift = shown(stop?.lift)
  if (/^(yes|available|true)$/i.test(lift) || /available/i.test(lift)) {
    lines.push(`<div style="font-size:8.5px;color:${MUTED};">Lift available</div>`)
  }
  return lines
}

/** Minimal one-page fallback if model is missing. */
export function buildMinimalJobSheetHtml() {
  return `
    <div id="job-sheet-pdf-root" style="max-width:100%;${BODY}">
      <div id="job-sheet-pdf-main" style="padding:12px 14px;">
        <p style="margin:0;font-size:16px;font-weight:700;color:${NAVY};">ShiftMyHome</p>
        <p style="margin:8px 0 0;">Job Sheet PDF — capture pipeline OK. Reload the job and try again.</p>
      </div>
    </div>
  `
}

/**
 * @param {ReturnType<import('./buildJobSheetPdfModel').buildJobSheetPdfModel>} model
 */
export function buildQuoteJobSheetHtml(model) {
  const inventoryHtml = renderJobSheetInventory(model.inventory)
  const serviceName = shown(model.move?.service) || 'Removal'
  const crew = shown(model.crewLine)
  const badge = invoiceStatusBadge(model.paymentBadge?.label)
  const pickupLines = invoiceStopLines(model.pickup)
  const deliveryLines = invoiceStopLines(model.delivery)

  const moneyRows = [
    ['Invoice total', model.payment?.estimatedTotal],
    ['Amount paid', model.payment?.paid],
    ['Balance due', model.payment?.balance],
  ].filter((row) => shown(row[1]))

  const podBox = (title, inner) => `
    <td style="width:50%;vertical-align:top;background:${SOFT};border:1px solid ${LINE};padding:10px;">
      <div style="margin:0 0 8px;font-size:8px;font-weight:700;letter-spacing:0.04em;color:${BLUE};">${title}</div>
      ${inner}
    </td>`

  return `
    <div id="job-sheet-pdf-root" style="max-width:100%;width:100%;${BODY}">
      <div id="job-sheet-pdf-main" style="padding:18px 22px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="vertical-align:top;">
              <img src="/email-logo.png" alt="ShiftMyHome" style="height:42px;width:auto;display:block;" />
            </td>
            <td style="vertical-align:top;text-align:right;">
              <div style="font-size:18px;font-weight:700;letter-spacing:0.04em;color:${NAVY};">JOB SHEET</div>
              <div style="margin-top:6px;font-size:8px;line-height:1.45;color:${MUTED};">
                Booking reference: ${escapeHtml(shown(model.quoteRef) || '—')}<br />
                Move date: ${escapeHtml(shown(model.move?.date) || '—')}<br />
                Issued: ${escapeHtml(shown(model.generatedAt) || '—')}
              </div>
              <div style="margin-top:8px;">
                <span style="display:inline-block;padding:3px 8px;font-size:8px;font-weight:700;letter-spacing:0.04em;${badgeStyle(badge)}">${escapeHtml(badge || 'JOB')}</span>
              </div>
            </td>
          </tr>
        </table>

        <div style="height:1px;background:${LINE};margin:16px 0 14px;"></div>

        <table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:8px 0;margin:0 -8px 12px;">
          <tr>
            ${addressBox('COLLECTION', pickupLines)}
            ${addressBox('DELIVERY', deliveryLines)}
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:12px;">
          <tr>
            <td style="padding:0 0 4px;font-size:8px;font-weight:700;color:${MUTED};border-bottom:1px solid ${LINE};">SERVICE</td>
            <td style="padding:0 0 4px;font-size:8px;font-weight:700;color:${MUTED};text-align:right;border-bottom:1px solid ${LINE};">AMOUNT</td>
          </tr>
          <tr>
            <td style="padding:8px 0 0;font-size:10.5px;color:${TEXT};">${escapeHtml(serviceName)} service${crew ? ` - ${escapeHtml(crew)}` : ''}</td>
            <td style="padding:8px 0 0;text-align:right;font-size:10.5px;color:${TEXT};white-space:nowrap;">${escapeHtml(shown(model.payment?.estimatedTotal) || '')}</td>
          </tr>
        </table>

        ${inventoryHtml}

        ${moneyRows.length ? `
          <table width="230" align="right" cellpadding="0" cellspacing="0" style="width:230px;margin:12px 0 0 auto;border-collapse:collapse;">
            ${moneyRows
              .map(
                ([label, value], index) => `
              <tr>
                <td style="padding:2px 0;font-size:10px;${index === moneyRows.length - 1 ? 'font-weight:700;' : ''}color:${TEXT};">${escapeHtml(label)}</td>
                <td style="padding:2px 0;text-align:right;font-size:10px;font-weight:700;color:${TEXT};">${escapeHtml(value)}</td>
              </tr>`,
              )
              .join('')}
            ${shown(model.payment?.method) ? `<tr><td colspan="2" style="padding:8px 0 0;font-size:9px;color:${TEXT};">Payment method: ${escapeHtml(model.payment.method)}</td></tr>` : ''}
            ${shown(model.payment?.paidOn) ? `<tr><td colspan="2" style="padding:2px 0 0;font-size:9px;color:${TEXT};">Paid on: ${escapeHtml(model.payment.paidOn)}</td></tr>` : ''}
          </table>
          <div style="clear:both;"></div>
        ` : ''}

        <table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:14px;">
          <tr>
            <td style="width:4px;background:${BLUE};"></td>
            <td style="background:#edf5fc;border:1px solid #bacbf0;border-left:none;padding:10px 12px;">
              <div style="margin:0 0 4px;font-size:10px;font-weight:700;color:${NAVY};">Thank you for choosing ShiftMyHome.</div>
              <div style="font-size:9.5px;line-height:1.45;color:${TEXT};">You can track your move online in My account, and you can update your booking there before moving day. Sign in at www.shiftmyhome.co.uk with the email address on this invoice.</div>
            </td>
          </tr>
        </table>

        <div style="height:1px;background:${LINE};margin:18px 0 8px;"></div>
        <div style="font-size:8px;line-height:1.45;color:${MUTED};">
          ShiftMyHome Ltd<br />
          128 City Road, London, EC1V 2NX<br />
          Company number 16730159<br />
          ${escapeHtml(shown(model.footer?.phone) || '0141 461 4813')} &nbsp;|&nbsp; ${escapeHtml(shown(model.footer?.website) || 'www.shiftmyhome.co.uk')} &nbsp;|&nbsp; admin@shiftmyhome.co.uk<br />
          https://www.shiftmyhome.co.uk/terms
        </div>
      </div>

      <div id="job-sheet-pdf-checkin" style="page-break-before:always;padding:18px 22px 16px;${BODY}">
        <table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="vertical-align:top;">
              <img src="/email-logo.png" alt="ShiftMyHome" style="height:42px;width:auto;display:block;" />
            </td>
            <td style="vertical-align:top;text-align:right;">
              <div style="font-size:16px;font-weight:700;color:${NAVY};">PROOF OF DELIVERY</div>
              <div style="margin-top:6px;font-size:8px;line-height:1.45;color:${MUTED};">
                ${escapeHtml(shown(model.quoteRef) || '—')}<br />
                ${escapeHtml(shown(model.customer?.name) || '')}
              </div>
            </td>
          </tr>
        </table>
        <div style="height:1px;background:${LINE};margin:14px 0;"></div>

        <table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:8px 0;margin:0 -8px 10px;">
          <tr>
            ${podBox('OVERALL CONDITION', '<div style="font-size:10px;line-height:1.8;">☐ Brand new<br />☐ Good<br />☐ Average<br />☐ Poor</div>')}
            ${podBox('RECEIVED IN THE SAME CONDITION', '<div style="font-size:10px;line-height:1.8;">☐ Yes<br />☐ No</div>')}
          </tr>
        </table>

        <div style="margin:8px 0 4px;font-size:8px;font-weight:700;letter-spacing:0.04em;color:${BLUE};">EXISTING DAMAGE / NOTES</div>
        <div style="height:54px;border:1px solid ${LINE};background:${SOFT};margin-bottom:12px;"></div>

        <div style="margin:0 0 8px;font-size:10px;">Collected at: ________________________________</div>
        <div style="margin:0 0 12px;font-size:10px;">Delivered at: ________________________________</div>

        <table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:8px 0;margin:0 -8px 12px;">
          <tr>
            ${podBox('DRIVER SIGN OFF', '<div style="height:42px;border-bottom:1px solid #c5ced8;"></div>')}
            ${podBox('CUSTOMER SIGN OFF', '<div style="height:42px;border-bottom:1px solid #c5ced8;"></div>')}
          </tr>
        </table>

        <div style="font-size:9px;line-height:1.45;color:${TEXT};">I confirm the goods were collected and delivered as described on this job sheet, subject to any damage or exceptions noted above.</div>
        <div style="height:1px;background:${LINE};margin:16px 0 8px;"></div>
        <div style="font-size:8px;line-height:1.45;color:${MUTED};">${escapeHtml(model.footer?.disclaimer || '')}</div>
      </div>
    </div>
  `
}
