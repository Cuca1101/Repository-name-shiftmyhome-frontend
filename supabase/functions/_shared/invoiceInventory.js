/**
 * One inventory list for an invoice.
 * Structured rows win. The text copy is only a fallback, so the same items are not printed twice.
 * Same names with different quantities stay as separate rows.
 */

function positiveQty(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 1
  return Math.round(n)
}

function cleanStoredName(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim()
}

function parseInventoryText(text) {
  const rows = []
  const lines = String(text || '').split(/\r?\n|•/g)
  for (const raw of lines) {
    const line = raw.trim().replace(/^[-*·]\s*/, '')
    if (!line || /^inventory[:\s-]*$/i.test(line)) continue
    const qtyMatch = line.match(/[×x]\s*(\d+)/i) || line.match(/^(\d+)\s*[×x]\s*/i)
    const name = cleanStoredName(
      line
        .replace(/[×x]\s*\d+/gi, '')
        .replace(/^\d+\s*[×x]\s*/i, '')
        .replace(/\[[^\]]*\]/g, '')
        .replace(/\([^)]*(?:m³|m3|line vol)[^)]*\)/gi, ''),
    )
    if (!name) continue
    rows.push({ name, quantity: positiveQty(qtyMatch?.[1]) })
  }
  return rows
}

export function canonicalInvoiceInventory({ inventoryItems = [], inventory = null, inventoryText = '' } = {}) {
  if (inventoryItems.length) {
    return inventoryItems
      .map((row) => ({
        name: cleanStoredName(row?.item_name),
        quantity: positiveQty(row?.quantity),
      }))
      .filter((row) => row.name)
  }
  if (Array.isArray(inventory) && inventory.length) {
    return inventory
      .map((row) => ({
        name: cleanStoredName(row?.name ?? row?.item_name),
        quantity: positiveQty(row?.quantity ?? row?.qty),
      }))
      .filter((row) => row.name)
  }
  return parseInventoryText(inventoryText)
}

export function totalItemQuantity(rows) {
  return (rows || []).reduce((sum, row) => sum + positiveQty(row?.quantity), 0)
}

const GENERIC_NOTE = new Set([
  '',
  '-',
  'n/a',
  'na',
  'no',
  'none',
  'none selected',
  '0',
  'typical',
  'standard',
  'standard street parking',
  'house',
])

/** Pricing-engine breakdowns stay off the customer invoice. */
export function isInternalPricingLine(value) {
  const line = String(value || '').replace(/\s+/g, ' ').trim()
  if (!line) return false
  if (/best price/i.test(line)) return true
  if (/\(\s*\d+\s*%\s*\)/.test(line) && /[£]|GBP/i.test(line)) return true
  return /^(starting price|base price|distance|mileage|fuel|labour|labor|volume|same[- ]day|minimum|estimated total|calculated total|subtotal|crew labour|price per mile|access charge|floor charge)\b/i.test(line)
}

export function customerInvoiceNotes(values) {
  const notes = []
  for (const value of values || []) {
    for (const part of String(value || '').split(/\r?\n/)) {
      const line = part.replace(/\s+/g, ' ').trim()
      if (!line || GENERIC_NOTE.has(line.toLowerCase()) || isInternalPricingLine(line)) continue
      if (!notes.includes(line)) notes.push(line)
    }
  }
  return notes
}
