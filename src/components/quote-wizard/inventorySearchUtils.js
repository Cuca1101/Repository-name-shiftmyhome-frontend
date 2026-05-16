/** Shared copy for every inventory search field */
export const INVENTORY_SEARCH_PLACEHOLDER = 'Search items (e.g. sofa, TV, table)'

export const INVENTORY_SEARCH_EMPTY_MESSAGE =
  'Item not found? Add it as a custom item below'

/**
 * Match if every whitespace-separated token appears in `name` (case-insensitive).
 * @param {string} name
 * @param {string} query
 */
export function matchesInventorySearch(name, query) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const tokens = q.split(/\s+/).filter(Boolean)
  const n = name.toLowerCase()
  return tokens.every((t) => n.includes(t))
}

function mergeIntervals(intervals) {
  if (!intervals.length) return []
  const sorted = [...intervals].sort((a, b) => a[0] - b[0])
  const out = [sorted[0]]
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]
    const last = out[out.length - 1]
    if (cur[0] <= last[1]) {
      last[1] = Math.max(last[1], cur[1])
    } else {
      out.push(cur)
    }
  }
  return out
}

/**
 * All occurrences of each search token in `name`, merged for highlighting.
 * @returns {{ text: string, hl: boolean }[]}
 */
export function highlightInventorySegments(name, query) {
  const q = query.trim()
  if (!q) return [{ text: name, hl: false }]
  const tokens = q.split(/\s+/).filter(Boolean)
  if (!tokens.length) return [{ text: name, hl: false }]

  const lower = name.toLowerCase()
  /** @type {[number, number][]} */
  let intervals = []
  for (const token of tokens) {
    const t = token.toLowerCase()
    if (!t) continue
    let pos = 0
    while (pos < name.length) {
      const i = lower.indexOf(t, pos)
      if (i === -1) break
      intervals.push([i, i + t.length])
      pos = i + 1
    }
  }
  intervals = mergeIntervals(intervals)
  if (!intervals.length) return [{ text: name, hl: false }]

  const segments = []
  let cursor = 0
  for (const [start, end] of intervals) {
    if (start > cursor) {
      segments.push({ text: name.slice(cursor, start), hl: false })
    }
    segments.push({ text: name.slice(start, end), hl: true })
    cursor = end
  }
  if (cursor < name.length) {
    segments.push({ text: name.slice(cursor), hl: false })
  }
  return segments
}
