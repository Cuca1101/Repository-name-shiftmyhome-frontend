/**
 * Normalise a customer telephone number to E.164.
 * UK national numbers that start with 0 become +44.
 * @param {string} input
 * @returns {{ ok: true, e164: string } | { ok: false, error: string }}
 */
export function normalisePhone(input) {
  const raw = String(input || '').trim()
  if (!raw) return { ok: false, error: 'Enter a telephone number.' }
  let compact = raw.replace(/[\s().-]/g, '')
  if (compact.startsWith('00')) compact = `+${compact.slice(2)}`
  if (compact.startsWith('+')) {
    if (!/^\+[1-9]\d{7,14}$/.test(compact)) {
      return { ok: false, error: 'That telephone number is not valid. Use a full number such as +447440365226.' }
    }
    return { ok: true, e164: compact }
  }
  if (!compact.startsWith('0')) {
    return { ok: false, error: 'Enter a UK number starting with 0, or an international number starting with +.' }
  }
  const national = compact.slice(1)
  if (!/^\d{10}$/.test(national)) {
    return { ok: false, error: 'That UK telephone number is not valid. Check the digits and try again.' }
  }
  return { ok: true, e164: `+44${national}` }
}

/** @param {string} input */
export function phonesMatch(left, right) {
  const a = normalisePhone(left)
  const b = normalisePhone(right)
  return a.ok && b.ok && a.e164 === b.e164
}
