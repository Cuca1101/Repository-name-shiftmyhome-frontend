/**
 * Automatic crew note for packing materials the customer ordered from us.
 * Customer-owned boxes that only sit in the move inventory are not included.
 */

import {
  PACKING_MATERIALS_CATALOG,
  normalizePackingMaterialQuantities,
} from './packingMaterialsCatalog.js'

const SUPPLY_LINE = /^Supply:\s/i

/**
 * @param {typeof PACKING_MATERIALS_CATALOG[number]} item
 * @param {number} count
 */
function supplyPhrase(item, count) {
  const n = Math.max(0, Math.round(Number(count) || 0))
  const unit = n === 1 ? item.unit : item.unitPlural
  const paren = String(item.label).match(/\(([^)]+)\)/)
  const bare = String(item.label).replace(/\s*\([^)]*\)/g, '').trim()
  const unitWord = String(item.unit || '').trim()
  const sizeRaw = paren ? paren[1].trim() : ''
  const sizeIsUnit =
    sizeRaw.toLowerCase() === unitWord.toLowerCase() ||
    sizeRaw.toLowerCase() === String(item.unitPlural || '').trim().toLowerCase()
  let size = sizeIsUnit ? '' : sizeRaw
  if (size && unitWord) {
    size = size.replace(new RegExp(`\\s*${unitWord}s?$`, 'i'), '').trim()
  }
  const name = bare.toLowerCase()
  if (unitWord && name.endsWith(unitWord.toLowerCase())) {
    const stem = name.slice(0, name.length - unitWord.length).trim()
    const sized = size ? `${stem} (${size})` : stem
    return `${n} ${sized} ${unit}`.replace(/\s+/g, ' ')
  }
  const sizeBit = size ? ` (${size})` : ''
  return `${n} ${unit} of ${name}${sizeBit}`
}

/**
 * One English line, or '' when nothing was ordered from us.
 * @param {Record<string, unknown> | null | undefined} quantities
 */
export function buildSupplyNote(quantities) {
  const qty = normalizePackingMaterialQuantities(quantities || {})
  const parts = []
  for (const item of PACKING_MATERIALS_CATALOG) {
    const n = qty[item.id] || 0
    if (n > 0) parts.push(supplyPhrase(item, n))
  }
  if (!parts.length) return ''
  return `Supply: ${parts.join(', ')}.`
}

/**
 * Put the current Supply line on its own row.
 * Manual instructions stay. A changed quantity replaces the old line.
 * Removing every supplied material removes only that line.
 * @param {unknown} text
 * @param {Record<string, unknown> | null | undefined} quantities
 */
export function syncSupplyNote(text, quantities) {
  const note = buildSupplyNote(quantities)
  const lines = String(text ?? '').split('\n')
  const indexes = []
  lines.forEach((line, index) => {
    if (SUPPLY_LINE.test(line.trim())) indexes.push(index)
  })
  if (!note && indexes.length === 0) return String(text ?? '').trim()
  if (note && indexes.length === 1 && lines[indexes[0]].trim() === note) {
    return String(text ?? '').trim()
  }

  const kept = []
  let placed = false
  lines.forEach((line) => {
    if (!SUPPLY_LINE.test(line.trim())) {
      kept.push(line)
      return
    }
    if (note && !placed) {
      kept.push(note)
      placed = true
    }
  })
  if (note && !placed) {
    const body = kept.join('\n').replace(/\s+$/, '')
    return body ? `${body}\n${note}` : note
  }
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
