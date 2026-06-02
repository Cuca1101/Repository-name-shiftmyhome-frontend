import { formatDateShortUK } from './formatDateDisplay'

/**
 * @param {string} address
 * @param {number} [maxLen]
 */
export function shortenAddress(address, maxLen = 42) {
  const s = String(address || '').trim()
  if (!s) return ''
  if (s.length <= maxLen) return s
  return `${s.slice(0, maxLen - 1)}…`
}

/**
 * @param {string} isoDate YYYY-MM-DD
 */
export function formatDriverDateOfBirth(isoDate) {
  return formatDateShortUK(isoDate)
}

/**
 * Verification badges for driver cards (personal ID docs only).
 * @param {Set<string>|undefined} types
 * @returns {{ key: string, label: string, tone: 'emerald'|'sky'|'violet' }[]}
 */
export function driverVerificationBadges(types) {
  if (!types?.size) return []
  /** @type {{ key: string, label: string, tone: 'emerald'|'sky'|'violet' }[]} */
  const badges = []
  if (types.has('licence_front') && types.has('licence_back')) {
    badges.push({ key: 'licence', label: 'Licence uploaded', tone: 'emerald' })
  } else if (types.has('licence_front') || types.has('licence_back')) {
    badges.push({ key: 'licence-partial', label: 'Licence (partial)', tone: 'sky' })
  }
  if (types.has('passport_id')) {
    badges.push({ key: 'id', label: 'ID uploaded', tone: 'emerald' })
  }
  if (types.has('proof_of_address')) {
    badges.push({ key: 'poa', label: 'Proof of address', tone: 'violet' })
  }
  return badges
}
