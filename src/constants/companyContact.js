/**
 * Official ShiftMyHome business contact — single source of truth for UI, tel: links, and schema.org.
 */

/** UK national format (no spaces) — use in UI and tel: links. */
export const COMPANY_PHONE = '07466510975'

/** @deprecated Alias for COMPANY_PHONE — prefer COMPANY_PHONE. */
export const COMPANY_PHONE_DISPLAY = COMPANY_PHONE

/** tel: href value (digits only, no spaces). */
export const COMPANY_PHONE_TEL = COMPANY_PHONE

/** E.164 for schema.org / Google structured data. */
export const COMPANY_PHONE_E164 = '+447466510975'

/** WhatsApp wa.me digits (country code, no +). */
export const COMPANY_PHONE_WHATSAPP = '447466510975'

export const COMPANY_EMAIL = 'admin@shiftmyhome.co.uk'

const WHATSAPP_QUOTE_TEXT = encodeURIComponent('Hi, I need a removals quote')
const WHATSAPP_SUPPORT_TEXT = encodeURIComponent('Hi, I need help with a removals quote')

export const WHATSAPP_URL = `https://wa.me/${COMPANY_PHONE_WHATSAPP}?text=${WHATSAPP_QUOTE_TEXT}`

export const WHATSAPP_SUPPORT_URL = `https://wa.me/${COMPANY_PHONE_WHATSAPP}?text=${WHATSAPP_SUPPORT_TEXT}`

/** Base WhatsApp link (no pre-filled message) — CMS footer default. */
export const WHATSAPP_ME_URL = `https://wa.me/${COMPANY_PHONE_WHATSAPP}`

/** Areas served in structured data. */
export const COMPANY_AREA_SERVED = [
  { '@type': 'Country', name: 'United Kingdom' },
  { '@type': 'AdministrativeArea', name: 'Scotland' },
]

/**
 * Official social profile URLs for schema.org sameAs (add URLs here when live).
 * @type {string[]}
 */
export const COMPANY_SAME_AS_URLS = []

/**
 * @param {string[]} urls
 * @returns {string[]}
 */
export function filterValidSameAsUrls(urls) {
  if (!Array.isArray(urls)) return []
  return urls
    .map((u) => String(u || '').trim())
    .filter((u) => /^https?:\/\/.+/i.test(u))
}

export const COMPANY_CONTACT = {
  phoneDisplay: COMPANY_PHONE,
  phoneTel: COMPANY_PHONE_TEL,
  email: COMPANY_EMAIL,
}
