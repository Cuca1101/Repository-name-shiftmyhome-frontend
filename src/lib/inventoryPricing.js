/**
 * Inventory volume & specialist heavy-fee rules for the shared pricing engine.
 * Physical m³ is never inflated by handling multipliers for capacity or price.
 */

const money = (n) => Math.round(n * 100) / 100

/**
 * @param {unknown} value
 * @returns {number | null} finite number, or null when unset / blank
 */
export function parseOptionalMoneyField(value) {
  if (value === undefined || value === null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * Raw physical volume (van capacity + priced m³). Ignores handlingMultiplier.
 * @param {import('./pricingCalculator.js').QuoteLineItem[]} lineItems
 */
export function sumInventoryVolumeRaw(lineItems) {
  let total = 0
  for (const row of lineItems || []) {
    const q = Number(row.quantity) || 0
    const v = Number(row.volumePerUnitM3) || 0
    total += q * v
  }
  return money(total)
}

/**
 * @deprecated Use sumInventoryVolumeRaw — multipliers no longer inflate billed volume.
 * @param {import('./pricingCalculator.js').QuoteLineItem[]} lineItems
 */
export function sumInventoryVolume(lineItems) {
  return sumInventoryVolumeRaw(lineItems)
}

/**
 * Count units that require a 2-person crew for safe handling (weightType heavy).
 * @param {import('./pricingCalculator.js').QuoteLineItem[]} lineItems
 */
export function countHeavyItemsForCrew(lineItems) {
  let n = 0
  for (const row of lineItems || []) {
    if (String(row.weightType || '').toLowerCase() === 'heavy') {
      n += Math.max(0, Number(row.quantity) || 0)
    }
  }
  return n
}

/**
 * Specialist / exceptional heavy surcharge — admin chooses via Weight type = Heavy.
 * Ordinary awkward items should use Large/Medium (not Heavy) so they are not charged.
 * handlingMultiplier is ignored for pricing.
 * Items with an explicit handling fee override use that amount instead (see resolveItemHandlingFeeGbp).
 *
 * @param {import('./pricingCalculator.js').QuoteLineItem | Record<string, unknown>} row
 */
export function lineItemAppliesHeavyHandlingFee(row) {
  if (!row || typeof row !== 'object') return false
  if (row.appliesHeavyHandlingFee === true || row.heavyFee === true) return true
  if (row.appliesHeavyHandlingFee === false || row.heavyFee === false) return false
  // Email/inventory_text often stores "heavy, heavy" or "large, heavy" in the size band.
  const wt = String(row.weightType || row.weight_type || '').toLowerCase()
  return wt === 'heavy' || /\bheavy\b/.test(wt)
}

/**
 * Optional per-item handling fee (£). null = use global Heavy fee when applicable.
 * 0 = no handling fee for this item.
 * @param {Record<string, unknown>} row
 * @returns {number | null}
 */
export function lineItemHandlingFeeOverride(row) {
  if (!row || typeof row !== 'object') return null
  return parseOptionalMoneyField(
    row.handlingFeeOverride ?? row.handling_fee_override ?? row.handlingFeeGbp,
  )
}

/**
 * Optional special stair fee per floor (£). null = use standard floor/no-lift stairs.
 * Any finite value (including 0) activates the special stair tariff for this item.
 * @param {Record<string, unknown>} row
 * @returns {number | null}
 */
export function lineItemSpecialStairFeePerFloor(row) {
  if (!row || typeof row !== 'object') return null
  return parseOptionalMoneyField(
    row.specialStairFeePerFloor ??
      row.special_stair_fee_per_floor ??
      row.specialStairFeeGbp,
  )
}

/**
 * @param {Record<string, unknown>} row
 */
export function lineItemHasSpecialStairFee(row) {
  return lineItemSpecialStairFeePerFloor(row) != null
}

/**
 * Handling £ per unit for one inventory row.
 * Override (including 0) wins; otherwise global specialist heavy rate when Heavy.
 *
 * @param {Record<string, unknown>} row
 * @param {number} globalHeavyRate
 */
export function resolveItemHandlingFeeGbp(row, globalHeavyRate) {
  const override = lineItemHandlingFeeOverride(row)
  if (override != null) return Math.max(0, override)
  if (lineItemAppliesHeavyHandlingFee(row)) {
    return Math.max(0, Number(globalHeavyRate) || 0)
  }
  return 0
}

/**
 * True when this row uses a custom handling line (not the aggregated specialist heavy bucket).
 * @param {Record<string, unknown>} row
 */
export function lineItemUsesCustomHandlingLine(row) {
  return lineItemHandlingFeeOverride(row) != null || lineItemHasSpecialStairFee(row)
}

/**
 * @param {import('./pricingCalculator.js').QuoteLineItem[]} lineItems
 */
export function countSpecialistHeavyItems(lineItems) {
  let n = 0
  for (const row of lineItems || []) {
    if (lineItemUsesCustomHandlingLine(row)) continue
    if (lineItemAppliesHeavyHandlingFee(row)) {
      n += Math.max(0, Number(row.quantity) || 0)
    }
  }
  return n
}

/**
 * Named units that make up the Specialist heavy handling charge (for admin breakdown UI).
 * Excludes items billed via per-item handling override / special stair lines.
 * @param {Array<Record<string, unknown>>|null|undefined} lineItems
 * @returns {{ name: string, quantity: number }[]}
 */
export function listSpecialistHeavyItemDetails(lineItems) {
  /** @type {{ name: string, quantity: number }[]} */
  const out = []
  for (const row of lineItems || []) {
    if (lineItemUsesCustomHandlingLine(row)) continue
    if (!lineItemAppliesHeavyHandlingFee(row)) continue
    const quantity = Math.max(0, Number(row.quantity) || 0)
    if (quantity <= 0) continue
    const name = String(row.name ?? row.item_name ?? 'Item').trim() || 'Item'
    out.push({ name, quantity })
  }
  return out
}

/**
 * Volume of items that still use standard floor / no-lift / stairs charges.
 * Items with a special stair fee are excluded (avoids double-charging & vol multipliers).
 * @param {import('./pricingCalculator.js').QuoteLineItem[]} lineItems
 */
export function sumStandardAccessInventoryVolume(lineItems) {
  let total = 0
  for (const row of lineItems || []) {
    if (lineItemHasSpecialStairFee(row)) continue
    const q = Number(row.quantity) || 0
    const v = Number(row.volumePerUnitM3) || 0
    total += q * v
  }
  return money(total)
}

/**
 * @param {import('./pricingCalculator.js').QuoteLineItem[]} lineItems
 */
export function inventoryHasSpecialStairItems(lineItems) {
  for (const row of lineItems || []) {
    if (!lineItemHasSpecialStairFee(row)) continue
    if ((Number(row.quantity) || 0) > 0) return true
  }
  return false
}

/**
 * @param {import('./pricingCalculator.js').QuoteLineItem[]} lineItems
 */
export function inventoryHasOnlySpecialStairItems(lineItems) {
  const list = lineItems || []
  let any = false
  for (const row of list) {
    const q = Math.max(0, Number(row.quantity) || 0)
    if (q <= 0) continue
    any = true
    if (!lineItemHasSpecialStairFee(row)) return false
  }
  return any
}

/**
 * Taxable floors for a special-stair item at one address.
 * Lift alone does not waive floors — suitability for the item's size/weight must be confirmed,
 * and there must be no extra stair flights on the job.
 *
 * @param {number} floorLevels — from effectiveFloorLevelsForPricing
 * @param {{
 *   liftExplicit?: boolean,
 *   liftYes?: boolean,
 *   liftSuitableForItem?: boolean | null,
 *   stairsFlights?: number,
 * }} opts
 */
export function taxableFloorsForSpecialStairItem(floorLevels, opts = {}) {
  const floors = Math.max(0, Number(floorLevels) || 0)
  if (floors <= 0) return 0
  const flights = Math.max(0, Number(opts.stairsFlights) || 0)
  const suitable = opts.liftSuitableForItem === true
  const liftOk = Boolean(opts.liftExplicit) && Boolean(opts.liftYes) && suitable && flights <= 0
  return liftOk ? 0 : floors
}

/**
 * Build per-item specialist handling + special stair breakdown lines.
 * Formula per unit: handling + stairPerFloor × (taxablePickup + taxableDelivery).
 * Display splits handling vs stairs; amounts are never multiplied by move volume.
 *
 * @param {import('./pricingCalculator.js').QuoteLineItem[]} lineItems
 * @param {{
 *   globalHeavyRate: number,
 *   pickupFloorLevels: number,
 *   deliveryFloorLevels: number,
 *   pickupLiftExplicit: boolean,
 *   deliveryLiftExplicit: boolean,
 *   pickupLift: boolean,
 *   deliveryLift: boolean,
 *   pickupLiftSuitableForSpecialItems?: boolean | null,
 *   deliveryLiftSuitableForSpecialItems?: boolean | null,
 *   stairsFlights?: number,
 * }} ctx
 * @returns {{ label: string, amount: number }[]}
 */
export function buildSpecialItemAccessLines(lineItems, ctx) {
  /** @type {{ label: string, amount: number }[]} */
  const lines = []
  const globalHeavy = Math.max(0, Number(ctx.globalHeavyRate) || 0)
  const pickupTaxableBase = taxableFloorsForSpecialStairItem(ctx.pickupFloorLevels, {
    liftExplicit: ctx.pickupLiftExplicit,
    liftYes: ctx.pickupLift,
    liftSuitableForItem: ctx.pickupLiftSuitableForSpecialItems,
    stairsFlights: ctx.stairsFlights,
  })
  const deliveryTaxableBase = taxableFloorsForSpecialStairItem(ctx.deliveryFloorLevels, {
    liftExplicit: ctx.deliveryLiftExplicit,
    liftYes: ctx.deliveryLift,
    liftSuitableForItem: ctx.deliveryLiftSuitableForSpecialItems,
    stairsFlights: ctx.stairsFlights,
  })

  for (const row of lineItems || []) {
    const qty = Math.max(0, Number(row.quantity) || 0)
    if (qty <= 0) continue

    const name = String(row.name ?? row.item_name ?? 'Item').trim() || 'Item'
    const handlingPerUnit = resolveItemHandlingFeeGbp(row, globalHeavy)
    const stairPerFloor = lineItemSpecialStairFeePerFloor(row)
    const usesCustom = lineItemUsesCustomHandlingLine(row)

    if (usesCustom && handlingPerUnit > 0) {
      const handlingAmt = money(qty * handlingPerUnit)
      if (handlingAmt > 0) {
        lines.push({
          label: `${name} – specialist handling`,
          amount: handlingAmt,
        })
      }
    }

    if (stairPerFloor != null) {
      const perFloor = Math.max(0, stairPerFloor)
      const floorSum = pickupTaxableBase + deliveryTaxableBase
      const stairsAmt = money(qty * perFloor * floorSum)
      if (stairsAmt > 0) {
        lines.push({
          label: `${name} – stairs`,
          amount: stairsAmt,
        })
      }
    }
  }

  return lines
}
