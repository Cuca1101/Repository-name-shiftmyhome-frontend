/**
 * @param {string | null | undefined} actor
 * @param {string} message
 */
export function formatAdminNotesLogLine(actor, message) {
  const ts = new Date().toISOString()
  const who = (actor && String(actor).trim()) || 'admin'
  return `[${ts}] ${who}: ${String(message).trim()}`
}

/**
 * @param {string | null | undefined} existing
 * @param {string | null | undefined} actor
 * @param {string} message
 */
export function appendAdminNotesLog(existing, actor, message) {
  const line = formatAdminNotesLogLine(actor, message)
  const prev = existing ? String(existing).trimEnd() : ''
  return prev ? `${prev}\n${line}` : line
}
