import {
  quoteContactFieldSelector,
  scheduleQuoteValidationScroll,
} from './quoteWizardScrollToError'

/**
 * Scroll/focus Step 3 "Your details" (contact) fields on validation.
 * @param {'fullName'|'phone'|'email'} [field]
 */
export function scrollToStep3ContactField(field) {
  scheduleQuoteValidationScroll({
    contactField: field,
    hint: field ? quoteContactFieldSelector(field) : '[data-quote-field="contact-details"]',
  })
}

/**
 * @param {Record<string, unknown>} wizard
 * @returns {boolean}
 */
export function step3ContactDetailsValid(wizard) {
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(wizard.email || '').trim())
  return (
    String(wizard.fullName || '').trim().length > 1 &&
    String(wizard.phone || '').trim().length > 5 &&
    emailOk
  )
}

/**
 * @param {Record<string, unknown>} wizard
 * @returns {{ message: string, field: 'fullName'|'phone'|'email' }}
 */
export function step3ContactDetailsError(wizard) {
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(wizard.email || '').trim())
  if (String(wizard.fullName || '').trim().length <= 1) {
    return { message: 'Please enter your full name.', field: 'fullName' }
  }
  if (String(wizard.phone || '').trim().length <= 5) {
    return { message: 'Please enter a valid phone number.', field: 'phone' }
  }
  if (!emailOk) {
    return { message: 'Please enter a valid email address.', field: 'email' }
  }
  return { message: 'Please complete your contact details.', field: 'fullName' }
}
