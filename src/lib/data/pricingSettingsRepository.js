import { isSupabaseConfigured, supabase } from '../supabase'
import { getDefaultPricingSettings } from '../defaultPricingSettings'
import { LS_PRICING } from '../localStorageKeys'

const TABLE = 'pricing_settings'

/**
 * @returns {Promise<import('../pricingCalculator.js').PricingSettings>}
 */
export async function fetchPricingSettings() {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from(TABLE).select('data').eq('id', 1).maybeSingle()
      if (error) throw error
      if (data?.data && typeof data.data === 'object') {
        return mergeWithDefaults(/** @type {Record<string, unknown>} */ (data.data))
      }
    } catch (e) {
      const detail = e?.message || String(e)
      if (import.meta.env.DEV) {
        console.warn('[fetchPricingSettings] Supabase unavailable — using cached/offline defaults.', detail)
      }
      /* fall through: localStorage or baked-in defaults so the quote wizard still works */
    }
  }
  const raw = localStorage.getItem(LS_PRICING)
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') return mergeWithDefaults(parsed)
    } catch {
      /* ignore */
    }
  }
  const defaults = getDefaultPricingSettings()
  localStorage.setItem(LS_PRICING, JSON.stringify(defaults))
  return defaults
}

/**
 * @param {import('../pricingCalculator.js').PricingSettings} next
 */
export async function savePricingSettings(next) {
  const merged = mergeWithDefaults(next)
  if (isSupabaseConfigured && supabase) {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData?.session) {
      throw new Error('Sign in to save pricing settings.')
    }
    const { error } = await supabase.from(TABLE).upsert(
      {
        id: 1,
        data: merged,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
    if (error) throw error
  }
  localStorage.setItem(LS_PRICING, JSON.stringify(merged))
  return merged
}

/**
 * @param {Record<string, unknown>} raw
 * @returns {import('../pricingCalculator.js').PricingSettings}
 */
function mergeWithDefaults(raw) {
  const d = getDefaultPricingSettings()
  const base = raw.basePriceByService && typeof raw.basePriceByService === 'object'
    ? { ...d.basePriceByService, ...raw.basePriceByService }
    : d.basePriceByService
  const custom =
    raw.customSizeM3 && typeof raw.customSizeM3 === 'object'
      ? { ...d.customSizeM3, ...raw.customSizeM3 }
      : d.customSizeM3
  const promoCodes = Array.isArray(raw.promoCodes)
    ? raw.promoCodes
        .filter((c) => c && typeof c === 'object')
        .map((c) => ({
          code: String(/** @type {{ code?: string }} */ (c).code || '').trim(),
          discountType:
            /** @type {{ discountType?: string }} */ (c).discountType === 'fixed'
              ? 'fixed'
              : 'percentage',
          discountValue: Math.max(0, Number(/** @type {{ discountValue?: unknown }} */ (c).discountValue) || 0),
        }))
        .filter((c) => c.code.length > 0)
    : d.promoCodes

  const merged = {
    ...d,
    ...raw,
    basePriceByService: base,
    customSizeM3: custom,
    promoCodes,
  }
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
