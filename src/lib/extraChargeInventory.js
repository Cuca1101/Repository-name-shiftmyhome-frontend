/**
 * Resolve driver "Add item" rows against Items Library → pricing engine line items.
 */

const MIN_M3 = 0.01

/**
 * @param {string} s
 */
export function normalizeItemName(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/**
 * @typedef {Object} DriverAddedItem
 * @property {string} [name]
 * @property {number} [quantity]
 * @property {number} [volume_m3]
 * @property {string} [notes]
 * @property {string} [weight_type]
 * @property {string} [library_item_id]
 * @property {string} [catalog_id]
 */

/**
 * @typedef {Object} ResolvedExtraLineItem
 * @property {string} name
 * @property {number} quantity
 * @property {number} volumePerUnitM3
 * @property {number} handlingMultiplier
 * @property {string} weightType
 * @property {string|null} libraryItemId
 * @property {string|null} notes
 * @property {boolean} matchedLibrary
 */

/**
 * @param {DriverAddedItem[]} addedItems
 * @param {Array<{ id: string, name: string, cubic_metres?: number, weight_type?: string, handling_multiplier?: number }>} library
 * @returns {ResolvedExtraLineItem[]}
 */
export function resolveDriverItemsToLineItems(addedItems, library = []) {
  /** @type {Map<string, typeof library[0]>} */
  const byName = new Map()
  /** @type {Map<string, typeof library[0]>} */
  const byId = new Map()
  for (const row of library || []) {
    if (!row?.id) continue
    byId.set(String(row.id), row)
    const n = normalizeItemName(row.name)
    if (n) byName.set(n, row)
  }

  const list = Array.isArray(addedItems) ? addedItems : []
  return list.map((item) => {
    const qty = Math.max(1, Math.round(Number(item?.quantity) || 1))
    const libId = String(item?.library_item_id || item?.catalog_id || '').trim()
    const matched = (libId && byId.get(libId)) || byName.get(normalizeItemName(item?.name)) || null

    let volumePerUnit = Number(item?.volume_m3)
    if (!Number.isFinite(volumePerUnit) || volumePerUnit <= 0) {
      volumePerUnit =
        matched?.cubic_metres != null && Number(matched.cubic_metres) > 0
          ? Number(matched.cubic_metres)
          : MIN_M3
    }

    const weightType = String(item?.weight_type || matched?.weight_type || 'medium').trim() || 'medium'
    const handling =
      Number(matched?.handling_multiplier) > 0 ? Number(matched.handling_multiplier) : 1

    return {
      name: String(item?.name || matched?.name || 'Item').trim() || 'Item',
      quantity: qty,
      volumePerUnitM3: Math.max(MIN_M3, volumePerUnit),
      handlingMultiplier: handling,
      weightType,
      libraryItemId: matched?.id ? String(matched.id) : libId || null,
      notes: item?.notes != null ? String(item.notes) : null,
      matchedLibrary: Boolean(matched),
    }
  })
}

/**
 * Enriched JSON stored on extra_charge_requests.added_items (driver + pricing metadata).
 *
 * @param {ResolvedExtraLineItem[]} lineItems
 * @param {import('./extraChargePricing.js').ExtraItemsChargeResult} [pricing]
 */
export function lineItemsToStoredAddedItems(lineItems, pricing) {
  const breakdownByName = new Map()
  if (pricing?.itemLines) {
    for (const row of pricing.itemLines) {
      breakdownByName.set(normalizeItemName(row.name), row)
    }
  }

  return lineItems.map((row) => {
    const detail = breakdownByName.get(normalizeItemName(row.name))
    return {
      name: row.name,
      quantity: row.quantity,
      volume_m3: row.volumePerUnitM3,
      volume_per_unit_m3: row.volumePerUnitM3,
      weight_type: row.weightType,
      library_item_id: row.libraryItemId,
      handling_multiplier: row.handlingMultiplier,
      matched_library: row.matchedLibrary,
      notes: row.notes,
      line_volume_m3: detail?.lineVolumeM3 ?? row.quantity * row.volumePerUnitM3 * row.handlingMultiplier,
      line_amount_gbp: detail?.lineAmountGbp ?? null,
    }
  })
}
