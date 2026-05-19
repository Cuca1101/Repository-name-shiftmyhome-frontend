/**
 * Site contact & messaging — re-exported from companyContact (single source of truth).
 */
import {
  COMPANY_PHONE,
  COMPANY_PHONE_DISPLAY,
  COMPANY_PHONE_TEL,
  COMPANY_PHONE_E164,
  COMPANY_PHONE_WHATSAPP,
  COMPANY_EMAIL,
  WHATSAPP_URL,
  WHATSAPP_SUPPORT_URL,
  WHATSAPP_ME_URL,
  COMPANY_CONTACT,
} from './constants/companyContact'

export {
  COMPANY_PHONE,
  COMPANY_PHONE_DISPLAY,
  COMPANY_PHONE_TEL,
  COMPANY_PHONE_E164,
  COMPANY_PHONE_WHATSAPP,
  COMPANY_EMAIL,
  WHATSAPP_URL,
  WHATSAPP_SUPPORT_URL,
  WHATSAPP_ME_URL,
}

export const CONTACT = COMPANY_CONTACT

/** @deprecated Use WHATSAPP_URL — kept for any old imports */
export function getWhatsAppUrl() {
  return WHATSAPP_URL
}
