/**
 * Journey driver payout split — total is driver/partner offer (no second platform deduction).
 */

/**
 * @param {unknown} n
 */
export function round2(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

/**
 * @param {number} amount
 * @param {number} count
 * @returns {number[]}
 */
export function distributeEqualPennies(amount, count) {
  if (count <= 0) return []
  const totalCents = Math.round(round2(amount) * 100)
  const base = Math.floor(totalCents / count)
  const remainder = totalCents - base * count
  const out = []
  for (let i = 0; i < count; i++) {
    const cents = base + (i < remainder ? 1 : 0)
    out.push(cents / 100)
  }
  return out
}

/**
 * Unique quote ids from stops or quote rows.
 * @param {string[]} quoteIds
 */
export function uniqueJourneyQuoteIds(quoteIds) {
  return [...new Set((quoteIds || []).map((x) => String(x || '').trim()).filter(Boolean))]
}

/**
 * Split total journey driver payout across jobs. Manual overrides keep their amount;
 * remainder divides equally among non-override jobs.
 *
 * @param {number} totalPayout
 * @param {string[]} quoteIds
 * @param {Record<string, number>} [manualOverrides] quoteId -> £
 * @returns {{
 *   byQuoteId: Record<string, number>,
 *   manualQuoteIds: Set<string>,
 *   perJobAuto: number | null,
 *   total: number,
 * }}
 */
export function splitJourneyDriverPayout(totalPayout, quoteIds, manualOverrides = {}) {
  const ids = uniqueJourneyQuoteIds(quoteIds)
  const total = round2(totalPayout)
  /** @type {Record<string, number>} */
  const byQuoteId = {}
  const manualQuoteIds = new Set()
  let fixedSum = 0

  for (const id of ids) {
    const raw = manualOverrides[id]
    if (raw != null && Number.isFinite(Number(raw)) && Number(raw) >= 0) {
      const amt = round2(raw)
      byQuoteId[id] = amt
      manualQuoteIds.add(id)
      fixedSum += amt
    }
  }

  const autoIds = ids.filter((id) => !manualQuoteIds.has(id))
  const remaining = round2(total - fixedSum)
  let perJobAuto = null

  if (autoIds.length > 0) {
    const shares = distributeEqualPennies(Math.max(0, remaining), autoIds.length)
    autoIds.forEach((id, i) => {
      byQuoteId[id] = shares[i]
    })
    perJobAuto = shares[0] ?? null
  }

  return { byQuoteId, manualQuoteIds, perJobAuto, total }
}

/**
 * Build overrides map from current per-job amounts (all jobs keep their payout).
 * @param {Record<string, number>} currentByQuoteId
 */
export function allJobsAsManualOverrides(currentByQuoteId) {
  /** @type {Record<string, number>} */
  const o = {}
  for (const [id, amt] of Object.entries(currentByQuoteId || {})) {
    if (Number.isFinite(Number(amt))) o[id] = round2(amt)
  }
  return o
}

/**
 * Remove job with charge: reduce journey total by removed job payout; other jobs unchanged.
 *
 * @param {number} journeyTotal
 * @param {number} removedJobPayout
 * @param {Record<string, number>} currentByQuoteId full split before removal
 * @param {string} removedQuoteId
 * @param {string[]} remainingQuoteIds
 */
export function removeJobWithChargePayout(journeyTotal, removedJobPayout, currentByQuoteId, removedQuoteId, remainingQuoteIds) {
  const removed = round2(removedJobPayout)
  const newTotal = round2(Math.max(0, round2(journeyTotal) - removed))
  const remaining = uniqueJourneyQuoteIds(remainingQuoteIds)
  /** @type {Record<string, number>} */
  const byQuoteId = {}
  const manualOverrides = {}

  for (const id of remaining) {
    const prev = currentByQuoteId[id]
    if (prev != null && Number.isFinite(Number(prev))) {
      byQuoteId[id] = round2(prev)
      manualOverrides[id] = byQuoteId[id]
    }
  }

  return {
    newTotal,
    removedPayout: removed,
    byQuoteId,
    manualOverrides,
    perJobAuto: null,
  }
}

/**
 * Remove job without charge: same journey total, redistributed across remaining jobs.
 *
 * @param {number} journeyTotal
 * @param {string[]} remainingQuoteIds
 * @param {Record<string, number>} [manualOverrides]
 */
export function removeJobWithoutChargePayout(journeyTotal, remainingQuoteIds, manualOverrides = {}) {
  const remaining = uniqueJourneyQuoteIds(remainingQuoteIds)
  const filteredOverrides = {}
  for (const id of remaining) {
    if (manualOverrides[id] != null && Number.isFinite(Number(manualOverrides[id]))) {
      filteredOverrides[id] = round2(manualOverrides[id])
    }
  }
  const split = splitJourneyDriverPayout(journeyTotal, remaining, filteredOverrides)
  return { newTotal: split.total, ...split }
}

/**
 * @param {Record<string, unknown>[]} quotes
 * @returns {Record<string, number>}
 */
export function readPerJobPayoutsFromQuotes(quotes) {
  /** @type {Record<string, number>} */
  const m = {}
  for (const q of quotes || []) {
    const id = String(q?.id || '').trim()
    if (!id) continue
    const raw = q.driver_payout_amount ?? q.marketplace_payout_price
    if (raw != null && raw !== '' && Number.isFinite(Number(raw))) {
      m[id] = round2(raw)
    }
  }
  return m
}

/**
 * @param {Record<string, unknown>[]} quotes
 * @returns {Record<string, number>}
 */
export function readManualOverridesFromQuotes(quotes) {
  /** @type {Record<string, number>} */
  const o = {}
  for (const q of quotes || []) {
    const id = String(q?.id || '').trim()
    if (!id) continue
    if (q.driver_payout_manual_override) {
      const raw = q.driver_payout_amount
      if (raw != null && Number.isFinite(Number(raw))) o[id] = round2(raw)
    }
  }
  return o
}
