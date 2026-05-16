import { isSupabaseConfigured, supabase } from '../supabase'
import { parsePricingText } from '../quoteJobAdminModel'
import { sumQuoteCustomerTotalsGbp } from '../journeyFinance'
import { updateQuoteWorkflowAssignmentSilent } from './quotesAdminRepository'

const JOURNEYS = 'journeys'
const STOPS = 'journey_stops'

/**
 * @param {Record<string, unknown>[]} quotes
 */
function sumVolumeM3FromQuotes(quotes) {
  let sum = 0
  for (const q of quotes) {
    const { volumeM3 } = parsePricingText(q.pricing)
    if (volumeM3 != null && Number.isFinite(volumeM3)) sum += volumeM3
    else if (q.total_cubic_metres != null && Number.isFinite(Number(q.total_cubic_metres))) {
      sum += Number(q.total_cubic_metres)
    }
  }
  return Math.round(sum * 100) / 100
}

/**
 * @returns {Promise<string>}
 */
export async function allocateNextJourneyRef() {
  if (!isSupabaseConfigured || !supabase) return `JNY-${new Date().getFullYear()}-0001`
  const year = new Date().getFullYear()
  const prefix = `JNY-${year}-`
  const { data, error } = await supabase.from(JOURNEYS).select('journey_ref').like('journey_ref', `${prefix}%`)
  if (error) throw error
  let max = 0
  for (const row of data ?? []) {
    const ref = row?.journey_ref != null ? String(row.journey_ref) : ''
    const m = ref.match(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`, 'i'))
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`
}

/**
 * @param {string} journeyId
 * @returns {Promise<{ journey: Record<string, unknown> | null, stops: Record<string, unknown>[] }>}
 */
export async function fetchJourneyWithStops(journeyId) {
  const id = String(journeyId || '').trim()
  if (!isSupabaseConfigured || !supabase || !id) {
    return { journey: null, stops: [] }
  }
  const [{ data: jRow, error: e1 }, { data: sRows, error: e2 }] = await Promise.all([
    supabase.from(JOURNEYS).select('*').eq('id', id).maybeSingle(),
    supabase.from(STOPS).select('*').eq('journey_id', id).order('sort_order', { ascending: true }),
  ])
  if (e1) throw e1
  if (e2) throw e2
  return { journey: jRow ?? null, stops: Array.isArray(sRows) ? sRows : [] }
}

/**
 * @param {string} [searchTerm] client-side filter if non-empty
 * @returns {Promise<Record<string, unknown>[]>}
 */
export async function fetchMarketplaceJourneysForAdmin(searchTerm = '') {
  if (!isSupabaseConfigured || !supabase) return []
  const { data, error } = await supabase
    .from(JOURNEYS)
    .select('*')
    .eq('marketplace_visibility', 'visible_in_marketplace')
    .order('created_at', { ascending: false })
  if (error) throw error
  const rows = Array.isArray(data) ? data : []
  const safe = sanitizeIlike(searchTerm)
  if (!safe) return rows
  const p = safe.toLowerCase()
  return rows.filter((j) => {
    const blob = [
      j.journey_ref,
      j.title,
      j.summary_title,
      j.from_postcode,
      j.to_postcode,
      j.time_range_summary,
    ]
      .map((x) => (x != null ? String(x).toLowerCase() : ''))
      .join(' ')
    return blob.includes(p)
  })
}

/** @param {string} t */
function sanitizeIlike(t) {
  return String(t || '')
    .trim()
    .slice(0, 120)
}

/**
 * @param {import('../journeyPlannerModel.js').JourneyStop[]} stops
 */
function mapStopsToRows(journeyId, stops) {
  return stops.map((s, i) => ({
    journey_id: journeyId,
    sort_order: i,
    stop_kind: s.kind,
    quote_id: s.quoteId && String(s.quoteId).trim() ? String(s.quoteId).trim() : null,
    job_ref: s.jobRef,
    address: s.address,
    time_window: s.timeWindow || null,
    customer_name: s.customerName || null,
    service_minutes: Math.round(Number(s.serviceMinutes) || 0),
    volume_crew: s.volumeCrew || null,
    notes: s.notes || null,
    lng: s.lng != null && Number.isFinite(s.lng) ? s.lng : null,
    lat: s.lat != null && Number.isFinite(s.lat) ? s.lat : null,
  }))
}

/**
 * @param {{
 *   journeyId?: string | null,
 *   title?: string,
 *   summaryTitle?: string | null,
 *   stops: import('../journeyPlannerModel.js').JourneyStop[],
 *   totalDriveSeconds: number,
 *   totalServiceSeconds: number,
 *   totalDurationSeconds: number,
 *   totalMiles: number,
 *   jobsCount: number,
 *   quotes: Record<string, unknown>[],
 *   fromPostcode?: string | null,
 *   toPostcode?: string | null,
 *   moveDate?: string | null,
 *   timeRangeSummary?: string | null,
 *   maxVolumeM3?: number | null,
 *   estimatedWeightKg?: number | null,
 *   journeyPayoutPrice?: number | null,
 *   journeyPayoutManuallySet?: boolean | null,
 *   adminCustomerTotalGbp?: number | null,
 *   requirementsTags?: string[] | null,
 *   totalVolumeM3?: number | null,
 * }} payload
 * @returns {Promise<{ id: string, journey_ref: string | null } | null>}
 */
export async function saveJourney(payload) {
  if (!isSupabaseConfigured || !supabase) return null
  const {
    journeyId: existingId,
    title = 'Journey',
    summaryTitle = null,
    stops,
    totalDriveSeconds,
    totalServiceSeconds,
    totalDurationSeconds,
    totalMiles,
    jobsCount,
    quotes,
    fromPostcode = null,
    toPostcode = null,
    moveDate = null,
    timeRangeSummary = null,
    maxVolumeM3 = null,
    estimatedWeightKg = null,
    journeyPayoutPrice = null,
    journeyPayoutManuallySet = null,
    adminCustomerTotalGbp = null,
    requirementsTags = null,
    totalVolumeM3: totalVolOverride = null,
  } = payload

  const totalVolumeM3 = totalVolOverride != null ? totalVolOverride : sumVolumeM3FromQuotes(quotes)
  const adminCustomer =
    adminCustomerTotalGbp != null && Number.isFinite(Number(adminCustomerTotalGbp))
      ? Number(adminCustomerTotalGbp)
      : sumQuoteCustomerTotalsGbp(quotes)
  const manualPayout =
    journeyPayoutManuallySet === true ? true : journeyPayoutManuallySet === false ? false : undefined

  const baseRow = {
    title,
    summary_title: summaryTitle,
    total_drive_seconds: Math.round(totalDriveSeconds),
    total_service_seconds: Math.round(totalServiceSeconds),
    total_duration_seconds: Math.round(totalDurationSeconds),
    total_miles: typeof totalMiles === 'number' && Number.isFinite(totalMiles) ? totalMiles : null,
    total_volume_m3: totalVolumeM3,
    jobs_count: jobsCount,
    from_postcode: fromPostcode || null,
    to_postcode: toPostcode || null,
    move_date: moveDate || null,
    time_range_summary: timeRangeSummary || null,
    max_volume_m3: maxVolumeM3 != null && Number.isFinite(maxVolumeM3) ? maxVolumeM3 : null,
    estimated_weight_kg: estimatedWeightKg != null && Number.isFinite(estimatedWeightKg) ? estimatedWeightKg : null,
    marketplace_payout_price:
      journeyPayoutPrice != null && Number.isFinite(journeyPayoutPrice) ? journeyPayoutPrice : null,
    admin_customer_total_gbp: adminCustomer != null && Number.isFinite(adminCustomer) ? adminCustomer : null,
    requirements_tags: Array.isArray(requirementsTags) && requirementsTags.length > 0 ? requirementsTags : null,
    updated_at: new Date().toISOString(),
  }
  if (manualPayout !== undefined) {
    baseRow.journey_payout_manually_set = manualPayout
  }

  const idExisting = existingId != null && String(existingId).trim() ? String(existingId).trim() : ''

  if (idExisting) {
    const { error: eu } = await supabase.from(JOURNEYS).update(baseRow).eq('id', idExisting)
    if (eu) throw eu
    const { error: delE } = await supabase.from(STOPS).delete().eq('journey_id', idExisting)
    if (delE) throw delE
    const stopRows = mapStopsToRows(idExisting, stops)
    const { error: insE } = await supabase.from(STOPS).insert(stopRows)
    if (insE) throw insE
    const { data: jr } = await supabase.from(JOURNEYS).select('journey_ref').eq('id', idExisting).maybeSingle()
    const ref =
      jr?.journey_ref != null && String(jr.journey_ref).trim() ? String(jr.journey_ref).trim() : null
    return { id: idExisting, journey_ref: ref }
  }

  const journeyRef = await allocateNextJourneyRef()
  const { data: row, error: e1 } = await supabase
    .from(JOURNEYS)
    .insert({
      ...baseRow,
      status: 'draft',
      journey_ref: journeyRef,
      marketplace_visibility: 'hidden_from_partners',
    })
    .select('id, journey_ref')
    .maybeSingle()

  if (e1 || !row?.id) throw e1 || new Error('Failed to create journey')

  const journeyId = String(row.id)
  const refOut = row.journey_ref != null ? String(row.journey_ref) : journeyRef
  const { error: e2 } = await supabase.from(STOPS).insert(mapStopsToRows(journeyId, stops))
  if (e2) throw e2

  return { id: journeyId, journey_ref: refOut }
}

/**
 * @param {string} journeyId
 * @param {Record<string, unknown>} patch snake_case keys for journeys table
 */
export async function updateJourneyRow(journeyId, patch) {
  const id = String(journeyId || '').trim()
  if (!isSupabaseConfigured || !supabase || !id) return { savedRemote: false }
  const cleaned = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
  if (Object.keys(cleaned).length === 0) return { savedRemote: true }
  cleaned.updated_at = new Date().toISOString()
  const { error } = await supabase.from(JOURNEYS).update(cleaned).eq('id', id)
  return { savedRemote: !error }
}

/**
 * @param {string} journeyId
 * @param {string[]} quoteIds
 * @param {number|null|undefined} marketplacePayoutPrice
 */
export async function sendJourneyToMarketplace(journeyId, quoteIds, marketplacePayoutPrice) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.')
  }
  const jid = String(journeyId || '').trim()
  if (!jid) throw new Error('Missing journey id.')
  const ids = [...new Set((quoteIds || []).map((x) => String(x || '').trim()).filter(Boolean))]
  const payout =
    marketplacePayoutPrice != null && Number.isFinite(Number(marketplacePayoutPrice))
      ? Number(marketplacePayoutPrice)
      : null

  const { error: e1 } = await supabase
    .from(JOURNEYS)
    .update({
      marketplace_visibility: 'visible_in_marketplace',
      marketplace_payout_price: payout,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jid)
  if (e1) throw e1

  for (const qid of ids) {
    await updateQuoteWorkflowAssignmentSilent(qid, { bundled_journey_id: jid })
  }
}

/**
 * Admin journey list (all states). Newest first.
 * @param {number} [limit]
 * @returns {Promise<Record<string, unknown>[]>}
 */
export async function fetchAllJourneysForAdmin(limit = 250) {
  if (!isSupabaseConfigured || !supabase) return []
  const cap = Math.min(500, Math.max(1, Math.round(Number(limit) || 250)))
  const { data, error } = await supabase
    .from(JOURNEYS)
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(cap)
  if (error) throw error
  return Array.isArray(data) ? data : []
}

/**
 * Stops for many journeys (admin dispatch map). Sort client-side per journey.
 * @param {string[]} journeyIds
 * @returns {Promise<Record<string, unknown>[]>}
 */
export async function fetchJourneyStopsForJourneyIds(journeyIds) {
  const ids = [...new Set((journeyIds || []).map((x) => String(x || '').trim()).filter(Boolean))]
  if (!isSupabaseConfigured || !supabase || ids.length === 0) return []
  const cap = ids.slice(0, 150)
  const { data, error } = await supabase.from(STOPS).select('*').in('journey_id', cap)
  if (error) throw error
  const rows = Array.isArray(data) ? data : []
  rows.sort((a, b) => {
    const ja = String(a.journey_id || '')
    const jb = String(b.journey_id || '')
    if (ja !== jb) return ja.localeCompare(jb)
    return (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0)
  })
  return rows
}

/**
 * Delete a journey that is not listed and not assigned (draft-style cleanup).
 * @param {string} journeyId
 */
export async function deleteJourneyDraft(journeyId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.')
  }
  const id = String(journeyId || '').trim()
  if (!id) throw new Error('Missing journey id.')
  const { data: row, error: e0 } = await supabase
    .from(JOURNEYS)
    .select('id, marketplace_visibility, status, assigned_partner_id')
    .eq('id', id)
    .maybeSingle()
  if (e0) throw e0
  if (!row?.id) throw new Error('Journey not found.')
  const vis = String(row.marketplace_visibility || '')
  if (vis === 'visible_in_marketplace') {
    throw new Error('Withdraw this journey from the marketplace before deleting it.')
  }
  if (vis === 'assigned') {
    throw new Error('This journey is assigned; withdraw or complete it before deleting.')
  }
  if (row.assigned_partner_id != null && String(row.assigned_partner_id).trim() !== '') {
    throw new Error('This journey has an assigned partner and cannot be deleted.')
  }
  const st = String(row.status || '').toLowerCase()
  if (st === 'completed' || st === 'cancelled') {
    throw new Error('Completed or cancelled journeys cannot be deleted here.')
  }
  const { error: e1 } = await supabase.from(JOURNEYS).delete().eq('id', id)
  if (e1) throw e1
}

/**
 * Hide journey from marketplace and release bundled quotes back to single-job flow.
 * @param {string} journeyId
 */
export async function withdrawJourneyFromMarketplace(journeyId) {
  const jid = String(journeyId || '').trim()
  if (!isSupabaseConfigured || !supabase || !jid) return
  const { error: e1 } = await supabase
    .from(JOURNEYS)
    .update({
      marketplace_visibility: 'hidden_from_partners',
      updated_at: new Date().toISOString(),
    })
    .eq('id', jid)
  if (e1) throw e1

  const { data: bundled, error: e2 } = await supabase.from('quotes').select('id').eq('bundled_journey_id', jid)
  if (e2) throw e2
  for (const row of bundled ?? []) {
    if (row?.id) await updateQuoteWorkflowAssignmentSilent(String(row.id), { bundled_journey_id: null })
  }
}
