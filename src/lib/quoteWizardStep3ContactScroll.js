/**
 * Scroll/focus Step 3 "Your details" (contact) fields on validation — desktop vs mobile sections.
 * @param {'fullName'|'phone'|'email'} [field]
 */
export function scrollToStep3ContactField(field) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const mobile = window.matchMedia('(max-width: 767px)').matches
  const suffix = mobile ? 'mobile' : 'desktop'
  const section = document.getElementById(`quote-wizard-contact-details-${suffix}`)
  if (section) {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (!field) return

  const input = document.getElementById(`quote-wizard-${field}-${suffix}`)
  if (!input || typeof input.focus !== 'function') return

  window.setTimeout(() => {
    try {
      input.focus({ preventScroll: true })
    } catch {
      input.focus()
    }
  }, 350)
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
