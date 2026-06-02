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
 * @typedef {Object} ExtraChargeOperationalPayload
 * @property {number} [extra_floors]
 * @property {'yes'|'no'|'na'} [lift_available]
 * @property {number} [stairs_flights]
 * @property {boolean} [long_walking_distance]
 * @property {boolean} [parking_issue]
 * @property {number} [waiting_time_hours]
 * @property {number} [dismantling_items]
 * @property {number} [reassembly_items]
 * @property {number} [extra_helpers]
 */

/**
 * @param {ExtraChargeOperationalPayload | null | undefined} op
 */
export function operationalPayloadHasCharges(op) {
  if (!op) return false
  const floors = Math.max(0, Math.round(Number(op.extra_floors) || 0))
  const stairs = Math.max(0, Math.round(Number(op.stairs_flights) || 0))
  const lift = String(op.lift_available || 'na').toLowerCase()
  const waitH = Math.max(0, Number(op.waiting_time_hours) || 0)
  return (
    floors > 0 ||
    stairs > 0 ||
    lift === 'no' ||
    lift === 'yes' ||
    Boolean(op.long_walking_distance) ||
    Boolean(op.parking_issue) ||
    waitH > 0 ||
    (Number(op.dismantling_items) || 0) > 0 ||
    (Number(op.reassembly_items) || 0) > 0 ||
    (Number(op.extra_helpers) || 0) > 0
  )
}

/**
 * Official extra-charge total (items + access/time).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Array<{ name: string, quantity?: number, volume_m3?: number, library_item_id?: string, notes?: string }>} items
 * @param {ExtraChargeOperationalPayload | null} [operational]
 * @returns {Promise<EnginePriceEstimate>}
 */
export async function fetchExtraChargeEngineEstimate(supabase, items, operational = null) {
  const list = Array.isArray(items) ? items.filter((i) => String(i?.name || '').trim()) : []
  const hasOp = operationalPayloadHasCharges(operational)
  if (list.length === 0 && !hasOp) {
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
    body: { items: list, operational: operational ?? {} },
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

/** @deprecated Use fetchExtraChargeEngineEstimate */
export async function fetchEnginePriceForExtraItems(supabase, items) {
  return fetchExtraChargeEngineEstimate(supabase, items, null)
}
