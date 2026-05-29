/**
 * Driver app — call pricing engine and format price for Add Item UI.
 * Copy this file into the mobile repo (or import shared package).
 */

/**
 * @param {number|null|undefined} amount
 */
export function formatEnginePriceGbp(amount) {
  const n = Number(amount)
  if (!Number.isFinite(n)) return '—'
  return `£${n.toFixed(2)}`
}

/**
 * @typedef {Object} EnginePriceEstimate
 * @property {number} enginePriceGbp
 * @property {string} priceLabel
 * @property {string} totalVolumeLabel
 * @property {number} addedVolumeM3
 * @property {object[]} addedItems
 * @property {{ label: string, amount: number, amount_label?: string }[]} breakdown
 * @property {string} [volumeBand]
 */

/**
 * Invoke estimate-extra-charge Edge Function (driver JWT required).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Array<{ name: string, quantity?: number, volume_m3?: number, library_item_id?: string, notes?: string }>} items
 * @returns {Promise<EnginePriceEstimate>}
 */
export async function fetchEnginePriceForExtraItems(supabase, items) {
  const list = Array.isArray(items) ? items.filter((i) => String(i?.name || '').trim()) : []
  if (list.length === 0) {
    return {
      enginePriceGbp: 0,
      priceLabel: '£0.00',
      totalVolumeLabel: '0 m³',
      addedVolumeM3: 0,
      addedItems: [],
      breakdown: [],
    }
  }

  const { data, error } = await supabase.functions.invoke('estimate-extra-charge', {
    body: { items: list },
  })

  if (error) {
    const msg = error.message || 'Could not reach pricing engine.'
    throw new Error(msg)
  }

  const payload = data && typeof data === 'object' ? data : {}
  if (payload.ok === false) {
    throw new Error(String(payload.error || payload.message || 'Pricing engine failed.'))
  }

  const enginePriceGbp = Number(payload.engine_price_gbp ?? payload.estimated_amount) || 0
  const addedVolumeM3 = Number(payload.added_volume_m3) || 0

  return {
    enginePriceGbp,
    priceLabel: String(payload.price_label || formatEnginePriceGbp(enginePriceGbp)),
    totalVolumeLabel: String(payload.total_volume_label || `${addedVolumeM3} m³`),
    addedVolumeM3,
    addedItems: Array.isArray(payload.added_items) ? payload.added_items : [],
    breakdown: Array.isArray(payload.breakdown) ? payload.breakdown : [],
    volumeBand: payload.volume_band != null ? String(payload.volume_band) : undefined,
  }
}
