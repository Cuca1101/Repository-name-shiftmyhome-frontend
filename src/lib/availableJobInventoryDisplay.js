/**
 * Display-only inventory rows for Available Job Details.
 * Does not mutate quote data. Prefer structured rows; split summary blobs and free text.
 */

import {
  parseInventoryFallbackDisplayLines,
  parseInventoryFromQuoteRow,
  parseInventoryTableRows,
} from './quoteJobAdminModel'

/** @typedef {{ name: string, qty: number | string, volume: string, sizeType: string }} InventoryDisplayRow */

/**
 * @param {unknown} v
 */
function displayVolume(v) {
  if (v == null || v === '') return '—'
  const s = String(v).trim()
  if (!s || s === '—') return '—'
  if (/m³|m\^3/i.test(s)) return s
  const n = Number(String(s).replace(/,/g, ''))
  if (Number.isFinite(n)) return `${n} m³`
  return s
}

/**
 * @param {unknown} v
 */
function displaySizeType(v) {
  const s = String(v ?? '').trim()
  return s && s !== '—' ? s : '—'
}

/**
 * @param {unknown} qty
 */
function displayQty(qty) {
  const n = Number(qty)
  if (Number.isFinite(n) && n > 0) return n
  return 1
}

/**
 * @param {InventoryDisplayRow} row
 */
function isSummaryBlobRow(row) {
  const name = String(row?.name ?? '')
  if (!name) return false
  const volBlank = !row.volume || row.volume === '—'
  const sizeBlank = !row.sizeType || row.sizeType === '—'
  if (!volBlank && !sizeBlank) return false
  return (
    name.includes('\n') ||
    name.includes('•') ||
    /×\s*\d+/.test(name) ||
    (name.includes(',') && name.length > 24) ||
    name.length > 80
  )
}

/**
 * @param {InventoryDisplayRow[]} rows
 */
function isSummaryOnlyInventory(rows) {
  return rows.length === 1 && isSummaryBlobRow(rows[0])
}

/**
 * @param {string} text
 * @returns {InventoryDisplayRow[]}
 */
function splitRichInventoryText(text) {
  const trimmed = String(text ?? '').trim()
  if (!trimmed) return []

  const fromPipe = parseInventoryTableRows(trimmed, null)
  if (fromPipe.length) return fromPipe

  let chunks = trimmed.split(/\r?\n/).map((t) => t.trim()).filter(Boolean)
  if (chunks.length === 1) {
    chunks = trimmed.split(/\s*[•·●]\s+/).map((t) => t.trim()).filter(Boolean)
  }
  if (chunks.length === 1 && trimmed.includes(',')) {
    chunks = trimmed
      .split(/,(?=\s*[^\s,])/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2)
  }
  if (chunks.length === 0) chunks = [trimmed]

  /** @type {InventoryDisplayRow[]} */
  const out = []
  for (const chunk of chunks) {
    const row = parseLooseInventoryChunk(chunk)
    if (row) out.push(row)
  }
  return out
}

/**
 * @param {string} chunk
 * @returns {InventoryDisplayRow | null}
 */
function parseLooseInventoryChunk(chunk) {
  const t = chunk.replace(/^[-–—]\s*/, '').trim()
  if (!t) return null

  const bullet = t.match(
    /^•?\s*(.+?)\s*×\s*(\d+)\s*(?:\(\s*~\s*([\d.]+)\s*m³\s*line\s*vol\s*,\s*([^)]+)\))?/i,
  )
  if (bullet) {
    return {
      name: bullet[1].trim(),
      qty: parseInt(bullet[2], 10) || 1,
      volume: bullet[3] ? `${bullet[3]} m³` : '—',
      sizeType: (bullet[4] || '').trim() || '—',
    }
  }

  const nTimes = t.match(/^(\d+)\s*x\s+(.+)$/i)
  if (nTimes) {
    return { name: nTimes[2].trim(), qty: parseInt(nTimes[1], 10) || 1, volume: '—', sizeType: '—' }
  }

  const timesN = t.match(/^(.+?)\s+x\s*(\d+)$/i)
  if (timesN) {
    return { name: timesN[1].trim(), qty: parseInt(timesN[2], 10) || 1, volume: '—', sizeType: '—' }
  }

  return { name: t, qty: 1, volume: '—', sizeType: '—' }
}

/**
 * @param {InventoryDisplayRow} row
 * @returns {InventoryDisplayRow}
 */
function normalizeInventoryDisplayRow(row) {
  return {
    name: String(row.name || 'Item').trim() || 'Item',
    qty: displayQty(row.qty),
    volume: displayVolume(row.volume),
    sizeType: displaySizeType(row.sizeType),
  }
}

/**
 * @param {Record<string, unknown>} q
 * @returns {InventoryDisplayRow[]}
 */
export function buildAvailableJobInventoryDisplayRows(q) {
  if (!q || typeof q !== 'object') return []

  let rows = parseInventoryFromQuoteRow(q)

  if (isSummaryOnlyInventory(rows)) {
    const blob = String(rows[0].name || '')
    rows = splitRichInventoryText(blob)
    if (!rows.length) {
      rows = parseInventoryTableRows(q.inventory_text, q.details)
    }
    if (!rows.length) {
      rows = parseInventoryFallbackDisplayLines(blob || q.inventory_text)
    }
  }

  if (!rows.length) {
    rows = parseInventoryTableRows(q.inventory_text, q.details)
  }

  if (!rows.length) {
    rows = parseInventoryFallbackDisplayLines(q.inventory_text)
  }

  if (!rows.length && q.inventory_text) {
    rows = splitRichInventoryText(String(q.inventory_text))
  }

  return rows.map(normalizeInventoryDisplayRow)
}

/**
 * @param {InventoryDisplayRow[]} rows
 */
export function summarizeAvailableJobInventory(rows) {
  let qtyTotal = 0
  let volSum = 0
  let volParsed = false

  for (const r of rows) {
    const qn = Number(r.qty)
    qtyTotal += Number.isFinite(qn) && qn > 0 ? qn : 1

    const vm = String(r.volume || '')
    const m = vm.match(/([\d,.]+)\s*m³/i)
    if (m) {
      const v = parseFloat(m[1].replace(/,/g, ''))
      if (Number.isFinite(v)) {
        volSum += v * (Number.isFinite(qn) && qn > 0 ? qn : 1)
        volParsed = true
      }
    }
  }

  return {
    itemCount: rows.length,
    qtyTotal,
    volumeLabel: volParsed ? `${Math.round(volSum * 100) / 100} m³` : '—',
  }
}
