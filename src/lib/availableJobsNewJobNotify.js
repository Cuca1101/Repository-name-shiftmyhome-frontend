/**
 * @param {Record<string, unknown>[]} rows
 * @returns {Set<string>}
 */
export function availableJobIdSet(rows) {
  return new Set(rows.map((q) => String(q.id)))
}

/**
 * IDs present in `next` but not in `previous`.
 * @param {Set<string>} previous
 * @param {Record<string, unknown>[]} next
 * @returns {string[]}
 */
export function findNewAvailableJobIds(previous, next) {
  if (!previous.size) return []
  const out = []
  for (const q of next) {
    const id = String(q.id)
    if (!previous.has(id)) out.push(id)
  }
  return out
}

/**
 * @param {Record<string, unknown>[]} rows
 * @param {string[]} ids
 * @returns {Record<string, unknown>[]}
 */
export function pickJobsByIds(rows, ids) {
  const want = new Set(ids)
  return rows.filter((q) => want.has(String(q.id)))
}

/**
 * @param {Record<string, unknown>[]} jobs
 * @returns {string}
 */
export function formatNewJobToastMessage(jobs) {
  if (!jobs.length) return 'New job available'
  const first = jobs[0]
  const ref = first.quote_ref ? String(first.quote_ref) : String(first.id).slice(0, 8)
  const name = String(first.full_name || '').trim()
  const lead = name ? `${ref} · ${name}` : ref
  if (jobs.length === 1) return `New job available — ${lead}`
  return `New job available — ${lead} (+${jobs.length - 1} more)`
}
