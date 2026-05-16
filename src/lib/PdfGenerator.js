import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { formatDateUK, formatDateTimeUK } from './formatDateDisplay'

export const JOB_PDF_DATA_MISSING_MESSAGE = 'PDF data missing. Please reload the job and try again.'

/** Microsoft Edge (Chromium) — large html2canvas surfaces often rasterize as blank; use a slightly lower scale. */
function isEdgeChromium() {
  if (typeof navigator === 'undefined') return false
  return /Edg\//.test(navigator.userAgent)
}

function jobSheetHtml2CanvasScale() {
  /* Split captures keep canvases shorter — slightly higher scale on Edge for sharper type */
  return isEdgeChromium() ? 1.75 : 2
}

/**
 * True when we have enough row data to render a meaningful job sheet.
 * @param {Record<string, unknown> | null | undefined} job
 */
export function isJobPdfDataSufficient(job) {
  if (job == null || typeof job !== 'object') return false
  const ref = String(job.job_reference ?? '').trim()
  if (ref.length > 0) return true
  const name = String(job.full_name ?? '').trim()
  const email = String(job.email ?? '').trim()
  const pickup = String(job.pickup_address ?? '').trim()
  const delivery = String(job.delivery_address ?? '').trim()
  return Boolean((name || email) && (pickup || delivery))
}

/** @param {PdfJobPayload} job */
function summarizeJobForLog(job) {
  return {
    job_reference: job.job_reference,
    full_name: job.full_name,
    phone: job.phone,
    email: job.email,
    move_date: job.move_date,
    service_type: job.service_type,
    pickup_address: job.pickup_address,
    delivery_address: job.delivery_address,
    estimated_total: job.estimated_total,
    final_price: job.final_price,
    arrival_type: job.arrival_type,
    arrival_time: job.arrival_time,
  }
}

/**
 * Split a tall canvas across A4 pages (logic aligned with html2pdf.js worker).
 * Uses PNG for sharp text; snaps slice height to a line grid to reduce cutting through text.
 * @param {HTMLCanvasElement} canvas
 * @param {{ margin: number[], jsPDF: Record<string, unknown>, scale?: number }} opt margin [top,left,bottom,right] mm
 * @param {object | null} [existingPdf] existing jsPDF instance to append pages to
 */
function canvasToJsPdf(canvas, opt, existingPdf = null) {
  const margin = opt.margin
  const pdf = existingPdf ?? new jsPDF(opt.jsPDF)
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeightMm = pdf.internal.pageSize.getHeight()
  const innerW = pageWidth - margin[1] - margin[3]
  const innerH = pageHeightMm - margin[0] - margin[2]
  const ratio = innerH / innerW

  const scale = typeof opt.scale === 'number' ? opt.scale : 2
  /** ~12px body × line-height × scale — slice boundaries align better with text lines */
  const lineGridPx = Math.max(8, Math.round(12 * 1.45 * scale))

  const pxFullHeight = canvas.height
  let pxPageHeight = Math.max(1, Math.floor(canvas.width * ratio))
  pxPageHeight = Math.max(lineGridPx, Math.floor(pxPageHeight / lineGridPx) * lineGridPx)

  const nPages = Math.max(1, Math.ceil(pxFullHeight / pxPageHeight))

  const pageCanvas = document.createElement('canvas')
  const pageCtx = pageCanvas.getContext('2d')
  if (!pageCtx) throw new Error('PDF render failed (canvas context).')
  pageCanvas.width = canvas.width

  /** First printed slice of this canvas: add page only when continuing an existing PDF */
  let addPageBeforeDraw = Boolean(existingPdf)

  for (let page = 0; page < nPages; page++) {
    const isLast = page === nPages - 1
    const remainder = pxFullHeight % pxPageHeight
    /** @type {number} */
    let pageHeightMmOut
    if (isLast && remainder !== 0) {
      pageCanvas.height = remainder
      pageHeightMmOut = (pageCanvas.height * innerW) / pageCanvas.width
    } else {
      pageCanvas.height = pxPageHeight
      pageHeightMmOut = innerH
    }

    const w = pageCanvas.width
    const h = pageCanvas.height
    pageCtx.fillStyle = '#ffffff'
    pageCtx.fillRect(0, 0, w, h)
    pageCtx.drawImage(canvas, 0, page * pxPageHeight, w, h, 0, 0, w, h)

    const imgData = pageCanvas.toDataURL('image/png')
    if (addPageBeforeDraw) pdf.addPage()
    addPageBeforeDraw = true
    pdf.addImage(imgData, 'PNG', margin[1], margin[0], innerW, pageHeightMmOut)
  }

  return pdf
}

/**
 * Wait for layout/fonts before html2canvas runs (avoids blank captures).
 * @param {HTMLElement} el
 */
async function waitForPdfElementPaint(el) {
  try {
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      await document.fonts.ready
    }
  } catch {
    /* ignore */
  }
  void el.offsetHeight
  try {
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  } catch {
    /* ignore */
  }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  await new Promise((r) => setTimeout(r, isEdgeChromium() ? 400 : 250))
}

/**
 * @typedef {Object} PdfJobPayload
 * @property {string} job_reference
 * @property {string} full_name
 * @property {string} phone
 * @property {string} email
 * @property {string} pickup_address
 * @property {string} delivery_address
 * @property {string} move_date
 * @property {string} service_type
 * @property {number} total_cubic_metres
 * @property {Record<string, unknown>} price_breakdown
 * @property {number} estimated_total
 * @property {number|null|undefined} [final_price]
 * @property {string|null|undefined} [customer_message]
 * @property {string|null|undefined} [internal_notes]
 * @property {string|null|undefined} [arrival_type]
 * @property {string|null|undefined} [arrival_time]
 * @property {number|null|undefined} [distance_miles]
 * @property {string|null|undefined} [created_at]
 */

/**
 * @typedef {Object} PdfJobItemRow
 * @property {string} item_name
 * @property {number} quantity
 * @property {number} line_volume_m3
 * @property {number} [cubic_metres_per_unit]
 * @property {boolean} [is_custom]
 */

/**
 * @param {string | null | undefined} isoOrDate
 */
function formatDateLongUK(isoOrDate) {
  if (isoOrDate == null || isoOrDate === '') return '—'
  const s = String(isoOrDate).trim()
  if (!s) return '—'
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00`) : new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * UK outward postcode for route summary (best-effort).
 * @param {string | null | undefined} addressText
 */
function extractUkPostcode(addressText) {
  if (addressText == null || addressText === '') return ''
  const m = String(addressText).match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i)
  if (!m) return ''
  return m[1].replace(/\s+/g, ' ').toUpperCase()
}

/**
 * @param {PdfJobPayload} job
 */
function moveScheduleSuffix(job) {
  if (job.arrival_type === 'exact' && job.arrival_time) {
    return ` · Arrival: ${job.arrival_time} (exact)`
  }
  if (job.arrival_type === 'window') {
    return ' · Arrival: within agreed window'
  }
  if (job.arrival_type) return ` · ${String(job.arrival_type)}`
  return ''
}

/**
 * @param {PdfJobItemRow[]} items
 */
function inventoryCommaSummary(items) {
  if (!items.length) return ''
  return items
    .map((r) => {
      const q = Math.max(0, Number(r.quantity) || 0)
      const name = String(r.item_name || 'Item').trim()
      return `${q}× ${name}`
    })
    .join(', ')
}

/**
 * @param {unknown} v
 * @returns {string}
 */
function escapeHtml(v) {
  if (v == null) return ''
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * @param {unknown} v
 */
function dash(v) {
  if (v == null || v === '') return '—'
  const s = String(v).trim()
  return s.length ? s : '—'
}

/**
 * @param {PdfJobItemRow} row
 */
function volumePerUnitM3(row) {
  if (row.cubic_metres_per_unit != null && Number.isFinite(Number(row.cubic_metres_per_unit))) {
    return Number(row.cubic_metres_per_unit).toFixed(2)
  }
  const q = Math.max(0, Number(row.quantity) || 0)
  if (q <= 0) return '—'
  return (Number(row.line_volume_m3) / q).toFixed(2)
}

/**
 * @param {PdfJobPayload} job
 * @param {{ items?: PdfJobItemRow[], wizard_extras?: string }} extra
 * @returns {Promise<{ root: HTMLElement | null, filename: string, cleanup: () => void }>}
 */
async function mountJobSheetHtml(job, extra = {}) {
  const items = extra.items || []
  const wizardExtras = typeof extra.wizard_extras === 'string' ? extra.wizard_extras.trim() : ''
  const b = job.price_breakdown && typeof job.price_breakdown === 'object' ? job.price_breakdown : {}
  const priceRows = Array.isArray(b.rows) ? b.rows : []

  const generated = new Date().toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const safeRef = String(job.job_reference || 'job').replace(/[^\w.-]+/g, '_')
  const filename = `${safeRef}-job-sheet.pdf`

  const titleLine = `${dash(job.service_type)} (${dash(job.job_reference)}) – ${formatDateLongUK(job.move_date)}${moveScheduleSuffix(job)}`
  const invSummary = inventoryCommaSummary(items)
  const vol = Number(job.total_cubic_metres ?? 0).toFixed(1)
  const pcFrom = extractUkPostcode(job.pickup_address)
  const pcTo = extractUkPostcode(job.delivery_address)
  const summaryPrefix = invSummary ? `${escapeHtml(invSummary)} ` : ''
  const postcodeSuffix =
    pcFrom && pcTo
      ? `from ${escapeHtml(pcFrom)} to ${escapeHtml(pcTo)}`
      : pcFrom || pcTo
        ? `${escapeHtml(pcFrom || '—')} → ${escapeHtml(pcTo || '—')}`
        : ''
  const routeLine = `${summaryPrefix}(${escapeHtml(vol)}m³)${postcodeSuffix ? ` ${postcodeSuffix}` : ''}`.trim()
  const msgCust = job.customer_message != null && String(job.customer_message).trim() ? String(job.customer_message).trim() : ''
  const msgInt = job.internal_notes != null && String(job.internal_notes).trim() ? String(job.internal_notes).trim() : ''
  const arrivalRow =
    job.arrival_type === 'exact' && job.arrival_time
      ? `Exact arrival: ${job.arrival_time}`
      : job.arrival_type === 'window'
        ? 'Arrival: within the agreed time window'
        : job.arrival_type
          ? `Arrival: ${String(job.arrival_type)}`
          : ''
  const dist =
    job.distance_miles != null && Number.isFinite(Number(job.distance_miles))
      ? `${Number(job.distance_miles).toFixed(0)} miles`
      : ''
  const bookedLine = job.created_at ? `Job created: ${formatDateTimeUK(job.created_at)}` : ''

  const tableBase =
    'width:100%;border-collapse:collapse;font-size:11px;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;'
  const thLeft =
    'text-align:left;padding:10px 12px;border-bottom:2px solid #cbd5e1;background:#f8fafc;font-weight:700;color:#334155;font-size:10px;text-transform:uppercase;letter-spacing:0.04em;'
  const thRight =
    'text-align:right;padding:10px 12px;border-bottom:2px solid #cbd5e1;background:#f8fafc;font-weight:700;color:#334155;font-size:10px;text-transform:uppercase;letter-spacing:0.04em;'
  const tdStyle = 'padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a;vertical-align:top;'
  const tdNum = `${tdStyle}text-align:right;font-variant-numeric:tabular-nums;`

  const inventoryRows =
    items.length === 0
      ? `<tr><td colspan="4" style="${tdStyle}color:#64748b;font-style:italic;">No line items stored.</td></tr>`
      : items
          .map((row) => {
            const name = escapeHtml(row.item_name || 'Item')
            const custom = row.is_custom ? ' <span style="color:#64748b;font-size:10px;">(custom)</span>' : ''
            const qty = Math.max(0, Number(row.quantity) || 0)
            const volU = volumePerUnitM3(row)
            const lineVol = Number.isFinite(Number(row.line_volume_m3))
              ? Number(row.line_volume_m3).toFixed(2)
              : '—'
            return `
            <tr style="break-inside:avoid;page-break-inside:avoid;">
              <td style="${tdStyle}">${name}${custom}</td>
              <td style="${tdNum}">${qty}</td>
              <td style="${tdNum}">${volU}</td>
              <td style="${tdNum}">${lineVol}</td>
            </tr>`
          })
          .join('')

  const priceRowsHtml =
    priceRows.length === 0
      ? `<tr><td colspan="2" style="${tdStyle}color:#64748b;">No detailed breakdown stored.</td></tr>`
      : priceRows
          .map((r) => {
            const label = escapeHtml(String(r.label ?? ''))
            const amt = typeof r.amount === 'number' ? r.amount : Number(r.amount)
            const price = Number.isFinite(amt) ? `£${amt.toFixed(2)}` : '—'
            return `
            <tr style="break-inside:avoid;page-break-inside:avoid;">
              <td style="${tdStyle}">${label}</td>
              <td style="${tdNum}font-weight:600;">${price}</td>
            </tr>`
          })
          .join('')

  const estimated = Number(job.estimated_total || 0).toFixed(2)
  const finalP = job.final_price != null && job.final_price !== '' ? Number(job.final_price) : null
  const finalBlock =
    finalP != null && Number.isFinite(finalP)
      ? `<p style="margin:8px 0 0;font-size:13px;color:#92400e;font-weight:700;">Final price: £${finalP.toFixed(2)}</p>`
      : ''

  const driverNotesHtml = `
        <p style="margin:0 0 8px;font-size:11px;line-height:1.55;color:#111827;">Please complete any check-in / check-out paperwork required on site. Confirm access (stairs, parking, time windows) before arrival.</p>
        <p style="margin:0;font-size:11px;line-height:1.55;color:#111827;">Contact the customer ahead of the move if you need to confirm collection or delivery arrangements.</p>`
  const custLines = (msgCust ? escapeHtml(msgCust).split('\n').join('<br/>') : '') || ''
  const intLines = (msgInt ? escapeHtml(msgInt).split('\n').join('<br/>') : '') || ''
  const wizLines = wizardExtras ? escapeHtml(wizardExtras).split('\n').join('<br/>') : ''

  const html = `
    <div id="job-sheet-pdf-root" class="job-sheet-root" style="max-width:800px;margin:0 auto;background:#fff;padding:40px;box-sizing:border-box;color:#0f172a;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.45;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility;">
      <div id="job-sheet-pdf-main">
      <header style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:16px;margin-bottom:18px;border-bottom:2px solid #111827;flex-wrap:wrap;">
        <div>
          <div style="font-size:18px;font-weight:800;letter-spacing:-0.02em;color:#111827;">ShiftMyHome</div>
          <div style="font-size:11px;color:#4b5563;margin-top:4px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">Quote / Job summary</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;font-weight:700;">Reference</div>
          <div style="font-family:ui-monospace,Menlo,monospace;font-size:14px;font-weight:800;color:#111827;margin-top:2px;">${escapeHtml(dash(job.job_reference))}</div>
        </div>
      </header>

      <div style="margin-bottom:18px;padding:12px 14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;">
        <div style="font-size:15px;font-weight:800;color:#111827;line-height:1.35;margin-bottom:10px;">${escapeHtml(titleLine)}</div>
        <div style="font-size:12px;color:#111827;"><strong>Customer:</strong> ${escapeHtml(dash(job.full_name))} · <strong>Phone:</strong> ${escapeHtml(dash(job.phone))}</div>
        <div style="margin-top:8px;font-size:11px;color:#374151;line-height:1.5;">${driverNotesHtml}</div>
      </div>

      <div style="margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid #d1d5db;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#4b5563;margin-bottom:6px;">Move summary</div>
        <div style="font-size:12px;color:#111827;line-height:1.5;">${routeLine}</div>
        <div style="margin-top:8px;font-size:11px;color:#374151;">
          <strong>Move date:</strong> ${escapeHtml(formatDateUK(job.move_date))}${arrivalRow ? ` · ${escapeHtml(arrivalRow)}` : ''}
          ${dist ? ` · <strong>Distance:</strong> ${escapeHtml(dist)}` : ''}
        </div>
        ${bookedLine ? `<div style="margin-top:4px;font-size:10px;color:#6b7280;">${escapeHtml(bookedLine)}</div>` : ''}
      </div>

      <table style="width:100%;border-collapse:separate;border-spacing:10px 0;margin-bottom:20px;" role="presentation">
        <tr>
          <td style="width:50%;vertical-align:top;padding:12px;border:1px solid #d1d5db;border-radius:4px;background:#fff;">
            <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:8px;">Pickup</div>
            <div style="font-size:12px;font-weight:700;color:#111827;">${escapeHtml(dash(job.full_name))}</div>
            <div style="font-size:11px;color:#374151;margin:2px 0 8px;">Phone: ${escapeHtml(dash(job.phone))}</div>
            <div style="font-size:11px;white-space:pre-wrap;color:#111827;line-height:1.5;">${escapeHtml(dash(job.pickup_address))}</div>
          </td>
          <td style="width:50%;vertical-align:top;padding:12px;border:1px solid #d1d5db;border-radius:4px;background:#fff;">
            <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;margin-bottom:8px;">Delivery</div>
            <div style="font-size:12px;font-weight:700;color:#111827;">${escapeHtml(dash(job.full_name))}</div>
            <div style="font-size:11px;color:#374151;margin:2px 0 8px;">Phone: ${escapeHtml(dash(job.phone))}</div>
            <div style="font-size:11px;white-space:pre-wrap;color:#111827;line-height:1.5;">${escapeHtml(dash(job.delivery_address))}</div>
          </td>
        </tr>
      </table>

      <section style="margin-bottom:22px;padding-bottom:18px;border-bottom:1px solid #d1d5db;">
        <h2 style="margin:0 0 12px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;">Customer &amp; contact (full)</h2>
        <table style="${tableBase}">
          <tbody>
            <tr><td style="${tdStyle}width:30%;color:#6b7280;font-weight:700;">Email</td><td style="${tdStyle}">${escapeHtml(dash(job.email))}</td></tr>
            <tr><td style="${tdStyle}color:#6b7280;font-weight:700;">Service</td><td style="${tdStyle}">${escapeHtml(dash(job.service_type))}</td></tr>
            <tr><td style="${tdStyle}color:#6b7280;font-weight:700;">Total volume</td><td style="${tdStyle}"><strong>${Number(job.total_cubic_metres ?? 0).toFixed(2)} m³</strong></td></tr>
          </tbody>
        </table>
      </section>

      <section style="margin-bottom:22px;padding-bottom:18px;border-bottom:1px solid #d1d5db;">
        <h2 style="margin:0 0 12px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;">Inventory</h2>
        <table style="${tableBase}">
          <thead>
            <tr>
              <th style="${thLeft}">Item</th>
              <th style="${thRight}width:14%;">Qty</th>
              <th style="${thRight}width:18%;">Volume (m³ ea.)</th>
              <th style="${thRight}width:18%;">Total (m³)</th>
            </tr>
          </thead>
          <tbody>${inventoryRows}</tbody>
        </table>
      </section>

      ${
        wizLines
          ? `<section style="margin-bottom:22px;padding-bottom:18px;border-bottom:1px solid #d1d5db;">
        <h2 style="margin:0 0 8px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;">Services &amp; options</h2>
        <div style="font-size:11px;line-height:1.55;color:#111827;">${wizLines}</div>
      </section>`
          : ''
      }

      ${
        custLines || intLines
          ? `<section style="margin-bottom:22px;padding-bottom:18px;border-bottom:1px solid #d1d5db;">
        <h2 style="margin:0 0 8px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;">Special requirements</h2>
        ${custLines ? `<div style="margin-bottom:10px;font-size:11px;line-height:1.55;color:#111827;"><strong>From customer:</strong><br/>${custLines}</div>` : ''}
        ${intLines ? `<div style="font-size:11px;line-height:1.55;color:#111827;"><strong>Internal notes:</strong><br/>${intLines}</div>` : ''}
      </section>`
          : ''
      }

      <section style="margin-bottom:22px;padding-bottom:18px;border-bottom:1px solid #d1d5db;">
        <h2 style="margin:0 0 12px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;">Price breakdown</h2>
        <table style="${tableBase}">
          <thead>
            <tr>
              <th style="${thLeft}">Description</th>
              <th style="${thRight}width:28%;">Price</th>
            </tr>
          </thead>
          <tbody>${priceRowsHtml}</tbody>
        </table>
      </section>

      <div style="margin-bottom:22px;padding:16px 18px;background:#fef3c7;border:2px solid #f59e0b;border-radius:6px;text-align:right;">
        <div style="font-size:10px;color:#92400e;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Estimated total</div>
        <div style="font-size:26px;font-weight:900;color:#78350f;letter-spacing:-0.02em;">£${estimated}</div>
        ${finalBlock}
      </div>

      <p style="margin:0 0 18px;font-size:10px;color:#6b7280;line-height:1.55;">
        Pricing follows the information supplied at booking. The final charge may differ if inventory, access, distance or on-site conditions change.
      </p>

      <footer style="padding-top:12px;border-top:1px solid #d1d5db;font-size:11px;color:#6b7280;text-align:center;">
        ShiftMyHome · Professional removals made simple
        <div style="margin-top:6px;font-size:9px;color:#9ca3af;">Generated ${escapeHtml(generated)}</div>
      </footer>
      </div>

      <div id="job-sheet-pdf-checkin" style="page-break-before:always;padding-top:36px;">
        <div style="border-bottom:2px solid #111827;padding-bottom:10px;margin-bottom:16px;">
          <div style="font-size:16px;font-weight:800;color:#111827;">Check-in / check-out</div>
          <div style="font-size:10px;color:#6b7280;margin-top:4px;text-transform:uppercase;letter-spacing:0.06em;">${escapeHtml(dash(job.job_reference))}</div>
        </div>
        <p style="margin:0 0 14px;font-size:11px;color:#374151;line-height:1.55;">Use this section on site for condition checks and signatures if required.</p>
        <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:18px;">
          <tr>
            <td style="padding:10px;border:1px solid #d1d5db;vertical-align:top;width:50%;background:#f9fafb;font-weight:700;color:#4b5563;">Overall condition (furniture / goods)</td>
            <td style="padding:10px;border:1px solid #d1d5db;vertical-align:top;">
              <span style="margin-right:12px;">☐ Brand new</span><span style="margin-right:12px;">☐ Good</span><span style="margin-right:12px;">☐ Average</span><span>☐ Poor</span>
            </td>
          </tr>
          <tr>
            <td style="padding:10px;border:1px solid #d1d5db;vertical-align:top;background:#f9fafb;font-weight:700;color:#4b5563;">Existing damage / notes</td>
            <td style="padding:10px;border:1px solid #d1d5db;min-height:48px;height:56px;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:10px;border:1px solid #d1d5db;vertical-align:top;background:#f9fafb;font-weight:700;color:#4b5563;">Goods collected at</td>
            <td style="padding:10px;border:1px solid #d1d5db;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:10px;border:1px solid #d1d5db;vertical-align:top;background:#f9fafb;font-weight:700;color:#4b5563;">Goods delivered at</td>
            <td style="padding:10px;border:1px solid #d1d5db;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:10px;border:1px solid #d1d5db;vertical-align:top;background:#f9fafb;font-weight:700;color:#4b5563;">Shipment received in same condition</td>
            <td style="padding:10px;border:1px solid #d1d5db;">☐ Yes &nbsp; ☐ No</td>
          </tr>
          <tr>
            <td style="padding:10px;border:1px solid #d1d5db;vertical-align:top;background:#f9fafb;font-weight:700;color:#4b5563;">Crew sign-off</td>
            <td style="padding:10px;border:1px solid #d1d5db;height:40px;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:10px;border:1px solid #d1d5db;vertical-align:top;background:#f9fafb;font-weight:700;color:#4b5563;">Customer sign-off</td>
            <td style="padding:10px;border:1px solid #d1d5db;height:40px;">&nbsp;</td>
          </tr>
        </table>
        <p style="margin:0;font-size:9px;line-height:1.45;color:#9ca3af;">
          This sheet is provided by ShiftMyHome to assist crews and customers. It does not replace your agreed terms of service or insurance documentation.
        </p>
      </div>
    </div>
  `

  /** Dim overlay — keeps users from interacting during the brief capture flash. */
  const backdrop = document.createElement('div')
  backdrop.id = 'job-sheet-pdf-backdrop'
  backdrop.setAttribute('aria-hidden', 'true')
  Object.assign(backdrop.style, {
    position: 'fixed',
    inset: '0',
    background: 'rgba(15, 23, 42, 0.45)',
    zIndex: '2147483646',
    pointerEvents: 'auto',
  })

  const wrapper = document.createElement('div')
  wrapper.id = 'job-sheet-pdf-wrapper'
  /**
   * MUST stay inside the viewport: Chromium html2canvas often paints fully transparent/white
   * when the source element is positioned far off-screen (e.g. left: -9999px).
   */
  Object.assign(wrapper.style, {
    position: 'fixed',
    left: '0',
    right: '0',
    top: '48px',
    marginLeft: 'auto',
    marginRight: 'auto',
    width: '800px',
    maxWidth: 'min(800px, calc(100vw - 48px))',
    maxHeight: 'calc(100vh - 96px)',
    minHeight: '200px',
    padding: '0',
    boxSizing: 'border-box',
    background: '#ffffff',
    zIndex: '2147483647',
    opacity: '1',
    visibility: 'visible',
    display: 'block',
    pointerEvents: 'none',
    overflow: 'auto',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  })
  wrapper.innerHTML = html
  document.body.appendChild(backdrop)
  document.body.appendChild(wrapper)

  await waitForPdfElementPaint(wrapper)

  const root = wrapper.querySelector('#job-sheet-pdf-root')
  const h = root ? root.scrollHeight : wrapper.scrollHeight
  if (h < 80) {
    if (backdrop.parentNode) document.body.removeChild(backdrop)
    if (wrapper.parentNode) document.body.removeChild(wrapper)
    throw new Error(JOB_PDF_DATA_MISSING_MESSAGE)
  }

  const cleanup = () => {
    if (backdrop.parentNode) document.body.removeChild(backdrop)
    if (wrapper.parentNode) document.body.removeChild(wrapper)
  }

  return { root, filename, cleanup }
}

/**
 * Styled HTML → PDF (not plain jsPDF text).
 * @param {PdfJobPayload} job
 * @param {{ items?: PdfJobItemRow[], wizard_extras?: string }} [extra]
 */
export async function generateJobPdf(job, extra = {}) {
  if (!isJobPdfDataSufficient(job)) {
    throw new Error(JOB_PDF_DATA_MISSING_MESSAGE)
  }

  const items = extra.items || []
  const b = job.price_breakdown && typeof job.price_breakdown === 'object' ? job.price_breakdown : {}
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[Job PDF] quote data', summarizeJobForLog(job))
    // eslint-disable-next-line no-console
    console.debug('[Job PDF] inventory', items)
    // eslint-disable-next-line no-console
    console.debug('[Job PDF] pricing', {
      price_breakdown: b,
      estimated_total: job.estimated_total,
      final_price: job.final_price,
    })
    // eslint-disable-next-line no-console
    console.debug('[Job PDF] capture', { edge: isEdgeChromium(), scale: jobSheetHtml2CanvasScale() })
  }

  const { root, filename, cleanup } = await mountJobSheetHtml(job, extra)
  try {
    if (!root || root.scrollHeight < 40) {
      throw new Error(JOB_PDF_DATA_MISSING_MESSAGE)
    }

    const mainEl = root.querySelector('#job-sheet-pdf-main')
    const checkinEl = root.querySelector('#job-sheet-pdf-checkin')
    if (!mainEl) {
      throw new Error(JOB_PDF_DATA_MISSING_MESSAGE)
    }

    const shell = root.parentElement
    const scale = jobSheetHtml2CanvasScale()
    const prevMaxH = shell && shell instanceof HTMLElement ? shell.style.maxHeight : ''
    const prevOv = shell && shell instanceof HTMLElement ? shell.style.overflow : ''
    if (shell instanceof HTMLElement) {
      shell.style.maxHeight = 'none'
      shell.style.overflow = 'visible'
    }

    const pdfBaseOpt = {
      margin: [10, 10, 10, 10],
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      scale,
    }

    /**
     * @param {HTMLElement} el
     * @returns {Promise<HTMLCanvasElement>}
     */
    const capture = (el) =>
      html2canvas(el, {
        scale,
        useCORS: true,
        allowTaint: false,
        foreignObjectRendering: false,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 20000,
        scrollX: 0,
        scrollY: 0,
        windowWidth: el.scrollWidth,
        windowHeight: Math.min(el.scrollHeight, 16000),
        onclone(clonedDoc) {
          for (const id of ['job-sheet-pdf-root', 'job-sheet-pdf-main', 'job-sheet-pdf-checkin']) {
            const node = clonedDoc.getElementById(id)
            if (node) {
              node.style.setProperty('-webkit-print-color-adjust', 'exact')
              node.style.setProperty('print-color-adjust', 'exact')
              node.style.setProperty('color-adjust', 'exact')
              node.style.backgroundColor = '#ffffff'
              node.style.color = '#0f172a'
              node.style.fontFamily = 'Arial, Helvetica, sans-serif'
            }
          }
        },
      })

    /** @type {ReturnType<typeof canvasToJsPdf> | null} */
    let pdfOut = null
    try {
      const canvasMain = await capture(mainEl)
      if (!canvasMain.width || !canvasMain.height) {
        throw new Error('PDF render failed: blank canvas (main).')
      }
      pdfOut = canvasToJsPdf(canvasMain, pdfBaseOpt, null)

      if (checkinEl && checkinEl.scrollHeight > 20) {
        const canvasCheck = await capture(checkinEl)
        if (canvasCheck.width && canvasCheck.height) {
          pdfOut = canvasToJsPdf(canvasCheck, pdfBaseOpt, pdfOut)
        }
      }

      pdfOut.save(filename)
    } finally {
      if (shell instanceof HTMLElement) {
        shell.style.maxHeight = prevMaxH
        shell.style.overflow = prevOv
      }
    }
  } finally {
    cleanup()
  }
}
