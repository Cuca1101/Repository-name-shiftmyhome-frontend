import { isSupabaseConfigured, supabase } from '../supabase'
import { LS_PRICING, LS_PRICING_SYNC } from '../localStorageKeys'
import { sanitizeDisplayPriceByService } from '../serviceCardDisplayPrice'
import {
  detectMissingPricingSettingKeys,
  mergePricingSettingsWithDefaults,
} from '../pricingSettingsMerge'
import { dispatchPricingSettingsUpdated } from '../pricingSettingsEvents'
import { preparePricingSettingsForSave } from '../driverExtraChargePricingSettings'

const TABLE = 'pricing_settings'
const PRICING_CACHE_TTL_MS = 5 * 60 * 1000

/** @type {{ settings: import('../pricingCalculator.js').PricingSettings, updatedAt: string | null, savedAt: number, missingKeys: string[] } | null} */
let memoryPricingCache = null

function clearMemoryPricingCache() {
  memoryPricingCache = null
}

function invalidateStoredPricingCache() {
  memoryPricingCache = null
  try {
    localStorage.removeItem(LS_PRICING_SYNC)
  } catch {
    /* ignore */
  }
}

let pricingRealtimeStarted = false

function ensurePricingSettingsRealtime() {
  if (pricingRealtimeStarted || typeof window === 'undefined' || !supabase) return
  pricingRealtimeStarted = true
  supabase
    .channel('pricing-settings-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pricing_settings' }, () => {
      invalidateStoredPricingCache()
      dispatchPricingSettingsUpdated()
    })
    .subscribe()
}

/** @param {{ message?: string } | null | undefined} err */
function isMissingPricingRpc(err) {
  const msg = String(err?.message || '')
  return /admin_(get|upsert)_pricing_settings|public_get_pricing_settings|schema cache|function.*does not exist/i.test(msg)
}

/**
 * @returns {Promise<{ data: Record<string, unknown>, updated_at: string | null } | null>}
 */
async function loadPricingRowFromSupabase() {
  if (!supabase) return null

  const { data: rpcRows, error: rpcErr } = await supabase.rpc('admin_get_pricing_settings')
  if (!rpcErr) {
    const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows
    if (row?.data && typeof row.data === 'object') {
      return {
        data: /** @type {Record<string, unknown>} */ (row.data),
        updated_at: row.updated_at ?? null,
      }
    }
  } else if (!isMissingPricingRpc(rpcErr)) {
    throw rpcErr
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select('data, updated_at')
    .eq('id', 1)
    .maybeSingle()
  if (error) throw error
  if (data?.data && typeof data.data === 'object') {
    return {
      data: /** @type {Record<string, unknown>} */ (data.data),
      updated_at: data.updated_at ?? null,
    }
  }
  return null
}

/**
 * Saved Pricing Engine for the public quote. Read-only.
 * @returns {Promise<{ data: Record<string, unknown>, updated_at: string | null } | null>}
 */
async function loadPublicPricingRowFromSupabase() {
  if (!supabase) return null

  const { data: rpcRows, error: rpcErr } = await supabase.rpc('public_get_pricing_settings')
  if (rpcErr) return null
  const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows
  if (row?.data && typeof row.data === 'object') {
    return {
      data: /** @type {Record<string, unknown>} */ (row.data),
      updated_at: row.updated_at ?? null,
    }
  }
  return null
}

/**
 * @param {import('../pricingCalculator.js').PricingSettings} settings
 * @param {string | null | undefined} updatedAt
 * @param {'supabase'|'save'|'defaults'|'localStorage'} source
 */
function writeLocalPricingCache(settings, updatedAt, source) {
  const savedAt = Date.now()
  memoryPricingCache = {
    settings,
    updatedAt: updatedAt || null,
    savedAt,
    missingKeys: [],
  }
  localStorage.setItem(LS_PRICING, JSON.stringify(settings))
  localStorage.setItem(
    LS_PRICING_SYNC,
    JSON.stringify({
      updatedAt: updatedAt || new Date().toISOString(),
      cachedAt: new Date(savedAt).toISOString(),
      source,
    }),
  )
}

/**
 * @returns {{ settings: import('../pricingCalculator.js').PricingSettings, updatedAt: string | null, missingKeys: string[] } | null}
 */
function readFreshPricingCache() {
  if (memoryPricingCache && Date.now() - memoryPricingCache.savedAt < PRICING_CACHE_TTL_MS) {
    return memoryPricingCache
  }
  try {
    const sync = JSON.parse(localStorage.getItem(LS_PRICING_SYNC) || 'null')
    const source = String(sync?.source || '')
    if (source !== 'supabase' && source !== 'save') return null
    const cachedAt = new Date(sync.cachedAt || sync.updatedAt || 0).getTime()
    if (!Number.isFinite(cachedAt) || Date.now() - cachedAt >= PRICING_CACHE_TTL_MS) return null
    const parsed = JSON.parse(localStorage.getItem(LS_PRICING) || 'null')
    if (!parsed || typeof parsed !== 'object') return null
    const settings = mergeWithDefaults(parsed, { source: 'localStorage', warnOnFallback: false })
    memoryPricingCache = {
      settings,
      updatedAt: sync.updatedAt || null,
      savedAt: cachedAt,
      missingKeys: [],
    }
    return memoryPricingCache
  } catch {
    return null
  }
}

/**
 * @param {{ data: Record<string, unknown>, updated_at: string | null }} row
 * @param {(merged: import('../pricingCalculator.js').PricingSettings, missingKeys?: string[]) => import('../pricingCalculator.js').PricingSettings | { settings: import('../pricingCalculator.js').PricingSettings, missingKeys: string[] }} finish
 */
function finishLivePricingRow(row, finish) {
  const raw = row.data
  const missingKeys = detectMissingPricingSettingKeys(raw)
  if (missingKeys.length > 0) {
    console.warn('Pricing fallback used because admin settings were missing', missingKeys, {
      source: 'supabase',
    })
  }
  const merged = mergeWithDefaults(raw, { warnOnFallback: false, source: 'supabase' })
  writeLocalPricingCache(merged, row.updated_at, 'supabase')
  return finish(merged, missingKeys)
}

/**
 * @param {{ includeMissingKeys?: boolean }} [opts]
 * @returns {Promise<import('../pricingCalculator.js').PricingSettings | { settings: import('../pricingCalculator.js').PricingSettings, missingKeys: string[] }>}
 */
export async function fetchPricingSettings(opts = {}) {
  ensurePricingSettingsRealtime()
  /** @param {import('../pricingCalculator.js').PricingSettings} merged @param {string[]} missingKeys */
  function finish(merged, missingKeys = []) {
    if (opts.includeMissingKeys) {
      return { settings: merged, missingKeys }
    }
    return merged
  }

  if (!opts.includeMissingKeys) {
    const cached = readFreshPricingCache()
    if (cached?.settings) return finish(cached.settings, cached.missingKeys || [])
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const publicRow = await loadPublicPricingRowFromSupabase()
      if (publicRow?.data) return finishLivePricingRow(publicRow, finish)

      const { data: sessionData } = await supabase.auth.getSession()
      if (sessionData?.session) {
        const row = await loadPricingRowFromSupabase()
        if (row?.data) return finishLivePricingRow(row, finish)
      }

      const { data, error } = await supabase
        .from(TABLE)
        .select('data, updated_at')
        .eq('id', 1)
        .maybeSingle()
      if (!error && data?.data && typeof data.data === 'object') {
        return finishLivePricingRow(
          {
            data: /** @type {Record<string, unknown>} */ (data.data),
            updated_at: data.updated_at ?? null,
          },
          finish,
        )
      }
      if (error) throw error
    } catch (e) {
      const detail = e?.message || String(e)
      if (import.meta.env.DEV) {
        console.warn('[fetchPricingSettings] Could not read admin pricing.', detail)
      }
    }
  }

  throw new Error('Could not load pricing settings from admin.')
}

/**
 * @param {import('../pricingCalculator.js').PricingSettings} next
 */
export async function savePricingSettings(next) {
  const prepared = preparePricingSettingsForSave(
    next && typeof next === 'object' ? { ...next } : {},
  )
  const merged = mergeWithDefaults(prepared, { source: 'save', warnOnFallback: false })
  let updatedAt = new Date().toISOString()

  if (isSupabaseConfigured && supabase) {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData?.session) {
      throw new Error('Sign in to save pricing settings.')
    }
    const { data: rpcTs, error: rpcErr } = await supabase.rpc('admin_upsert_pricing_settings', {
      p_data: merged,
    })
    if (!rpcErr && rpcTs) {
      updatedAt = String(rpcTs)
    } else if (rpcErr && !isMissingPricingRpc(rpcErr)) {
      throw rpcErr
    } else {
      const { data, error } = await supabase
        .from(TABLE)
        .upsert(
          {
            id: 1,
            data: merged,
            updated_at: updatedAt,
          },
          { onConflict: 'id' },
        )
        .select('updated_at')
        .single()
      if (error) throw error
      if (data?.updated_at) updatedAt = data.updated_at
    }
  }

  writeLocalPricingCache(merged, updatedAt, 'save')
  dispatchPricingSettingsUpdated()
  return merged
}

/**
 * @param {Record<string, unknown>|null|undefined} raw
 * @param {{ warnOnFallback?: boolean, source?: string }} [opts]
 * @returns {import('../pricingCalculator.js').PricingSettings}
 */
function mergeWithDefaults(raw, opts = {}) {
  const merged = mergePricingSettingsWithDefaults(raw, opts)
  merged.displayPriceByService = sanitizeDisplayPriceByService(raw?.displayPriceByService)
  return normalizePackingMaterialPrices(merged)
}

/**
 * Legacy `packingMaterialPriceBoxes` → medium when per-size prices missing.
 * @param {import('../pricingCalculator.js').PricingSettings} merged
 */
function normalizePackingMaterialPrices(merged) {
  const legacyBox = Math.max(0, Number(merged.packingMaterialPriceBoxes) || 0)
  if (!(Number(merged.packingMaterialPriceMediumBoxes) > 0) && legacyBox > 0) {
    merged.packingMaterialPriceMediumBoxes = legacyBox
  }
  const priceKeys = [
    'packingMaterialPriceSmallBoxes',
    'packingMaterialPriceMediumBoxes',
    'packingMaterialPriceLargeBoxes',
    'packingMaterialPriceExtraLargeBoxes',
    'packingMaterialPriceBoxes',
    'packingMaterialPriceBubble',
    'packingMaterialPricePaper',
    'packingMaterialPriceTape',
    'packingMaterialPriceMattress',
  ]
  for (const key of priceKeys) {
    if (merged[key] == null || !Number.isFinite(Number(merged[key]))) {
      merged[key] = 0
    }
  }
  return merged
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== LS_PRICING && event.key !== LS_PRICING_SYNC) return
    clearMemoryPricingCache()
    dispatchPricingSettingsUpdated()
  })
}
