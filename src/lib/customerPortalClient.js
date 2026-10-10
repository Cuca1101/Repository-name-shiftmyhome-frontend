import { createClient } from '@supabase/supabase-js'
import { isSupabaseConfigured } from './supabaseClient'

function stripQuotes(value) {
  const text = String(value ?? '').trim()
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1).trim()
  }
  return text
}

const supabaseUrl = stripQuotes(import.meta.env.VITE_SUPABASE_URL)
const anonKey = stripQuotes(import.meta.env.VITE_SUPABASE_ANON_KEY)

/**
 * Customer Portal auth only. A separate storage key so a magic link or password
 * sign-in cannot replace the admin or driver session in the main app.
 */
export const customerPortalClient = isSupabaseConfigured
  ? createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
        storageKey: 'smh-customer-portal',
      },
    })
  : null
