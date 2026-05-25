import { isSupabaseConfigured, supabase } from '../supabase'

const TABLE = 'extra_charge_requests'

/**
 * @param {Record<string, unknown>} row
 */
function mapRow(row) {
  return {
    id: String(row.id),
    jobId: row.job_id != null ? String(row.job_id) : null,
    quoteId: row.quote_id != null ? String(row.quote_id) : null,
    customerId: row.customer_id != null ? String(row.customer_id) : null,
    driverId: row.driver_id != null ? String(row.driver_id) : null,
    addedItems: Array.isArray(row.added_items) ? row.added_items : [],
    addedVolumeM3: Number(row.added_volume_m3) || 0,
    estimatedAmount: Number(row.estimated_amount) || 0,
    approvedAmount: row.approved_amount != null ? Number(row.approved_amount) : null,
    currency: String(row.currency || 'GBP'),
    status: String(row.status || 'pending_review'),
    stripePaymentIntentId: row.stripe_payment_intent_id || null,
    stripePaymentLink: row.stripe_payment_link || null,
    notes: row.notes || null,
    customerEmail: row.customer_email || null,
    customerName: row.customer_name || null,
    bookingReference: row.booking_reference || null,
    paidAt: row.paid_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

export async function fetchAllExtraChargeRequests(limit = 500) {
  if (!isSupabaseConfigured || !supabase) return []
  const cap = Math.min(2000, Math.max(1, Math.round(Number(limit) || 500)))
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(cap)
  if (error) throw error
  return (data || []).map(mapRow)
}

export async function fetchExtraChargeRequestsByJobId(jobId) {
  const id = String(jobId || '').trim()
  if (!id || !isSupabaseConfigured || !supabase) return []
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('job_id', id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapRow)
}

export async function fetchExtraChargeRequestById(requestId) {
  const id = String(requestId || '').trim()
  if (!id || !isSupabaseConfigured || !supabase) return null
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? mapRow(data) : null
}

/**
 * Admin approves/declines a request and optionally sets final amount.
 * @param {string} requestId
 * @param {{ status: string, approvedAmount?: number | null, notes?: string }} patch
 */
export async function updateExtraChargeRequest(requestId, patch) {
  const id = String(requestId || '').trim()
  if (!id || !isSupabaseConfigured || !supabase) {
    throw new Error('Database not configured.')
  }
  const row = { updated_at: new Date().toISOString() }
  if (patch.status != null) row.status = String(patch.status)
  if (patch.approvedAmount !== undefined) row.approved_amount = patch.approvedAmount
  if (patch.notes !== undefined) row.notes = patch.notes || null
  if (patch.stripePaymentIntentId !== undefined) row.stripe_payment_intent_id = patch.stripePaymentIntentId
  if (patch.stripePaymentLink !== undefined) row.stripe_payment_link = patch.stripePaymentLink
  if (patch.customerEmail !== undefined) row.customer_email = patch.customerEmail
  if (patch.customerName !== undefined) row.customer_name = patch.customerName
  if (patch.bookingReference !== undefined) row.booking_reference = patch.bookingReference
  if (patch.paidAt !== undefined) row.paid_at = patch.paidAt

  const { data, error } = await supabase.from(TABLE).update(row).eq('id', id).select('*').single()
  if (error) throw error
  return mapRow(data)
}

/**
 * Create a new extra charge request (used by driver app via API).
 */
export async function createExtraChargeRequest(input) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Database not configured.')
  }
  const payload = {
    job_id: String(input.jobId),
    quote_id: input.quoteId ? String(input.quoteId) : null,
    customer_id: input.customerId ? String(input.customerId) : null,
    driver_id: input.driverId ? String(input.driverId) : null,
    added_items: Array.isArray(input.addedItems) ? input.addedItems : [],
    added_volume_m3: Number(input.addedVolumeM3) || 0,
    estimated_amount: Math.max(0, Number(input.estimatedAmount) || 0),
    currency: String(input.currency || 'GBP'),
    status: 'pending_review',
    notes: input.notes ? String(input.notes) : null,
    customer_email: input.customerEmail ? String(input.customerEmail) : null,
    customer_name: input.customerName ? String(input.customerName) : null,
    booking_reference: input.bookingReference ? String(input.bookingReference) : null,
  }
  const { data, error } = await supabase.from(TABLE).insert(payload).select('*').single()
  if (error) throw error
  return mapRow(data)
}
