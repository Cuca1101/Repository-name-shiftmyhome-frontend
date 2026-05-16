import { createClient } from '@supabase/supabase-js'

/**
 * Browser Supabase client — **legacy anon public JWT only** (`eyJ...`).
 *
 * Initialize exactly as: createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
 * Never use `service_role` or `sb_secret_` in the frontend.
 */

/** @param {string | undefined} v */
function stripQuotes(v) {
  const s = (v ?? '').trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1).trim()
  }
  return s
}

/** Rejects placeholders and non-JWT keys so Edge Functions get a valid Bearer JWT. */
function isInvalidAnonKey(k) {
  if (!k || k.length < 30) return true
  const lower = k.toLowerCase()
  if (!k.startsWith('eyJ')) return true
  if (lower.includes('paste')) return true
  if (lower.includes('your_key')) return true
  if (lower.includes('replace')) return true
  return false
}

const supabaseUrl = stripQuotes(import.meta.env.VITE_SUPABASE_URL)
const anonKey = stripQuotes(import.meta.env.VITE_SUPABASE_ANON_KEY)

export const isSupabaseConfigured = Boolean(supabaseUrl && anonKey && !isInvalidAnonKey(anonKey))

/** @param {string} jwt */
function jwtProjectRef(jwt) {
  try {
    const part = jwt.split('.')[1]
    if (!part) return null
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const payload = JSON.parse(atob(padded))
    return typeof payload.ref === 'string' ? payload.ref : null
  } catch {
    return null
  }
}

const urlProjectRef = (() => {
  try {
    const u = new URL(supabaseUrl.startsWith('http') ? supabaseUrl : `https://${supabaseUrl}`)
    if (!u.hostname.endsWith('.supabase.co')) return null
    return u.hostname.replace(/\.supabase\.co$/, '')
  } catch {
    return null
  }
})()

if (import.meta.env.DEV && urlProjectRef && anonKey && !isInvalidAnonKey(anonKey)) {
  const jwtRef = jwtProjectRef(anonKey)
  if (jwtRef && jwtRef !== urlProjectRef) {
    console.warn(
      `[Supabase] VITE_SUPABASE_URL host "${urlProjectRef}" does not match anon JWT ref "${jwtRef}". ` +
        'Fix the URL in .env (copy Project URL from the Supabase dashboard) — otherwise API calls fail (Invalid JWT / pricing errors).',
    )
  }
}

if (import.meta.env.DEV && supabaseUrl && !supabaseUrl.startsWith('https://')) {
  console.warn('[Supabase] VITE_SUPABASE_URL must start with https://')
}

if (import.meta.env.DEV && supabaseUrl && isInvalidAnonKey(anonKey)) {
  console.warn(
    '[Supabase] Set VITE_SUPABASE_ANON_KEY to the full legacy anon public key from Dashboard → Settings → API (starts with eyJ…). Replace PASTE_ANON_KEY_HERE, save .env, restart npm run dev.',
  )
}

const authOptions = {
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true,
  flowType: 'pkce',
}

// Same as createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY) with trimmed values (no stray quotes).
const supabase = isSupabaseConfigured ? createClient(supabaseUrl, anonKey, { auth: authOptions }) : null

export { supabase }
export default supabase
