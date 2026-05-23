import { isSupabaseConfigured, supabase } from '../supabase'
import { LS_PRICING, LS_PRICING_SYNC } from '../localStorageKeys'
import { sanitizeDisplayPriceByService } from '../serviceCardDisplayPrice'
import {
  detectMissingPricingSettingKeys,
  mergePricingSettingsWithDefaults,
} from '../pricingSettingsMerge'
import { dispatchPricingSettingsUpdated } from '../pricingSettingsEvents'

const TABLE = 'pricing_settings'

/**
 * @param {import('../pricingCalculator.js').PricingSettings} settings
 * @param {string | null | undefined} updatedAt
 * @param {'supabase'|'save'|'defaults'|'localStorage'} source
 */
function writeLocalPricingCache(settings, updatedAt, source) {
  localStorage.setItem(LS_PRICING, JSON.stringify(settings))
  localStorage.setItem(
    LS_PRICING_SYNC,
    JSON.stringify({
      updatedAt: updatedAt || new Date().toISOString(),
      source,
    }),
  )
}

/**
 * @returns {import('../pricingCalculator.js').PricingSettings | null}
 */
function readOfflinePricingCache() {
  const raw = localStorage.getItem(LS_PRICING)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return mergeWithDefaults(parsed, { source: 'localStorage', warnOnFallback: false })
    }
  } catch {
    /* ignore */
  }
  return null
}

/**
 * @returns {Promise<import('../pricingCalculator.js').PricingSettings>}
 */
export async function fetchPricingSettings() {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('data, updated_at')
        .eq('id', 1)
        .maybeSingle()
      if (error) throw error
      if (data?.data && typeof data.data === 'object') {
        const raw = /** @type {Record<string, unknown>} */ (data.data)
        const missingKeys = detectMissingPricingSettingKeys(raw)
        if (missingKeys.length > 0) {
          console.warn('Pricing fallback used because admin settings were missing', missingKeys, {
            source: 'supabase',
          })
        }
        const merged = mergeWithDefaults(raw, { warnOnFallback: false, source: 'supabase' })
        writeLocalPricingCache(merged, data.updated_at, 'supabase')
        return merged
      }
      // Supabase reachable but no admin row — use coded defaults only (never stale localStorage).
      const defaults = mergeWithDefaults(null, { source: 'defaults', warnOnFallback: true })
      writeLocalPricingCache(defaults, data?.updated_at || null, 'defaults')
      return defaults
    } catch (e) {
      const detail = e?.message || String(e)
      if (import.meta.env.DEV) {
        console.warn('[fetchPricingSettings] Supabase unavailable — using offline cache if present.', detail)
      }
    }
  }

  const cached = readOfflinePricingCache()
  if (cached) {
    return cached
  }

  console.warn('Pricing fallback used because admin settings were missing', detectMissingPricingSettingKeys(null), {
    source: 'defaults',
  })
  const defaults = mergeWithDefaults(null, { source: 'defaults', warnOnFallback: true })
  writeLocalPricingCache(defaults, null, 'defaults')
  return defaults
}

/**
 * @param {import('../pricingCalculator.js').PricingSettings} next
 */
export async function savePricingSettings(next) {
  const merged = mergeWithDefaults(next, { source: 'save', warnOnFallback: false })
  let updatedAt = new Date().toISOString()

  if (isSupabaseConfigured && supabase) {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData?.session) {
      throw new Error('Sign in to save pricing settings.')
    }
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
