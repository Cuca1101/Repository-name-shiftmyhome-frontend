/**
 * Resume / recovery: keep the saved quote total until the customer changes
 * a price-affecting option. Avoids silent recalculation (e.g. missing crew → 2-man).
 *
 * Fingerprint intentionally excludes Mapbox distance/duration — those re-fetch on
 * resume and must not unlock the saved email/Pay Now total.
 */

/**
 * Customer-controlled inputs only (not auto route recalculation).
 * @param {{
 *   serviceType?: string|null,
 *   wizard?: Record<string, unknown>|null,
 * }} params
 */
export function buildPriceAffectingFingerprint({ serviceType, wizard }) {
  const w = wizard && typeof wizard === 'object' ? wizard : {}
  const lines = Array.isArray(w.inventoryLines)
    ? w.inventoryLines.map((l) => ({
        name: l?.name ?? '',
        quantity: Number(l?.quantity) || 0,
        m3: Number(l?.m3) || 0,
        mult: Number(l?.mult) || 1,
        weightType: l?.weightType ?? '',
        heavyFee: Boolean(l?.heavyFee),
        isCustom: Boolean(l?.isCustom),
      }))
    : []

  const payload = {
    serviceType: String(serviceType || w.serviceType || '').trim(),
    pickupAddress: String(w.pickupAddress || '').trim(),
    deliveryAddress: String(w.deliveryAddress || '').trim(),
    pickupFloor: w.pickupFloor ?? null,
    deliveryFloor: w.deliveryFloor ?? null,
    pickupLift: w.pickupLift ?? null,
    deliveryLift: w.deliveryLift ?? null,
    parkingDistance: w.parkingDistance ?? '',
    walkingDistance: w.walkingDistance ?? '',
    stairsFlights: Number(w.stairsFlights) || 0,
    moveDate: String(w.moveDate || '').trim(),
    arrivalWindow: String(w.arrivalWindow || '').trim(),
    packing: Boolean(w.packing),
    packingApproxBoxes: Number(w.packingApproxBoxes) || 0,
    packingFragile: Boolean(w.packingFragile),
    packingMaterials: Boolean(w.packingMaterials),
    packingMaterialsDetail: String(w.packingMaterialsDetail || ''),
    dismantling: Boolean(w.dismantling),
    dismantlingItemCount: Number(w.dismantlingItemCount) || 0,
    reassembly: Boolean(w.reassembly),
    reassemblyItemCount: Number(w.reassemblyItemCount) || 0,
    reassemblySameAsDismantling: Boolean(w.reassemblySameAsDismantling),
    // null and missing both mean "unchanged crew from resume" — do not treat as 2
    crewSize:
      w.crewSize != null && w.crewSize !== '' ? Number(w.crewSize) : null,
    promoCode: String(w.promoCode || '').trim().toUpperCase(),
    packageTier: String(w.packageTier || 'standard').trim(),
    inventoryLines: lines,
  }

  return JSON.stringify(payload)
}

/**
 * Same precedence as recovery email / Pay Now charge amount.
 * @param {{
 *   agreed_price?: unknown,
 *   estimated_total?: unknown,
 *   calculated_total?: unknown,
 *   wizard_data?: Record<string, unknown>|null,
 * }} lead
 * @returns {number|null}
 */
export function resolveSavedQuoteTotal(lead) {
  if (lead?.agreed_price != null && lead.agreed_price !== '') {
    const agreed = Number(lead.agreed_price)
    if (Number.isFinite(agreed) && agreed >= 0) return Math.round(agreed * 100) / 100
  }
  if (lead?.estimated_total != null && lead.estimated_total !== '') {
    const estimated = Number(lead.estimated_total)
    if (Number.isFinite(estimated) && estimated >= 0) return Math.round(estimated * 100) / 100
  }
  if (lead?.calculated_total != null && lead.calculated_total !== '') {
    const calculated = Number(lead.calculated_total)
    if (Number.isFinite(calculated) && calculated >= 0) return Math.round(calculated * 100) / 100
  }
  const wd = lead?.wizard_data && typeof lead.wizard_data === 'object' ? lead.wizard_data : {}
  const s3 = wd.step3 && typeof wd.step3 === 'object' ? wd.step3 : {}
  if (s3.estimatedTotal != null && s3.estimatedTotal !== '') {
    const fromWizard = Number(s3.estimatedTotal)
    if (Number.isFinite(fromWizard) && fromWizard >= 0) return Math.round(fromWizard * 100) / 100
  }
  return null
}

/**
 * @param {number|null|undefined} lockedTotal
 * @param {string|null|undefined} lockedFingerprint
 * @param {{ serviceType?: string|null, wizard?: Record<string, unknown>|null }} current
 * @returns {number|null} locked total if still valid, else null
 */
export function activeLockedQuoteTotal(lockedTotal, lockedFingerprint, current) {
  if (lockedTotal == null || !Number.isFinite(Number(lockedTotal))) return null
  // No fingerprint yet — still honour locked total (safer than recalculating on resume).
  if (!lockedFingerprint) return Math.round(Number(lockedTotal) * 100) / 100
  const fp = buildPriceAffectingFingerprint(current)
  if (fp !== lockedFingerprint) return null
  return Math.round(Number(lockedTotal) * 100) / 100
}
