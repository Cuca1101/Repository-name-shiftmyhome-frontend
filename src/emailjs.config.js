/**
 * EmailJS — https://dashboard.emailjs.com
 *
 * Three different IDs (do not mix them up):
 *
 * 1. Public Key — Account → API keys → Public Key → use as `publicKey`.
 * 2. Service ID — Email Services (e.g. Gmail) → looks like `service_xxxxxx` → use as `serviceId` only.
 * 3. Template ID — Email Templates → looks like `template_xxxxxx` → use as `templateId` only.
 *
 * If EmailJS says “template not found”, you almost certainly put the Service ID in `templateId`,
 * or left a placeholder. Open Email Templates and copy the Template ID from there — not from Services.
 */

export const EMAILJS_CONFIG = {
  publicKey: 'uFtYsbGRgWA40MTvt',
  serviceId: 'service_ol0az4s',
  templateId: 'template_1xvx28a',
}

const TEMPLATE_ID_PLACEHOLDERS = new Set([
  '',
  'PUT_TEMPLATE_ID_HERE',
  'YOUR_TEMPLATE_ID',
  'YOUR_TEMPLATE_ID_HERE',
])

/**
 * True when public key, service, and a real-looking template id are set.
 * Rejects placeholders and mistaken use of `service_*` as the template id.
 */
export function isEmailJsReady() {
  const k = EMAILJS_CONFIG.publicKey?.trim()
  const s = EMAILJS_CONFIG.serviceId?.trim()
  const t = EMAILJS_CONFIG.templateId?.trim()
  if (!k || !s || !t) return false
  if (TEMPLATE_ID_PLACEHOLDERS.has(t)) return false
  if (t.startsWith('service_')) return false
  return t.startsWith('template_')
}

/** Shown when template id is missing, still a placeholder, or confused with the service id. */
export const EMAILJS_TEMPLATE_ID_GUIDE =
  'Set templateId in src/emailjs.config.js to your Template ID from https://dashboard.emailjs.com/admin/templates (it starts with template_). service_ol0az4s is your Gmail Service ID and belongs in serviceId only — not in templateId.'

/** @deprecated Use EMAILJS_CONFIG — kept for QuoteWizard / QuoteForm imports */
export const EMAILJS_PUBLIC_KEY = EMAILJS_CONFIG.publicKey
export const EMAILJS_SERVICE_ID = EMAILJS_CONFIG.serviceId
export const EMAILJS_TEMPLATE_ID = EMAILJS_CONFIG.templateId

/** Quote requests are routed to this inbox (also pass to template as {{admin_email}}). */
export const QUOTE_RECIPIENT_EMAIL = 'admin@shiftmyhome.co.uk'

/**
 * EmailJS Variable Attachment — parameter name must match your template:
 * Email Templates → your quote template → Attachments → add “Variable Attachment” → Parameter name.
 * @see https://www.emailjs.com/docs/user-guide/file-attachments
 *
 * Optional env override: VITE_EMAILJS_QUOTE_PDF_PARAM
 */
export const EMAILJS_QUOTE_PDF_ATTACHMENT_PARAM =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_EMAILJS_QUOTE_PDF_PARAM?.trim()) ||
  'quote_pdf'

/**
 * Dynamic “To” address for sending admin + customer copies with the same template.
 * Set the template’s “To” field to: {{quote_to_email}}
 *
 * Optional env: VITE_EMAILJS_QUOTE_TO_PARAM
 */
export const EMAILJS_QUOTE_TO_PARAM =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_EMAILJS_QUOTE_TO_PARAM?.trim()) ||
  'quote_to_email'

/** Set VITE_EMAILJS_QUOTE_PDF_ATTACHMENT=false to disable PDF generation for EmailJS (emails still send). */
export function isQuotePdfAttachmentEnabled() {
  if (typeof import.meta === 'undefined') return true
  return import.meta.env?.VITE_EMAILJS_QUOTE_PDF_ATTACHMENT !== 'false'
}

/** Set VITE_EMAILJS_QUOTE_CUSTOMER_COPY=false to only email the admin inbox (one send). */
export function isQuoteCustomerCopyEnabled() {
  if (typeof import.meta === 'undefined') return true
  return import.meta.env?.VITE_EMAILJS_QUOTE_CUSTOMER_COPY !== 'false'
}

/**
 * Frontend EmailJS attachments: supported via Variable Attachment (base64 / data URL in templateParams).
 * Limits: large payloads may hit request size limits; template must be configured in the dashboard.
 *
 * If you need server-side reliability, larger files, or advanced routing:
 * - Supabase Edge Function or small Node service: generate PDF (e.g. Puppeteer, pdf-lib) or reuse HTML,
 *   then send with Resend / SendGrid / Nodemailer + SMTP. Keep EmailJS for simple flows or migrate fully.
 */
