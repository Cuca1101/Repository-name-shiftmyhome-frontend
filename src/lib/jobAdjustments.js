/** @typedef {'extra_charge'|'access_stairs'|'waiting_time'|'discount'|'inventory_change'|'other'} JobAdjustmentType */

/** @typedef {{
 *   id: string,
 *   type: JobAdjustmentType | string,
 *   description: string,
 *   amountGbp: number,
 *   createdAt: string,
 *   createdBy?: string,
 *   updatedAt?: string,
 *   status?: 'pending'|'paid',
 * }} JobAdjustmentRow */

export const JOB_ADJUSTMENT_TYPES = [
  { value: 'extra_charge', label: 'Extra charge' },
  { value: 'access_stairs', label: 'Access / stairs' },
  { value: 'waiting_time', label: 'Waiting time' },
  { value: 'discount', label: 'Discount' },
  { value: 'inventory_change', label: 'Inventory change' },
  { value: 'other', label: 'Other' },
]

/** @param {unknown} type */
export function jobAdjustmentTypeLabel(type) {
  const v = String(type || 'other')
  return JOB_ADJUSTMENT_TYPES.find((t) => t.value === v)?.label ?? v.replace(/_/g, ' ')
}

/** @param {unknown} row */
export function normalizeJobAdjustment(row) {
  if (!row || typeof row !== 'object') return null
  const id = String(row.id || '').trim()
  if (!id) return null
  const amount = Number(row.amountGbp)
  return {
    id,
    type: String(row.type || 'other'),
    description: String(row.description || '').trim(),
    amountGbp: Number.isFinite(amount) ? amount : 0,
    createdAt: String(row.createdAt || new Date().toISOString()),
    createdBy: row.createdBy != null ? String(row.createdBy).trim() : '',
    updatedAt: row.updatedAt != null ? String(row.updatedAt) : '',
    status: row.status === 'paid' ? 'paid' : 'pending',
  }
}

/** @param {unknown[]} list */
export function normalizeJobAdjustments(list) {
  if (!Array.isArray(list)) return []
  return list.map(normalizeJobAdjustment).filter(Boolean)
}

/** @param {JobAdjustmentRow[]} adjustments */
export function sumJobAdjustmentsGbp(adjustments) {
  return (adjustments || []).reduce((s, a) => s + (Number(a.amountGbp) || 0), 0)
}

/** @returns {string} */
export function newJobAdjustmentId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `adj-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
