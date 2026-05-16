/** Placeholder for admin lists that search quotes/jobs by ref, contact, addresses. */
export const ADMIN_RECORDS_SEARCH_PLACEHOLDER = 'Search by Quote Ref, name, phone, email...'

/**
 * Sanitize user input for PostgREST `.or(...ilike...)` filters:
 * strip pattern wildcards and characters that break filter grammar.
 * @param {unknown} raw
 * @returns {string}
 */
export function sanitizeAdminIlikeTerm(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/\\/g, '')
    .replace(/%/g, '')
    .replace(/_/g, '')
    .replace(/,/g, '')
    .replace(/[()]/g, '')
}
