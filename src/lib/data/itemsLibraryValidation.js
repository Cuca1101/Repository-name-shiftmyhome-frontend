import { WEIGHT_TYPES } from '../../constants/weightTypes'

/**
 * @param {unknown} category
 */
export function isNumericOnlyCategory(category) {
  const c = String(category ?? '').trim()
  return c.length > 0 && /^\d+$/.test(c)
}

/**
 * Invalid rows from a bad import or corrupt storage.
 * @param {{ name?: string, category?: string, cubic_metres?: unknown, handling_multiplier?: unknown }} row
 */
export function isBrokenLibraryRow(row) {
  if (!row || typeof row !== 'object') return true

  const category = row.category
  if (category === null || category === undefined) return true
  const catStr = String(category).trim()
  if (!catStr || isNumericOnlyCategory(catStr)) return true

  const name = String(row.name ?? '').trim()
  if (!name) return true

  if (row.cubic_metres === null || row.cubic_metres === undefined) return true
  const m3 = Number(row.cubic_metres)
  if (!Number.isFinite(m3) || m3 <= 0) return true

  if (row.handling_multiplier === null || row.handling_multiplier === undefined) return true
  const mult = Number(row.handling_multiplier)
  if (!Number.isFinite(mult) || mult <= 0) return true

  return false
}

/** @param {Parameters<typeof isBrokenLibraryRow>[0]} row */
export function isValidLibraryRow(row) {
  return !isBrokenLibraryRow(row)
}

/**
 * @param {string} weightType
 */
export function toLibraryWeightType(weightType) {
  const w = String(weightType || 'medium').toLowerCase()
  return WEIGHT_TYPES.includes(w) ? w : 'medium'
}
