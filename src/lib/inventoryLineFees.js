/**
 * Helpers to copy optional per-item handling / stair fee fields across wizard,
 * phone booking, portal, and engine line-item shapes.
 */
import { parseOptionalMoneyField } from './inventoryPricing.js'

/**
 * @param {Record<string, unknown>|null|undefined} source
 * @returns {{ handlingFeeOverride: number | null, specialStairFeePerFloor: number | null }}
 */
export function pickInventoryFeeFields(source) {
  const row = source && typeof source === 'object' ? source : {}
  return {
    handlingFeeOverride: parseOptionalMoneyField(
      row.handlingFeeOverride ?? row.handling_fee_override,
    ),
    specialStairFeePerFloor: parseOptionalMoneyField(
      row.specialStairFeePerFloor ?? row.special_stair_fee_per_floor,
    ),
  }
}

/**
 * Engine QuoteLineItem fee fields from a wizard / catalog inventory line.
 * @param {Record<string, unknown>|null|undefined} line
 */
export function engineFeeFieldsFromInventoryLine(line) {
  const fees = pickInventoryFeeFields(line)
  return {
    handlingFeeOverride: fees.handlingFeeOverride,
    specialStairFeePerFloor: fees.specialStairFeePerFloor,
  }
}

/**
 * Persist fee snapshots on quote inventory JSON / DB rows.
 * @param {Record<string, unknown>|null|undefined} line
 */
export function persistFeeFieldsFromInventoryLine(line) {
  const fees = pickInventoryFeeFields(line)
  return {
    handling_fee_override: fees.handlingFeeOverride,
    special_stair_fee_per_floor: fees.specialStairFeePerFloor,
  }
}
