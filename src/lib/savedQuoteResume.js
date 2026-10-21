/**
 * Browser resume for one unfinished public quote.
 * Clears only the saved draft and the resume flag. Quote and payment rows stay.
 */
import { isSupabaseConfigured, supabase } from './supabase'
import { isSupabasePublicConfigured, supabasePublic } from './supabasePublicClient'
import { clearQuoteDraft, loadQuoteDraft } from './quoteDraftStorage'
import { clearResumeSavedQuote } from './quoteSessionMode'
import {
  combineSavedQuoteResumeState,
  localSavedQuoteResumeState,
  normalizeRemoteResumeState,
} from './savedQuoteResumeRules'

export { combineSavedQuoteResumeState, localSavedQuoteResumeState } from './savedQuoteResumeRules'

function publicDb() {
  if (isSupabasePublicConfigured && supabasePublic) return supabasePublic
  if (isSupabaseConfigured && supabase) return supabase
  return null
}

/**
 * @param {string} quoteRef
 * @param {string | null | undefined} sessionId
 * @returns {Promise<'resumable' | 'booked' | 'expired' | 'closed' | 'unknown'>}
 */
export async function fetchSavedQuoteResumeState(quoteRef, sessionId) {
  const db = publicDb()
  const ref = String(quoteRef || '').trim()
  if (!db || !ref) return 'unknown'
  const { data, error } = await db.rpc('public_saved_quote_resume_status', {
    p_quote_ref: ref,
    p_session_id: String(sessionId || '').trim() || null,
  })
  if (error) return 'unknown'
  const state = data && typeof data === 'object' ? data.state : data
  return normalizeRemoteResumeState(state)
}

/**
 * @param {{ quoteRef?: string, savedAt?: number, leadSessionId?: string | null, wizard?: { moveDate?: string } } | null | undefined} draft
 * @returns {Promise<'resumable' | 'none' | 'booked' | 'expired' | 'closed'>}
 */
export async function resolveSavedQuoteResume(draft) {
  const local = localSavedQuoteResumeState(draft)
  if (local !== 'pending') return local
  const remote = await fetchSavedQuoteResumeState(draft.quoteRef, draft.leadSessionId)
  return combineSavedQuoteResumeState(local, remote)
}

/** Drop the browser resume for the saved quote. Does not delete the quote or the booking. */
export function clearSavedQuoteResume() {
  clearQuoteDraft()
  clearResumeSavedQuote()
}

/**
 * Re-read the draft and ask the backend whether it is still unfinished.
 * Booked, expired, and closed quotes lose their browser resume state.
 * @returns {Promise<'resumable' | 'none' | 'booked' | 'expired' | 'closed'>}
 */
export async function recheckSavedQuoteResume() {
  const draft = loadQuoteDraft()
  const state = await resolveSavedQuoteResume(draft)
  if (state === 'booked' || state === 'expired' || state === 'closed') {
    clearSavedQuoteResume()
  }
  return state
}
