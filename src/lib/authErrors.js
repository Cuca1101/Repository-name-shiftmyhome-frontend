/**
 * Map Supabase Auth errors to short, actionable UI messages.
 * @param {{ message?: string; status?: number; name?: string } | null | undefined} err
 * @returns {string}
 */
export function formatAuthError(err) {
  if (!err) return 'Sign-in failed. Please try again.'
  const raw = (err.message || '').trim()
  const lower = raw.toLowerCase()

  if (
    lower.includes('invalid login credentials') ||
    lower.includes('invalid_grant') ||
    err.status === 400
  ) {
    return 'Wrong email or password. If you forgot your password, reset it from Supabase Dashboard → Authentication → Users.'
  }
  if (lower.includes('email not confirmed') || lower.includes('confirm')) {
    return 'This account needs a confirmed email. In Supabase: Authentication → Users → select user → confirm, or temporarily disable “Confirm email” under Email provider.'
  }
  if (lower.includes('too many requests') || err.status === 429) {
    return 'Too many attempts. Wait a minute and try again.'
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Network error. Check your connection and that VITE_SUPABASE_URL is correct.'
  }
  if (lower.includes('invalid api key') || lower.includes('api key')) {
    return 'Invalid API key. Set VITE_SUPABASE_PUBLISHABLE_KEY to the full publishable key (sb_publishable_...) from Supabase → Settings → API Keys. Remove placeholders; do not use the secret key. Restart npm run dev after saving .env.'
  }
  if (raw) return raw
  return 'Sign-in failed. Check Supabase is configured and a user exists (Authentication → Users).'
}
