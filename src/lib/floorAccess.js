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
