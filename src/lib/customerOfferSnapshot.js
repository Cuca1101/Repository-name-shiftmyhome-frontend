/**
 * Stable snapshot of the quoted move an offer is negotiated against.
 * Checkout and the review step compare this hash so an agreed price cannot
 * move onto a different date, package, inventory, or address.
 */

function money(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100) / 100
}

function text(value) {
  return String(value ?? '').trim()
}

function inventorySignature(lines) {
  if (!Array.isArray(lines)) return []
  return lines
    .map((line) => ({
      name: text(line?.name),
      quantity: Math.max(0, Math.round(Number(line?.quantity) || 0)),
      m3: Math.round((Number(line?.m3) || 0) * 1000) / 1000,
    }))
    .filter((line) => line.name && line.quantity > 0)
    .sort((a, b) => a.name.localeCompare(b.name) || a.quantity - b.quantity || a.m3 - b.m3)
}

/**
 * @param {{
 *   wizard: Record<string, unknown>,
 *   breakdown?: Record<string, unknown> | null,
 *   totalM3?: number | null,
 * }} params
 */
export function buildCustomerOfferIdentity({ wizard, breakdown = null, totalM3 = null }) {
  const w = wizard || {}
  return {
    v: 1,
    moveDate: text(w.moveDate).slice(0, 10),
    arrivalWindow: text(w.arrivalWindow),
    exactArrivalTime: text(w.exactArrivalTime),
    flexibleArrivalFrom: text(w.flexibleArrivalFrom),
    flexibleArrivalUntil: text(w.flexibleArrivalUntil),
    pickupAddress: text(w.pickupAddress),
    deliveryAddress: text(w.deliveryAddress),
    pickupHouseNumber: text(w.pickupHouseNumber),
    deliveryHouseNumber: text(w.deliveryHouseNumber),
    pickupPostcode: text(w.pickupPostcode).toUpperCase(),
    deliveryPostcode: text(w.deliveryPostcode).toUpperCase(),
    pickupFlatDetails: text(w.pickupFlatDetails),
    deliveryFlatDetails: text(w.deliveryFlatDetails),
    packageTier: text(w.packageTier || breakdown?.servicePackageId || 'standard') || 'standard',
    crewSize: Number(w.crewSize) || null,
    promoCode: text(w.promoCode).toUpperCase(),
    distanceMiles: money(w.distanceMiles),
    volumeM3: money(totalM3),
    inventory: inventorySignature(w.inventoryLines),
    packing: Boolean(w.packing),
    packingMaterials: Boolean(w.packingMaterials),
    packingApproxBoxes: Math.max(0, Math.round(Number(w.packingApproxBoxes) || 0)),
    dismantling: Boolean(w.dismantling),
    dismantlingItemCount: Math.max(0, Math.round(Number(w.dismantlingItemCount) || 0)),
    reassembly: Boolean(w.reassembly),
    reassemblyItemCount: Math.max(0, Math.round(Number(w.reassemblyItemCount) || 0)),
    specialInstructions: text(w.specialInstructions),
    heavyNotes: text(w.heavyNotes),
    originalTotal: money(breakdown?.estimatedTotal),
    quoteBaseTotal: money(breakdown?.quoteBaseTotal),
    packageFee: money(breakdown?.servicePackageFee),
    extrasTotal: money(breakdown?.extrasTotal),
  }
}

/**
 * @param {Record<string, unknown>} identity
 * @returns {Promise<string>}
 */
export async function hashCustomerOfferIdentity(identity) {
  const json = JSON.stringify(identity)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function offerNeedsNewReview(currentHash, offerHash) {
  return Boolean(currentHash && offerHash && currentHash !== offerHash)
}
