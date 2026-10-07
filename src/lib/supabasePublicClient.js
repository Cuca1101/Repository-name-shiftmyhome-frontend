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

/** Accept legacy anon JWT (eyJ…) or new publishable key (sb_publishable_…). */
function isInvalidPublicKey(k) {
  if (!k || k.length < 30) return true
  const lower = k.toLowerCase()
  if (lower.includes('paste')) return true
  if (lower.includes('your_key')) return true
  if (lower.includes('replace')) return true
  if (k.startsWith('eyJ')) return false
  if (k.startsWith('sb_publishable_')) return false
  return true
}

const supabaseUrl = stripQuotes(import.meta.env.VITE_SUPABASE_URL)
const anonKey = stripQuotes(import.meta.env.VITE_SUPABASE_ANON_KEY)
const publishableKey = stripQuotes(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
const publicKey =
  (!isInvalidPublicKey(anonKey) && anonKey)
  || (!isInvalidPublicKey(publishableKey) && publishableKey)
  || ''

/**
 * Supabase client for public website forms only — never uses admin/driver session.
 * Homepage quote request must insert as role `anon` (RLS policies target anon).
 * Track My Booking / Track My Driver must use this client so an admin login
 * on the same browser cannot break customer tracking links.
 */
export const supabasePublic =
  Boolean(supabaseUrl && publicKey)
    ? createClient(supabaseUrl, publicKey, {
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
