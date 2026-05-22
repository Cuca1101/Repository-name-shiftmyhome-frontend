import { FLOOR_OPTIONS } from '../components/quote-wizard/FloorSelect'
import { formatCrewSizeLabel, formatMoveSummaryCrewForPricing } from './crewPricingRules'
import { formatCompactArrivalLine } from './emailQuotePayload'
import { formatDateUK } from './formatDateDisplay'
import { getEffectiveReassemblyItemCount } from './quoteWizardReassembly'

/** Floor label for move summary: "1st floor", "2nd floor", etc. */
export function formatMoveSummaryFloorLabel(n) {
  if (n == null) return ''
  const o = FLOOR_OPTIONS.find((x) => x.value === n)
  if (!o) return ''
  if (o.value === -1 || o.value === 0) return o.label
  if (o.label.endsWith('+')) return `${o.label} floor`
  return `${o.label} floor`
}

/** Always "Lift yes" or "Lift no" — never blank. */
export function formatMoveSummaryLiftLabel(lift) {
  return lift === true ? 'Lift yes' : 'Lift no'
}

export function formatMoveSummaryArrival(wizard) {
  const line = formatCompactArrivalLine(wizard)
  if (!line) return ''
  return line
    .replace(/^Arrival window:\s*/i, '')
    .replace(/^Exact arrival:\s*/i, '')
    .trim()
}

export { formatMoveSummaryCrewForPricing }

export function formatMoveSummaryCrewSize(crewSize, crewSettings) {
  return formatCrewSizeLabel(crewSize, crewSettings)
}

export function formatMoveSummaryDistance(distanceMiles) {
  const n = Number(distanceMiles)
  if (!(n > 0)) return ''
  return `${n.toFixed(1)} miles`
}

export function formatMoveSummaryInventoryCount(inventoryLines) {
  const lines = (inventoryLines || []).filter((l) => l.quantity > 0)
  const units = lines.reduce((s, l) => s + Math.max(0, Number(l.quantity) || 0), 0)
  if (units <= 0) return ''
  return `${units} ${units === 1 ? 'item' : 'items'}`
}

export function hasMoveSummaryRouteData({
  pickupLng,
  pickupLat,
  deliveryLng,
  deliveryLat,
  pickupAddress,
  deliveryAddress,
}) {
  const coordsOk =
    pickupLng != null &&
    pickupLat != null &&
    deliveryLng != null &&
    deliveryLat != null
  const textOk =
    Boolean(pickupAddress?.trim()) || Boolean(deliveryAddress?.trim())
  return coordsOk || textOk
}

export function buildMoveSummaryExtras(wizard) {
  const blocks = []
  if (wizard?.dismantling) {
    const count = wizard.dismantlingItemCount || 0
    const detail = wizard.dismantlingWhat?.trim()
    blocks.push({
      key: 'dismantling',
      title: 'Dismantling',
      text: `${count} ${count === 1 ? 'item' : 'items'}${detail ? ` · ${detail}` : ''}`,
    })
  }
  if (wizard?.reassembly) {
    const count = getEffectiveReassemblyItemCount(wizard)
    const detail = wizard.reassemblyWhat?.trim()
    const sameNote = wizard.reassemblySameAsDismantling ? ' · Same items as dismantling' : ''
    const detailNote =
      !wizard.reassemblySameAsDismantling && detail ? ` · ${detail}` : ''
    blocks.push({
      key: 'assembly',
      title: 'Reassembly',
      text: `${count} ${count === 1 ? 'item' : 'items'}${sameNote}${detailNote}`,
    })
  }
  if (wizard?.packingMaterials) {
    const detail =
      (wizard.packingMaterialsDetail || wizard.packingWhat || '').trim() ||
      ''
    const text =
      detail ||
      (wizard.packingApproxBoxes > 0
        ? `Moving boxes: ${wizard.packingApproxBoxes} boxes`
        : 'Selected')
    blocks.push({ key: 'packing', title: 'Packing materials', text })
  }
  return blocks
}

export { formatDateUK }
