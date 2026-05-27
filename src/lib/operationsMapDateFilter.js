import { extractMoveYmd } from './adminJobWarningBadges'

/** @typedef {'today' | 'tomorrow' | 'this_week' | 'custom' | 'all'} OperationsMapDatePreset */

/**
 * Move date key aligned with admin job cards: `move_date` then `preferred_move_date`.
 * @param {Record<string, unknown>} q
 * @returns {string | null} YYYY-MM-DD or null
 */
export function quoteMoveYmd(q) {
  return extractMoveYmd(q?.move_date ?? q?.preferred_move_date)
}

/**
 * @param {Record<string, unknown>} j
 * @returns {string | null}
 */
export function journeyMoveYmd(j) {
  return extractMoveYmd(j?.move_date)
}

/** @returns {string} Local calendar YYYY-MM-DD */
export function localTodayYmd() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** @param {string} ymd */
function parseYmd(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
  const [y, mo, da] = ymd.split('-').map(Number)
  const d = new Date(y, mo - 1, da, 12, 0, 0, 0)
  return Number.isNaN(d.getTime()) ? null : d
}

/** @param {string} a @param {string} b */
function compareYmd(a, b) {
  if (a === b) return 0
  return a < b ? -1 : 1
}

/**
 * Monday–Sunday week containing anchor YMD (UK-style work week).
 * @param {string} anchorYmd
 * @returns {{ start: string, end: string }}
 */
export function weekRangeContainingYmd(anchorYmd) {
  const d = parseYmd(anchorYmd)
  if (!d) return { start: anchorYmd, end: anchorYmd }
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const start = new Date(d)
  start.setDate(d.getDate() + diff)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const fmt = (x) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  return { start: fmt(start), end: fmt(end) }
}

/**
 * @param {string | null} entityYmd
 * @param {OperationsMapDatePreset} preset
 * @param {string} customYmd
 * @param {string} anchorYmd
 */
export function ymdMatchesDatePreset(entityYmd, preset, customYmd, anchorYmd) {
  if (preset === 'all') return true
  if (!entityYmd) return false
  if (preset === 'today') return entityYmd === anchorYmd
  if (preset === 'tomorrow') {
    const t = parseYmd(anchorYmd)
    if (!t) return false
    t.setDate(t.getDate() + 1)
    const ty = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
    return entityYmd === ty
  }
  if (preset === 'this_week') {
    const { start, end } = weekRangeContainingYmd(anchorYmd)
    return compareYmd(entityYmd, start) >= 0 && compareYmd(entityYmd, end) <= 0
  }
  if (preset === 'custom') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(customYmd)) return false
    return entityYmd === customYmd
  }
  return true
}

/**
 * @param {OperationsMapDatePreset} preset
 * @param {string} customYmd
 */
/**
 * Operations map date filter. Available/waiting jobs match the Available Jobs inbox (no move-date filter).
 * @param {Record<string, unknown>[]} quotes
 * @param {string} mapMode
 * @param {OperationsMapDatePreset} preset
 * @param {string} customYmd
 * @param {string} anchorYmd
 */
export function filterQuotesForOperationsMapDate(quotes, mapMode, preset, customYmd, anchorYmd) {
  const list = Array.isArray(quotes) ? quotes : []
  if (mapMode === 'available') return list
  if (preset === 'all') return list
  return list.filter((q) => ymdMatchesDatePreset(quoteMoveYmd(q), preset, customYmd, anchorYmd))
}

export function formatDatePresetLabel(preset, customYmd) {
  if (preset === 'all') return 'All dates'
  if (preset === 'today') return 'Today'
  if (preset === 'tomorrow') return 'Tomorrow'
  if (preset === 'this_week') return 'This week'
  if (preset === 'custom') {
    const d = parseYmd(customYmd)
    if (!d) return customYmd || '—'
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  }
  return ''
}
