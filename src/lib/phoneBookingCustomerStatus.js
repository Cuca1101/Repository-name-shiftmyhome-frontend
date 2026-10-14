const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PLACEHOLDER_EMAIL = 'phone-booking@shiftmyhome.local'

export function usableCustomerEmail(value) {
  const email = String(value || '').trim().toLowerCase()
  if (!EMAIL_RE.test(email) || email === PLACEHOLDER_EMAIL) return ''
  return email
}

/** Last 10 digits, so 07… and +44… refer to the same UK number. */
export function phoneMatchKey(value) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.length >= 10 ? digits.slice(-10) : ''
}

/**
 * @param {{
 *   identity?: { ok?: boolean, known?: boolean, booking_count?: number, first_booking_at?: string | null } | null,
 *   customers?: Array<{ full_name?: string, email?: string, phone?: string, booking_count?: number, first_booking_at?: string | null }>,
 *   email?: string,
 *   phone?: string,
 * }} input
 */
export function resolvePhoneBookingCustomerStatus({ identity, customers = [], email = '', phone = '' }) {
  const hasEmail = Boolean(usableCustomerEmail(email))
  const phoneKey = phoneMatchKey(phone)
  if (identity && identity.ok === false) return { error: true }
  if (!hasEmail && !phoneKey && !identity?.ok) return null

  if (identity?.ok && Number(identity.booking_count) > 0) {
    return {
      kind: 'returning',
      count: Number(identity.booking_count) || 0,
      firstBookingAt: identity.first_booking_at || '',
      detail: '',
    }
  }

  const matches = customers.filter((row) => phoneKey && phoneMatchKey(row.phone) === phoneKey && Number(row.booking_count) > 0)
  if (matches.length) {
    const top = [...matches].sort((a, b) => (Number(b.booking_count) || 0) - (Number(a.booking_count) || 0))[0]
    const who = String(top.full_name || top.email || '').trim()
    return {
      kind: 'returning',
      count: Number(top.booking_count) || 0,
      firstBookingAt: top.first_booking_at || '',
      detail: who ? `Same phone as ${who}` : 'Matched by phone',
    }
  }

  if (identity?.ok || phoneKey) {
    return {
      kind: 'new',
      count: 0,
      firstBookingAt: '',
      detail: hasEmail ? 'No previous booking for this email.' : 'No previous booking for this phone.',
    }
  }

  return null
}
