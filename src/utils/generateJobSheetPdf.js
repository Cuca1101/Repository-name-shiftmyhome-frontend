import { buildJobSheetPdfModel } from '../lib/buildJobSheetPdfModel'
import { renderInvoicePdf } from '../../supabase/functions/_shared/invoicePdfDraw.ts'

export const JOB_SHEET_PDF_ERROR = 'Job Sheet PDF could not be generated. Please try again.'

/**
 * @param {ReturnType<typeof buildJobSheetPdfModel>} model
 */
function jobSheetFilename(model) {
  const safeRef = String(model.quoteRef || 'export').replace(/[^\w.-]+/g, '_')
  return `ShiftMyHome-Job-Sheet-${safeRef}.pdf`
}

/**
 * @param {unknown} value
 */
function money(value) {
  const n = Number(String(value ?? '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

/**
 * @param {unknown} label
 */
function crewSize(label) {
  const n = Number(String(label || '').match(/\d+/)?.[0])
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * @param {unknown} value
 */
function liftState(value) {
  const text = String(value || '').trim().toLowerCase()
  if (!text || text === 'n/a' || text === '—' || text === '-') return undefined
  if (text === 'no' || text === 'no lift' || text === 'none' || text === 'false') return false
  if (text === 'yes' || /available/.test(text)) return true
  return undefined
}

function filled(value) {
  const text = String(value || '').trim()
  if (!text || text === 'N/A' || text === '—') return ''
  return text
}

async function logoBytes() {
  try {
    const response = await fetch('/email-logo.png')
    if (!response.ok) return undefined
    return new Uint8Array(await response.arrayBuffer())
  } catch {
    return undefined
  }
}

/**
 * @param {Record<string, unknown>} quote
 * @param {{ internalNotes?: string, adjustmentsSumGbp?: number }} [options]
 */
async function renderJobSheet(quote, options = {}) {
  const model = buildJobSheetPdfModel(quote, options)
  const savedInventory = Array.isArray(quote.inventory) ? quote.inventory : []
  const bytes = await renderInvoicePdf({
    documentKind: 'job_sheet',
    quote: {
      ...quote,
      move_date_label: model.move.date,
      service: model.move.service,
      service_type: model.move.service,
      crew_size: crewSize(model.crewLine) || Number(quote.crew_size) || 0,
      arrival_window: model.move.arrival || quote.arrival_window,
      pickup_address: model.pickup.address,
      delivery_address: model.delivery.address,
      inventory: savedInventory.length
        ? savedInventory
        : (model.inventory || []).map((row) => ({
            name: row.item,
            quantity: Number(row.qty) || 1,
            notes: row.notes,
          })),
      issued_on_label: model.generatedAt,
      paid_on_label: model.payment.paidOn,
      office_notes: options.internalNotes || '',
    },
    stops: [
      {
        stop_type: 'pickup',
        contact_name: filled(model.pickup.contactName),
        contact_phone: filled(model.pickup.phone),
        address_line_1: model.pickup.address,
        floor: filled(model.pickup.floor),
        lift_available: liftState(model.pickup.lift),
      },
      {
        stop_type: 'delivery',
        contact_name: filled(model.delivery.contactName),
        contact_phone: filled(model.delivery.phone),
        address_line_1: model.delivery.address,
        floor: filled(model.delivery.floor),
        lift_available: liftState(model.delivery.lift),
      },
    ],
    quoteRef: model.quoteRef,
    invoiceNumber: model.quoteRef,
    amountPaidGbp: money(model.payment.paid),
    invoiceTotalGbp: money(model.payment.estimatedTotal),
    remainingBalanceGbp: money(model.payment.balance),
    paymentTypeLabel: model.payment.method,
    logoPng: await logoBytes(),
  })
  return { bytes, filename: jobSheetFilename(model) }
}

/**
 * @param {Uint8Array} bytes
 * @param {string} filename
 */
function downloadPdf(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * @param {Record<string, unknown>} quote
 * @param {{ internalNotes?: string, adjustmentsSumGbp?: number }} [options]
 */
async function jobSheetFile(quote, options = {}) {
  try {
    return await renderJobSheet(quote, options)
  } catch (e) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('[Job Sheet PDF]', e)
    }
    throw new Error(JOB_SHEET_PDF_ERROR)
  }
}

/**
 * @param {Record<string, unknown>} quote
 * @param {{ internalNotes?: string, adjustmentsSumGbp?: number }} [options]
 */
export async function generateJobSheetPdf(quote, options = {}) {
  const { bytes, filename } = await jobSheetFile(quote, options)
  downloadPdf(bytes, filename)
}

/**
 * Opens the job sheet in the page so it can be read before downloading.
 * @param {Record<string, unknown>} quote
 * @param {{ internalNotes?: string, adjustmentsSumGbp?: number }} [options]
 * @returns {Promise<string>}
 */
export async function previewJobSheetPdf(quote, options = {}) {
  const { bytes } = await jobSheetFile(quote, options)
  return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
}

/**
 * @param {Record<string, unknown>} quote
 * @param {{ internalNotes?: string, adjustmentsSumGbp?: number }} [options]
 * @returns {Promise<Blob>}
 */
export async function generateJobSheetPdfBlob(quote, options = {}) {
  try {
    const { bytes } = await renderJobSheet(quote, options)
    return new Blob([bytes], { type: 'application/pdf' })
  } catch (e) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('[Job Sheet PDF]', e)
    }
    throw new Error(JOB_SHEET_PDF_ERROR)
  }
}

export { buildJobSheetPdfModel }
