/**
 * Official WhatsApp link (number + pre-filled message). Use everywhere for consistency.
 */
export const WHATSAPP_URL =
  'https://wa.me/447466510975?text=Hi%2C%20I%20need%20a%20removals%20quote'

/** WhatsApp pre-filled message for general support / help (CTAs, footer variants). */
export const WHATSAPP_SUPPORT_URL =
  'https://wa.me/447466510975?text=Hi%2C%20I%20need%20help%20with%20a%20removals%20quote'

/** @deprecated Use WHATSAPP_URL — kept for any old imports */
export function getWhatsAppUrl() {
  return WHATSAPP_URL
}

export const CONTACT = {
  phoneDisplay: '07466510975',
  phoneTel: '07466510975',
  email: 'admin@shiftmyhome.co.uk',
}
