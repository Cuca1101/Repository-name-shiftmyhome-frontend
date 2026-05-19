import { buildJobSheetPdfModel } from '../lib/buildJobSheetPdfModel'
import { saveJobSheetHtmlAsPdf } from '../lib/PdfGenerator'
import { buildMinimalJobSheetHtml, buildQuoteJobSheetHtml } from '../lib/quoteJobSheetPdfHtml'

export const JOB_SHEET_PDF_ERROR = 'Job Sheet PDF could not be generated. Please try again.'

/**
 * @param {ReturnType<typeof buildJobSheetPdfModel>} model
 */
function jobSheetFilename(model) {
  const safeRef = String(model.quoteRef || 'export').replace(/[^\w.-]+/g, '_')
  return `ShiftMyHome-Job-Sheet-${safeRef}.pdf`
}

/**
 * @param {Record<string, unknown>} quote
 * @param {{ internalNotes?: string, adjustmentsSumGbp?: number }} [options]
 * @returns {Promise<{ html: string, filename: string }>}
 */
function buildJobSheetHtmlAndFilename(quote, options = {}) {
  try {
    const model = buildJobSheetPdfModel(quote, options)
    return {
      html: buildQuoteJobSheetHtml(model),
      filename: jobSheetFilename(model),
    }
  } catch (e) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('[Job Sheet PDF] model/html build failed, using minimal fallback', e)
    }
    return {
      html: buildMinimalJobSheetHtml(),
      filename: 'ShiftMyHome-Job-Sheet-export.pdf',
    }
  }
}

/**
 * @param {Record<string, unknown>} quote
 * @param {{ internalNotes?: string, adjustmentsSumGbp?: number }} [options]
 * @returns {Promise<void>}
 */
export async function generateJobSheetPdf(quote, options = {}) {
  const { html, filename } = buildJobSheetHtmlAndFilename(quote, options)
  try {
    await saveJobSheetHtmlAsPdf(html, filename)
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
 * @returns {Promise<Blob>}
 */
export async function generateJobSheetPdfBlob(quote, options = {}) {
  const { html, filename } = buildJobSheetHtmlAndFilename(quote, options)
  try {
    const blob = await saveJobSheetHtmlAsPdf(html, filename, { asBlob: true })
    if (!(blob instanceof Blob)) {
      throw new Error('PDF blob missing')
    }
    return blob
  } catch (e) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('[Job Sheet PDF]', e)
    }
    throw new Error(JOB_SHEET_PDF_ERROR)
  }
}

export { buildJobSheetPdfModel }
