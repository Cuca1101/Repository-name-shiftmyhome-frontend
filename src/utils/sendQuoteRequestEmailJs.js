import emailjs from '@emailjs/browser'
import { generateQuotePdfBlob } from './generateQuotePdf'
import {
  EMAILJS_PUBLIC_KEY,
  EMAILJS_QUOTE_PDF_ATTACHMENT_PARAM,
  EMAILJS_QUOTE_TO_PARAM,
  EMAILJS_SERVICE_ID,
  EMAILJS_TEMPLATE_ID,
  isQuoteCustomerCopyEnabled,
  isQuotePdfAttachmentEnabled,
  QUOTE_RECIPIENT_EMAIL,
} from '../emailjs.config'

/**
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onloadend = () => resolve(/** @type {string} */ (r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

/**
 * Sends the quote via EmailJS — optionally attaches the same PDF (Variable Attachment) and can send
 * a second copy to the customer. Requires template setup: see emailjs.config.js comments.
 *
 * @param {Record<string, unknown>} templateParams — same shape as buildQuoteEmailTemplateParams output
 * @param {string} customerEmail
 * @returns {Promise<void>}
 */
export async function sendQuoteRequestEmailJs(templateParams, customerEmail) {
  const options = { publicKey: EMAILJS_PUBLIC_KEY }

  let params = { ...templateParams }

  if (isQuotePdfAttachmentEnabled()) {
    try {
      const blob = await generateQuotePdfBlob(templateParams)
      const dataUrl = await blobToDataUrl(blob)
      params = {
        ...params,
        [EMAILJS_QUOTE_PDF_ATTACHMENT_PARAM]: dataUrl,
      }
    } catch (err) {
      console.warn('[EmailJS] Quote PDF attachment skipped:', err)
    }
  }

  params = {
    ...params,
    [EMAILJS_QUOTE_TO_PARAM]: QUOTE_RECIPIENT_EMAIL,
  }

  await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params, options)

  if (
    isQuoteCustomerCopyEnabled() &&
    typeof customerEmail === 'string' &&
    customerEmail.trim().length > 3
  ) {
    const customerParams = {
      ...params,
      [EMAILJS_QUOTE_TO_PARAM]: customerEmail.trim(),
    }
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, customerParams, options)
  }
}
