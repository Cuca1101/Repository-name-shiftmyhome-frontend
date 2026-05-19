/**
 * Display labels for Step 3 packing materials (quote wizard).
 * Pricing uses a single packingMaterialsFee — per-item sizes are display-only.
 *
 * TODO: When admin pricing exposes roll length / pack size (metres per roll, sheets per pack),
 * read those values here and build unitHelper strings like "per roll / approx. 25 metres".
 */
export const PACKING_MATERIALS_CATALOG = [
  { id: 'boxes', label: 'Moving boxes', unit: 'boxes', unitHelper: 'per box' },
  { id: 'bubble', label: 'Bubble wrap', unit: 'rolls', unitHelper: 'per roll' },
  { id: 'paper', label: 'Packing paper', unit: 'packs', unitHelper: 'per pack' },
  { id: 'tape', label: 'Tape', unit: 'rolls', unitHelper: 'per roll' },
  { id: 'mattress', label: 'Mattress covers', unit: 'covers', unitHelper: 'per cover' },
]

/**
 * @param {typeof PACKING_MATERIALS_CATALOG[number]} material
 */
export function getPackingMaterialUnitHelper(material) {
  // Future: if (material.metresPerRoll) return `per roll / approx. ${material.metresPerRoll} metres`
  return material.unitHelper
}

/**
 * @param {Record<string, unknown>} data
 */
export function parsePackingMaterialQuantities(data) {
  const q = { boxes: 0, bubble: 0, paper: 0, tape: 0, mattress: 0 }
  q.boxes = Math.max(0, Number(data.packingApproxBoxes) || 0)
  const text = String(data.packingMaterialsDetail || data.packingWhat || '').trim()
  if (!text) return q
  for (const line of text.split('\n')) {
    const m = line.match(/^(.+?):\s*(\d+)/i)
    if (!m) continue
    const label = m[1].toLowerCase()
    const n = parseInt(m[2], 10) || 0
    if (label.includes('bubble')) q.bubble = n
    else if (label.includes('paper')) q.paper = n
    else if (label.includes('tape')) q.tape = n
    else if (label.includes('mattress')) q.mattress = n
    else if (label.includes('box')) q.boxes = n
  }
  return q
}

/**
 * @param {Record<string, number>} quantities
 */
export function buildPackingWhatFromQuantities(quantities) {
  return PACKING_MATERIALS_CATALOG.filter((m) => (quantities[m.id] || 0) > 0)
    .map((m) => `${m.label}: ${quantities[m.id]} ${m.unit}`)
    .join('\n')
}
