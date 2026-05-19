import { isSupabaseConfigured, supabase } from './supabase'
import { parseUserAgentLite } from './parseUserAgent'

const CACHE_KEY = 'smh_visitor_context_v1'
const CACHE_MS = 30 * 60 * 1000

/** @type {Promise<Record<string, unknown>>|null} */
let inflight = null

function functionsInvokeHeaders() {
  const raw = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim().replace(/^["']|["']$/g, '')
  if (raw.startsWith('eyJ')) return { Authorization: `Bearer ${raw}` }
  return undefined
}

function readCache() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.at || Date.now() - parsed.at > CACHE_MS) return null
    return parsed.data || null
  } catch {
    return null
  }
}

/** @param {Record<string, unknown>} data */
function writeCache(data) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }))
  } catch {
    /* ignore */
  }
}

/**
 * Server-side geo via Supabase Edge Function (Cloudflare / proxy headers).
 * Never throws — returns empty object on failure.
 * @returns {Promise<Record<string, unknown>>}
 */
export async function resolveVisitorGeoContext() {
  if (typeof window === 'undefined') return {}
  const cached = readCache()
  if (cached) return cached

  if (!isSupabaseConfigured || !supabase) return {}

  if (!inflight) {
    inflight = (async () => {
      try {
        const opts = {}
        const headers = functionsInvokeHeaders()
        if (headers) opts.headers = headers
        const { data, error } = await supabase.functions.invoke('get-visitor-context', opts)
        if (error) return {}
        const out = {
          ip_hash: data?.ip_hash != null ? String(data.ip_hash) : null,
          ip_masked: data?.ip_masked != null ? String(data.ip_masked) : null,
          city: data?.city != null ? String(data.city) : null,
          region: data?.region != null ? String(data.region) : null,
          country: data?.country != null ? String(data.country) : null,
        }
        writeCache(out)
        return out
      } catch {
        return {}
      } finally {
        inflight = null
      }
    })()
  }

  return inflight
}

/**
 * Geo + device fields for website_leads / website_events payloads.
 * @returns {Promise<Record<string, unknown>>}
 */
export async function getVisitorTrackingContext() {
  const geo = await resolveVisitorGeoContext()
  const ua = parseUserAgentLite()
  return {
    ...geo,
    ip_address: geo.ip_masked || null,
    user_agent: ua.user_agent,
    device_type: ua.device_type,
    browser_name: ua.browser_name,
    referrer: typeof document !== 'undefined' ? document.referrer || null : null,
  }
}
