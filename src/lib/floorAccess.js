/**
 * Lift question — all floors except ground (basement counts like 1st floor).
 * @param {number | null | undefined} floor
 */
export function floorNeedsLiftQuestion(floor) {
  if (floor == null || !Number.isFinite(Number(floor))) return false
  return Number(floor) !== 0
}

export function floorHasLiftPricing(floor) {
  return floorNeedsLiftQuestion(floor)
}

/**
 * Per-floor access charges: basement = 1 level, ground = 0, 1st+ = as selected.
 * @param {number | null | undefined} floor
 */
export function effectiveFloorLevelsForPricing(floor) {
  if (floor == null || !Number.isFinite(Number(floor))) return 0
  const n = Number(floor)
  if (n === 0) return 0
  if (n === -1) return 1
  return Math.max(0, n)
}

/** Wizard / pricing: lift is only stored when the floor is not ground. */
export function liftValueForFloor(floor, lift) {
  if (!floorNeedsLiftQuestion(floor)) return null
  return lift == null ? null : Boolean(lift)
}

/** Email / admin display — omit lift on ground floor only. */
export function formatAccessLiftLabel(floor, lift) {
  if (!floorNeedsLiftQuestion(floor)) return null
  if (lift == null) return null
  return lift === true ? 'Yes' : 'No'
}

/**
 * With-lift access as % of the full no-lift stairs stack (floor + no-lift rates).
 * Default 50. Set 40 for 40%. Set 0 to use legacy floors-only (+ optional yes-lift £).
 * @param {Record<string, unknown>|null|undefined} settings
 */
export function resolveWithLiftAccessPercentOfNoLift(settings) {
  const raw = settings?.withLiftAccessPercentOfNoLift
  if (raw === undefined || raw === null || raw === '') return 50
  const n = Number(raw)
  if (!Number.isFinite(n)) return 50
  return Math.max(0, Math.min(100, n))
}

/**
 * Full no-lift stairs £ for one end (before with-lift %).
 * @param {number} floorLevels
 * @param {number} perFloorRate
 * @param {number} noLiftFlat
 * @param {number} [accessVolumeMultiplier=1]
 */
export function fullNoLiftStairsAccessAmount(
  floorLevels,
  perFloorRate,
  noLiftFlat,
  accessVolumeMultiplier = 1,
) {
  const floors = Math.max(0, Number(floorLevels) || 0)
  const perFloor = Math.max(0, Number(perFloorRate) || 0)
  const noLift = Math.max(0, Number(noLiftFlat) || 0)
  const vol = Number(accessVolumeMultiplier)
  const mult = Number.isFinite(vol) && vol > 0 ? vol : 1
  return floors * (perFloor + noLift) * mult
}

/**
 * @param {Record<string, unknown>} wizard
 * @returns {Record<string, null> | null}
 */
export function liftClearPatchForWizard(wizard) {
  /** @type {Record<string, null>} */
  const patch = {}
  if (!floorNeedsLiftQuestion(wizard?.pickupFloor) && wizard?.pickupLift != null) {
    patch.pickupLift = null
  }
  if (!floorNeedsLiftQuestion(wizard?.deliveryFloor) && wizard?.deliveryLift != null) {
    patch.deliveryLift = null
  }
  return Object.keys(patch).length > 0 ? patch : null
}
