import { canonicalItemKey, canonicalItemName, synonymsForItemName } from './inventoryItemSynonyms.js'

/** Shared copy for every inventory search field */
export const INVENTORY_SEARCH_PLACEHOLDER = 'Search items, e.g. sofa, TV, table'

export const INVENTORY_SEARCH_EMPTY_MESSAGE =
  'Item not found? Add it as a custom item below'

export const INVENTORY_SEARCH_NO_MATCHES = 'No matching items found'

/** Usual joined spellings, folded before the name and synonym comparison. */
const SEARCH_FOLDS = [
  [/superkingsize/g, 'super king size'],
  [/superking/g, 'super king'],
  [/kingsize/g, 'king size'],
  [/highsleeper/g, 'high sleeper'],
  [/bedframe/g, 'bed frame'],
  [/matress/g, 'mattress'],
  [/dinning/g, 'dining'],
  [/airfryer/g, 'air fryer'],
  [/sofabed/g, 'sofa bed'],
  [/daybed/g, 'day bed'],
  [/beanbag/g, 'bean bag'],
  [/bunkbed/g, 'bunk bed'],
  [/kalax/g, 'kallax'],
  [/washingmachine/g, 'washing machine'],
  [/vacuumcleaner/g, 'vacuum cleaner'],
  [/crosstrainer/g, 'cross trainer'],
  [/dollhouse/g, 'doll house'],
  [/nightstand/g, 'night stand'],
  [/barstool/g, 'bar stool'],
  [/highchair/g, 'high chair'],
  [/toolbox/g, 'tool box'],
  [/workbench/g, 'work bench'],
  [/lawnmower/g, 'lawn mower'],
  [/soundbar/g, 'sound bar'],
  [/drumkit/g, 'drum kit'],
  [/drumset/g, 'drum set'],
  [/pushbike/g, 'push bike'],
]

/** @param {string} value */
function searchKey(value) {
  let key = canonicalItemKey(value)
  for (const [pattern, replacement] of SEARCH_FOLDS) key = key.replace(pattern, replacement)
  return key.replace(/\s+/g, ' ').trim()
}

/** @param {string} token */
function tokenVariants(token) {
  const variants = [token]
  if (token.length > 3 && token.endsWith('ies')) variants.push(`${token.slice(0, -3)}y`)
  if (token.length > 4 && token.endsWith('es')) variants.push(token.slice(0, -2))
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) variants.push(token.slice(0, -1))
  if (token.length > 3 && !token.endsWith('s')) variants.push(`${token}s`)
  return variants
}

/**
 * `exact` = the token is a whole word (including a plural).
 * `prefix` = the token starts a longer word, such as "bed" in "bedside".
 * A token inside another word, such as "king" in "rocking", does not match.
 * @param {string} word
 * @param {string} token
 * @returns {'exact' | 'prefix' | null}
 */
function wordMatchKind(word, token) {
  for (const variant of tokenVariants(token)) {
    if (!variant) continue
    if (word === variant) return 'exact'
    if (variant.length >= 3 && word.startsWith(variant) && word.length > variant.length) return 'prefix'
  }
  return null
}

/**
 * @param {string} nameKey
 * @param {string} queryKey
 * @returns {'exact' | 'leading' | 'words' | 'prefix' | 'none'}
 */
function queryMatchQuality(nameKey, queryKey) {
  if (!queryKey || !nameKey) return 'none'
  if (nameKey === queryKey) return 'exact'
  const tokens = queryKey.split(' ').filter(Boolean)
  const words = nameKey.split(' ').filter(Boolean)
  if (!tokens.length || !words.length) return 'none'
  let prefixOnly = false
  for (const token of tokens) {
    let exact = false
    let prefix = false
    for (const word of words) {
      const kind = wordMatchKind(word, token)
      if (kind === 'exact') exact = true
      else if (kind === 'prefix') prefix = true
    }
    if (exact) continue
    if (prefix) {
      prefixOnly = true
      continue
    }
    const compactQuery = tokens.join('')
    const compactName = words.join('')
    if (compactQuery.length >= 4 && compactName.includes(compactQuery) && tokens.length > 1) return 'words'
    return 'none'
  }
  if (nameKey.startsWith(`${queryKey} `)) return prefixOnly ? 'prefix' : 'leading'
  return prefixOnly ? 'prefix' : 'words'
}

/**
 * Match if every token is a word or the start of a word.
 * @param {string} name
 * @param {string} query
 */
export function matchesInventorySearch(name, query) {
  const q = searchKey(query)
  if (!q) return true
  return queryMatchQuality(searchKey(name), q) !== 'none'
}

/** Synonym words count. A short prefix inside a synonym does not. */
function synonymMatchQuality(queryKey, synonyms) {
  /** @type {'exact' | 'leading' | 'words' | 'prefix' | 'none'} */
  let best = 'none'
  const rank = { none: 0, prefix: 1, words: 2, leading: 3, exact: 4 }
  for (const synonym of synonyms) {
    const quality = queryMatchQuality(searchKey(synonym), queryKey)
    if (quality === 'prefix' || quality === 'none') continue
    if (rank[quality] > rank[best]) best = quality
  }
  return best
}

/**
 * Search the canonical item and its synonyms.
 * One catalogue row matches at most once, even when several synonyms hit.
 * @param {{ item: { name: string }, categoryLabel: string }} entry
 * @param {string} query
 */
export function matchesInventoryCatalogEntry(entry, query) {
  const q = searchKey(query)
  if (!q) return false
  const name = searchKey(canonicalItemName(entry.item?.name))
  if (queryMatchQuality(name, q) !== 'none') return true
  return synonymMatchQuality(q, synonymsForItemName(entry.item?.name)) !== 'none'
}

/**
 * Higher = better match for sorting search dropdown results.
 * @param {{ item: { name: string }, categoryLabel: string }} entry
 * @param {string} query
 */
/** @param {string} queryKey */
function requestedSizes(queryKey) {
  const sizes = []
  if (queryKey.includes('super king')) sizes.push('super king')
  else if (queryKey.includes('small double')) sizes.push('small double')
  else if (queryKey.includes('king')) sizes.push('king')
  if (queryKey.includes('double') && !queryKey.includes('small double') && !queryKey.includes('king')) sizes.push('double')
  if (queryKey.includes('single')) sizes.push('single')
  if (queryKey.includes('2 seater') || queryKey.includes('two seater')) sizes.push('2 seater')
  if (queryKey.includes('3 seater') || queryKey.includes('three seater')) sizes.push('3 seater')
  if (queryKey.includes('4 seater') || queryKey.includes('four seater')) sizes.push('4 seater')
  if (queryKey.includes('extra large') || /(^| )xl( |$)/.test(queryKey)) sizes.push('extra large')
  else if (queryKey.includes('large')) sizes.push('large')
  if (queryKey.includes('medium')) sizes.push('medium')
  if (queryKey.includes('small') && !queryKey.includes('small double')) sizes.push('small')
  return sizes
}

/** @param {string} nameKey @param {string} size */
function nameHasSize(nameKey, size) {
  if (size === 'super king') return nameKey.includes('super king')
  if (size === 'small double') return nameKey.includes('small double')
  if (size === 'king') return nameKey.includes('king') && !nameKey.includes('super king')
  if (size === 'double') return nameKey.includes('double') && !nameKey.includes('small double')
  if (size === 'single') return nameKey.includes('single')
  if (size === '2 seater') return nameKey.includes('2 seater') || nameKey.includes('two seater')
  if (size === '3 seater') return nameKey.includes('3 seater') || nameKey.includes('three seater')
  if (size === '4 seater') return nameKey.includes('4 seater') || nameKey.includes('four seater')
  if (size === 'extra large') return nameKey.includes('extra large') || nameKey.includes(' xl')
  if (size === 'large') return nameKey.includes('large') && !nameKey.includes('extra large')
  if (size === 'medium') return nameKey.includes('medium')
  if (size === 'small') return nameKey.includes('small') && !nameKey.includes('small double')
  return false
}

/** Keep a frame, a mattress and a complete bed as separate results, with the asked one first. */
function bedRoleScore(queryKey, nameKey) {
  const wantsFrame = queryKey.includes('frame')
  const wantsMattress = queryKey.includes('mattress')
  const wantsSet = queryKey.includes('and mattress') || queryKey.includes('with mattress') || queryKey.includes('bed set') || (queryKey.includes('bed') && wantsMattress)
  const nameFrame = nameKey.includes('frame')
  const nameSet = nameKey.includes('bed') && nameKey.includes('mattress')
  const nameMattress = nameKey.includes('mattress') && !nameSet
  let score = 0
  if (wantsFrame && !wantsMattress) {
    if (nameFrame) score += 50
    if (nameSet || nameMattress) score -= 40
  } else if (wantsMattress && !wantsSet) {
    if (nameMattress) score += 50
    if (nameFrame) score -= 40
    if (nameSet) score -= 15
  } else if (wantsSet) {
    if (nameSet) score += 50
    if (nameFrame || nameMattress) score -= 25
  }
  return score
}

export function inventorySearchMatchScore(entry, query) {
  const q = searchKey(query)
  if (!q) return 0
  const name = searchKey(canonicalItemName(entry.item?.name))
  const synonyms = synonymsForItemName(entry.item?.name)
  const qualityScore = { exact: 100, leading: 85, words: 70, prefix: 28, none: 0 }
  const nameQuality = queryMatchQuality(name, q)
  const synonymQuality = synonymMatchQuality(q, synonyms)
  let score = qualityScore[nameQuality] || 0
  if (!score) score = Math.max(0, (qualityScore[synonymQuality] || 0) - 20)
  for (const size of requestedSizes(q)) {
    if (nameHasSize(name, size)) score += 60
    else if (['single', 'double', 'king', 'super king', 'small double', '2 seater', '3 seater', '4 seater'].some((other) => other !== size && nameHasSize(name, other))) {
      score -= 45
    }
  }
  score += bedRoleScore(q, name)
  return score
}

/**
 * @param {Array<{ item: { name: string }, categoryLabel: string }>} entries
 * @param {string} query
 * @param {number} [limit]
 */
export function filterAndSortInventorySearchResults(entries, query, limit = 80) {
  const q = searchKey(query)
  if (!q) return []
  const ranked = entries
    .filter((entry) => matchesInventoryCatalogEntry(entry, q))
    .sort((a, b) => inventorySearchMatchScore(b, q) - inventorySearchMatchScore(a, q) || String(a.item?.name).localeCompare(String(b.item?.name)))
  const seen = new Set()
  const unique = []
  for (const entry of ranked) {
    const key = canonicalItemKey(canonicalItemName(entry.item?.name))
    if (!key || seen.has(key)) continue
    seen.add(key)
    unique.push(entry)
  }
  return unique.slice(0, limit)
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
  const q = searchKey(query)
  if (!q) return [{ text: name, hl: false }]
  const tokens = [...new Set(q.split(' ').filter(Boolean).flatMap((token) => tokenVariants(token)))]
    .filter((token) => token.length >= 2)
  if (!tokens.length) return [{ text: name, hl: false }]

  const lower = name.toLowerCase()
  /** @type {[number, number][]} */
  let intervals = []
  for (const token of tokens) {
    let pos = 0
    while (pos < name.length) {
      const i = lower.indexOf(token, pos)
      if (i === -1) break
      const before = i === 0 || !/[a-z0-9]/i.test(name[i - 1])
      if (before) intervals.push([i, i + token.length])
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
