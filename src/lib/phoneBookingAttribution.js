/**
 * Staff attribution for admin phone quotes.
 * The creator is set once. Later edits append price changes and never replace the creator.
 */

const SNAPSHOT_MARKER = '---SMH_PHONE_BOOKING_WIZARD_JSON---'

/**
 * @param {unknown} value
 * @returns {number | null}
 */
export function roundPhoneBookingMoney(value) {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100) / 100
}

/**
 * Signed-in staff label. A profile name is preferred; otherwise the account email.
 * @param {unknown} user
 */
export function staffNameFromAuthUser(user) {
  const meta =
    user && typeof user === 'object' && user.user_metadata && typeof user.user_metadata === 'object'
      ? user.user_metadata
      : {}
  const name = String(meta.full_name || meta.name || meta.display_name || '').trim()
  if (name) return name
  const email = String(user?.email || '').trim()
  return email || 'Staff'
}

/**
 * @param {string | null | undefined} details
 */
export function quoteCreatorFromDetailsText(details) {
  const text = String(details || '')
  const cut = text.indexOf(SNAPSHOT_MARKER)
  const body = cut >= 0 ? text.slice(0, cut) : text
  const quoteBy = body.match(/Quote by:\s*(.+)/)
  if (quoteBy?.[1]) return quoteBy[1].trim()
  const created = body.match(/Created by admin \(([^)]+)\)/)
  return created?.[1]?.trim() || ''
}

/**
 * @param {unknown} entry
 */
export function normalizePriceChange(entry) {
  if (!entry || typeof entry !== 'object') return null
  const by = String(entry.by || '').trim()
  const at = String(entry.at || '').trim()
  if (!by && !at) return null
  return {
    by,
    at,
    from: roundPhoneBookingMoney(entry.from),
    to: roundPhoneBookingMoney(entry.to),
    reason: String(entry.reason || '').trim(),
  }
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 */
export function priceChangeFromOverrideColumns(row) {
  const by = String(row?.price_override_by || '').trim()
  const to = roundPhoneBookingMoney(row?.agreed_price)
  if (!by || to == null) return null
  return {
    by,
    at: String(row?.price_override_at || row?.created_at || ''),
    from: roundPhoneBookingMoney(row?.calculated_total ?? row?.estimated_total),
    to,
    reason: String(row?.price_override_reason || '').trim(),
  }
}

/**
 * @param {{
 *   existingQuoteBy?: { name?: string, at?: string } | null,
 *   existingChanges?: unknown[],
 *   actor: string,
 *   at: string,
 *   previousFinal: number | null,
 *   nextFinal: number | null,
 *   reason?: string,
 * }} input
 */
export function buildPhoneBookingAttribution({
  existingQuoteBy = null,
  existingChanges = [],
  actor,
  at,
  previousFinal,
  nextFinal,
  reason = '',
}) {
  const name = String(actor || '').trim() || 'Staff'
  const when = at || new Date().toISOString()
  const quoteBy = existingQuoteBy
    ? {
        name: String(existingQuoteBy.name || '').trim(),
        at: String(existingQuoteBy.at || when),
      }
    : { name, at: when }
  const priceChanges = (Array.isArray(existingChanges) ? existingChanges : [])
    .map(normalizePriceChange)
    .filter(Boolean)
  const from = roundPhoneBookingMoney(previousFinal)
  const to = roundPhoneBookingMoney(nextFinal)
  const cleanReason = String(reason || '').trim()
  if (from != null && to != null && Math.abs(from - to) > 0.009) {
    priceChanges.push({ by: name, at: when, from, to, reason: cleanReason })
  } else if (priceChanges.length && to != null) {
    const last = priceChanges[priceChanges.length - 1]
    if (last.to != null && Math.abs(last.to - to) <= 0.009 && last.reason !== cleanReason) {
      priceChanges[priceChanges.length - 1] = { ...last, reason: cleanReason }
    }
  }
  return { quoteBy, priceChanges }
}
