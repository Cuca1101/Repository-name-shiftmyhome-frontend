/**
 * Shared inventory line quantity updates (quote wizard).
 * @param {Array<{ lineId: string, quantity?: number }>} lines
 * @param {string} lineId
 * @param {number} delta
 */
export function applyInventoryLineQuantityDelta(lines, lineId, delta) {
  return (lines || [])
    .map((r) =>
      r.lineId === lineId
        ? { ...r, quantity: Math.max(0, (Number(r.quantity) || 0) + delta) }
        : r,
    )
    .filter((r) => r.quantity > 0)
}
