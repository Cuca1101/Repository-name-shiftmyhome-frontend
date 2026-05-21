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

/**
 * Find a catalog line for a catalogue item (id match, then name fallback for library migrations).
 * @param {Array<{ lineId: string, catalogId?: string|null, name?: string, isCustom?: boolean, quantity?: number }>} lines
 * @param {string} itemId
 * @param {string} [itemName]
 */
export function catalogLineForItem(lines, itemId, itemName) {
  const id = String(itemId ?? '')
  const byId = (lines || []).find((l) => !l.isCustom && l.catalogId != null && String(l.catalogId) === id)
  if (byId) return byId
  const norm = String(itemName ?? '').trim().toLowerCase()
  if (!norm) return null
  return (lines || []).find((l) => !l.isCustom && String(l.name ?? '').trim().toLowerCase() === norm) ?? null
}
