/**
 * Whether a browser-saved public quote may still be offered for resume.
 * The draft expires after 14 days. Leaving the page or taking a phone call does not.
 * A past move date stays resumable: the quote form asks for a new date on the same reference.
 */
export const QUOTE_DRAFT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

/**
 * @param {unknown} remote
 * @returns {'resumable' | 'booked' | 'expired' | 'closed' | 'unknown'}
 */
export function normalizeRemoteResumeState(remote) {
  const state = String(remote || '').trim()
  if (state === 'resumable' || state === 'booked' || state === 'expired' || state === 'closed') return state
  return 'unknown'
}

/**
 * Local draft gate. `pending` still needs the backend status.
 * @param {{ quoteRef?: string, savedAt?: number, wizard?: { moveDate?: string } } | null | undefined} draft
 * @param {number} [now]
 * @returns {'pending' | 'none' | 'expired'}
 */
export function localSavedQuoteResumeState(draft, now = Date.now()) {
  const quoteRef = String(draft?.quoteRef || '').trim()
  if (!draft || !quoteRef) return 'none'
  if (typeof draft.savedAt === 'number' && now - draft.savedAt > QUOTE_DRAFT_MAX_AGE_MS) return 'expired'
  return 'pending'
}

/**
 * @param {'pending' | 'none' | 'expired'} local
 * @param {'resumable' | 'booked' | 'expired' | 'closed' | 'unknown'} remote
 * @returns {'resumable' | 'none' | 'booked' | 'expired' | 'closed'}
 */
export function combineSavedQuoteResumeState(local, remote) {
  if (local === 'none') return 'none'
  if (local === 'expired') return 'expired'
  if (remote === 'booked' || remote === 'expired' || remote === 'closed') return remote
  return 'resumable'
}
