import html2pdf from 'html2pdf.js'
import { formatDateUK } from '../lib/formatDateDisplay'

/**
 * Payload from buildQuoteEmailTemplateParams (EmailJS) — may include optional inventory & pricing.
 * @typedef {Object} QuotePdfData
 * @property {string} [name]
 * @property {string} [email]
 * @property {string} [phone]
 * @property {string} [service]
 * @property {string} [pickup]
 * @property {string} [delivery]
 * @property {string} [move_date]
 * @property {string} [quote_ref]
 * @property {string} [details]
 * @property {string} [inventory]
 * @property {string} [pricing]
 */

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
 * @param {string} title
 * @param {string} bodyHtml
 */
function card(title, bodyHtml) {
  return `
    <div style="margin-bottom:14px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background:#fff;box-shadow:0 1px 2px rgba(15,23,42,0.06);">
      <div style="background:#f8fafc;padding:8px 14px;font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#475569;border-bottom:1px solid #e2e8f0;">
        ${escapeHtml(title)}
      </div>
      <div style="padding:12px 14px;font-size:11px;line-height:1.55;color:#0f172a;">
        ${bodyHtml}
      </div>
    </div>
  `
}

/**
 * @param {Array<[string, string]>} rows
 */
function dlRows(rows) {
  return `
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      ${rows
        .map(
          ([k, v]) => `
        <tr>
          <td style="vertical-align:top;width:34%;padding:6px 10px 6px 0;color:#64748b;border-bottom:1px solid #f1f5f9;">${escapeHtml(k)}</td>
          <td style="vertical-align:top;padding:6px 0;color:#0f172a;border-bottom:1px solid #f1f5f9;white-space:pre-wrap;">${escapeHtml(v)}</td>
        </tr>`,
        )
        .join('')}
    </table>
  `
}

/**
 * @param {QuotePdfData} data
 * @returns {Promise<{ wrapper: HTMLDivElement, filename: string, opt: object, cleanup: () => void }>}
 */
async function mountQuotePdfElement(data) {
  const {
    quote_ref,
    name,
    email,
    phone,
    service,
    pickup,
    delivery,
    move_date,
    details,
    inventory,
    pricing,
  } = data || {}

  const generated = new Date().toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const safeRef = String(quote_ref || 'quote').replace(/[^\w.-]+/g, '_')
  const filename = `ShiftMyHome-Quote-${safeRef}.pdf`

  const header = `
    <div style="background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);color:#fff;padding:18px 20px;border-radius:8px;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;">
        <div>
          <div style="font-size:20px;font-weight:800;letter-spacing:-0.02em;">ShiftMyHome</div>
          <div style="font-size:11px;opacity:0.92;margin-top:4px;">Quote · Job sheet</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:10px;opacity:0.85;text-transform:uppercase;letter-spacing:0.08em;">Quote reference</div>
          <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:15px;font-weight:700;margin-top:4px;">${escapeHtml(dash(quote_ref))}</div>
        </div>
      </div>
    </div>
  `

  const summaryCard = card(
    'Contact & move details',
    dlRows([
      ['Name', dash(name)],
      ['Email', dash(email)],
      ['Phone', dash(phone)],
      ['Service', dash(service)],
      ['Move date', dash(formatDateUK(move_date))],
      ['Pickup address', dash(pickup)],
      ['Delivery address', dash(delivery)],
    ]),
  )

  const inventorySection =
    inventory != null && String(inventory).trim() !== ''
      ? card(
          'Inventory',
          `<div style="white-space:pre-wrap;font-size:10px;line-height:1.5;">${escapeHtml(String(inventory))}</div>`,
        )
      : ''

  const pricingSection =
    pricing != null && String(pricing).trim() !== ''
      ? card(
          'Estimated price breakdown',
          `<div style="white-space:pre-wrap;font-size:10px;line-height:1.5;">${escapeHtml(String(pricing))}</div>`,
        )
      : ''

  const fullDetailsCard = card(
    'Full enquiry (same as email)',
    `<div style="white-space:pre-wrap;font-size:10px;line-height:1.55;color:#0f172a;">${escapeHtml(dash(details))}</div>`,
  )

  const footer = `
    <div style="margin-top:18px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:9px;color:#94a3b8;line-height:1.5;">
      <div>This PDF matches the enquiry sent by email. Figures in the text are estimates only and subject to confirmation.</div>
      <div style="margin-top:6px;">Generated: ${escapeHtml(generated)} · ShiftMyHome Ltd</div>
    </div>
  `

  const wrapper = document.createElement('div')
  Object.assign(wrapper.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '210mm',
    maxWidth: '794px',
    minHeight: '200px',
    padding: '12mm',
    boxSizing: 'border-box',
    background: '#ffffff',
    fontFamily:
      'Inter, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    zIndex: '2147483000',
    opacity: '0.02',
    pointerEvents: 'none',
    overflow: 'visible',
    color: '#0f172a',
  })

  wrapper.innerHTML = `
    <div>
      ${header}
      ${summaryCard}
      ${inventorySection}
      ${pricingSection}
      ${fullDetailsCard}
      ${footer}
    </div>
  `
  document.body.appendChild(wrapper)
  void wrapper.offsetHeight
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

  const opt = {
    margin: [10, 10, 10, 10],
    filename,
    image: { type: 'jpeg', quality: 0.92 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      letterRendering: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: wrapper.scrollWidth,
      windowHeight: wrapper.scrollHeight,
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
  }

  const cleanup = () => {
    if (wrapper.parentNode) {
      document.body.removeChild(wrapper)
    }
  }

  return { wrapper, filename, opt, cleanup }
}

/**
 * Used for EmailJS Variable Attachment (base64 data URL).
 * @param {QuotePdfData} data
 * @returns {Promise<Blob>}
 */
export async function generateQuotePdfBlob(data) {
  const { wrapper, opt, cleanup } = await mountQuotePdfElement(data)
  try {
    const blob = await html2pdf().set(opt).from(wrapper).outputPdf('blob')
    return blob
  } finally {
    cleanup()
  }
}

/**
 * @param {QuotePdfData} data
 * @returns {Promise<void>}
 */
export async function generateQuotePdf(data) {
  const { wrapper, filename, opt, cleanup } = await mountQuotePdfElement(data)
  try {
    await html2pdf().set(opt).from(wrapper).save(filename)
  } finally {
    cleanup()
  }
}
