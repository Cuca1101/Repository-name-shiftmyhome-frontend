import { createClient } from '@supabase/supabase-js'
import { isSupabaseConfigured } from './supabaseClient'

/** @param {string | undefined} v */
function stripQuotes(v) {
  const s = (v ?? '').trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1).trim()
  }
  return s
}

/** Rejects placeholders and non-JWT keys. */
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

/**
 * Supabase client for public website forms only — never uses admin/driver session.
 * Homepage quote request must insert as role `anon` (RLS policies target anon).
 */
export const supabasePublic =
  isSupabaseConfigured && !isInvalidAnonKey(anonKey)
    ? createClient(supabaseUrl, anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storageKey: 'smh-public-anon',
          storage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          },
        },
      })
    : null

export const isSupabasePublicConfigured = Boolean(supabasePublic)
