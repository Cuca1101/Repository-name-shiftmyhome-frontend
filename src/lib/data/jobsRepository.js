import { sanitizeAdminIlikeTerm } from '../adminSearch'
import { isSupabaseConfigured, supabase } from '../supabase'
import { LS_JOBS, LS_JOB_ITEMS, LS_JOB_SEQ } from '../localStorageKeys'

const JOBS_TABLE = 'jobs'
const JOB_ITEMS_TABLE = 'job_items'

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function yearFromSeqKey() {
  return new Date().getFullYear()
}

function nextLocalJobReference() {
  const y = yearFromSeqKey()
  const key = `${LS_JOB_SEQ}:${y}`
  const raw = localStorage.getItem(key)
  let n = raw ? parseInt(raw, 10) : 0
  if (Number.isNaN(n)) n = 0
  n += 1
  localStorage.setItem(key, String(n))
  return `SMH-${y}-${String(n).padStart(4, '0')}`
}

/**
 * @typedef {Object} JobRow
 * @property {string} id
 * @property {string} job_reference
 * @property {string} full_name
 * @property {string} phone
 * @property {string} email
 * @property {string} pickup_address
 * @property {string} delivery_address
 * @property {string} move_date
 * @property {string} service_type
 * @property {number} [distance_miles]
 * @property {number} total_cubic_metres
 * @property {Record<string, unknown>} price_breakdown
 * @property {Record<string, unknown>} price_inputs
 * @property {number} estimated_total
 * @property {number|null} [final_price]
 * @property {string|null} [internal_notes]
 * @property {string} status
 * @property {string} created_at
 */

/**
 * @typedef {Object} JobItemRow
 * @property {string} id
 * @property {string} job_id
 * @property {string} item_name
 * @property {string|null} library_item_id
 * @property {number} quantity
 * @property {number} cubic_metres_per_unit
 * @property {number} line_volume_m3
 * @property {boolean} is_custom
 * @property {string|null} [weight_type]
 */

/**
 * @param {Omit<JobRow, 'id' | 'job_reference' | 'created_at'> & { job_items?: Partial<JobItemRow>[] }} payload
 */
export async function createJobRequest(payload) {
  const {
    job_items: jobItems = [],
    ...jobFields
  } = payload

  if (isSupabaseConfigured && supabase) {
    const { data: job, error: jobError } = await supabase
      .from(JOBS_TABLE)
      .insert({
        full_name: jobFields.full_name,
        phone: jobFields.phone,
        email: jobFields.email,
        pickup_address: jobFields.pickup_address,
        delivery_address: jobFields.delivery_address,
        move_date: jobFields.move_date,
        service_type: jobFields.service_type,
        distance_miles: jobFields.distance_miles ?? null,
        total_cubic_metres: jobFields.total_cubic_metres,
        price_breakdown: jobFields.price_breakdown,
        price_inputs: jobFields.price_inputs,
        estimated_total: jobFields.estimated_total,
        final_price: jobFields.final_price ?? null,
        internal_notes: jobFields.internal_notes ?? null,
        customer_message: jobFields.customer_message ?? null,
        status: jobFields.status || 'New',
        arrival_type: jobFields.arrival_type ?? null,
        arrival_time: jobFields.arrival_time ?? null,
      })
      .select('*')
      .single()

    if (jobError) throw jobError

    if (jobItems.length > 0) {
      const rows = jobItems.map((row) => ({
        job_id: job.id,
        item_name: row.item_name,
        library_item_id: row.library_item_id ?? null,
        quantity: row.quantity,
        cubic_metres_per_unit: row.cubic_metres_per_unit,
        line_volume_m3: row.line_volume_m3,
        is_custom: Boolean(row.is_custom),
        weight_type: row.weight_type ?? null,
      }))
      const { error: jiError } = await supabase.from(JOB_ITEMS_TABLE).insert(rows)
      if (jiError) throw jiError
    }

    return job
  }

  const id = uuid()
  const job_reference = nextLocalJobReference()
  const now = new Date().toISOString()
  /** @type {JobRow} */
  const job = {
    id,
    job_reference,
    full_name: jobFields.full_name,
    phone: jobFields.phone,
    email: jobFields.email,
    pickup_address: jobFields.pickup_address,
    delivery_address: jobFields.delivery_address,
    move_date: jobFields.move_date,
    service_type: jobFields.service_type,
    distance_miles: jobFields.distance_miles,
    total_cubic_metres: jobFields.total_cubic_metres,
    price_breakdown: jobFields.price_breakdown,
    price_inputs: jobFields.price_inputs,
    estimated_total: jobFields.estimated_total,
    final_price: jobFields.final_price ?? null,
    internal_notes: jobFields.internal_notes ?? null,
    customer_message: jobFields.customer_message ?? null,
    status: jobFields.status || 'New',
    arrival_type: jobFields.arrival_type ?? null,
    arrival_time: jobFields.arrival_time ?? null,
    created_at: now,
  }

  const jobs = readLsJobs()
  jobs.unshift(job)
  localStorage.setItem(LS_JOBS, JSON.stringify(jobs))

  if (jobItems.length > 0) {
    const jis = readLsJobItems()
    for (const row of jobItems) {
      jis.push({
        id: uuid(),
        job_id: id,
        item_name: row.item_name,
        library_item_id: row.library_item_id ?? null,
        quantity: row.quantity,
        cubic_metres_per_unit: row.cubic_metres_per_unit,
        line_volume_m3: row.line_volume_m3,
        is_custom: Boolean(row.is_custom),
        weight_type: row.weight_type ?? null,
      })
    }
    localStorage.setItem(LS_JOB_ITEMS, JSON.stringify(jis))
  }

  return job
}

/**
 * @returns {Promise<JobRow[]>}
 */
export async function fetchAllJobs() {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from(JOBS_TABLE)
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  }
  return readLsJobs()
}

/**
 * @param {JobRow} job
 * @param {string} safe lowercased search already sanitized
 */
function jobMatchesLocalSearch(job, safe) {
  if (!safe) return true
  const p = safe.toLowerCase()
  const fields = [
    job.job_reference,
    job.full_name,
    job.phone,
    job.email,
    job.pickup_address,
    job.delivery_address,
  ]
  for (const f of fields) {
    if (f != null && String(f).toLowerCase().includes(p)) return true
  }
  const pi = job.price_inputs
  const qr = pi && typeof pi === 'object' && pi.quoteRef != null ? String(pi.quoteRef) : ''
  if (qr && qr.toLowerCase().includes(p)) return true
  return false
}

/**
 * Admin list with optional status filter and ilike search across job + embedded wizard quote ref.
 *
 * @param {string} [searchTerm]
 * @param {string | null} [status] e.g. Booked, Completed — omit for all
 * @returns {Promise<JobRow[]>}
 */
export async function fetchJobsForAdmin(searchTerm = '', status = null) {
  const safe = sanitizeAdminIlikeTerm(searchTerm)

  if (!isSupabaseConfigured || !supabase) {
    let list = readLsJobs()
    if (status) list = list.filter((j) => j.status === status)
    list = [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    if (!safe) return list
    return list.filter((j) => jobMatchesLocalSearch(j, safe))
  }

  const base = () => {
    let q = supabase.from(JOBS_TABLE).select('*').order('created_at', { ascending: false })
    if (status) q = q.eq('status', status)
    return q
  }

  if (!safe) {
    const { data, error } = await base()
    if (error) throw error
    return data ?? []
  }

  const p = `%${safe}%`
  const orClause = `job_reference.ilike.${p},full_name.ilike.${p},phone.ilike.${p},email.ilike.${p},pickup_address.ilike.${p},delivery_address.ilike.${p}`

  const [resCols, resJson] = await Promise.all([base().or(orClause), base().filter('price_inputs->>quoteRef', 'ilike', p)])

  if (resCols.error) throw resCols.error

  /** @type {Map<string, JobRow>} */
  const map = new Map()
  for (const row of resCols.data ?? []) {
    map.set(row.id, row)
  }
  if (!resJson.error && resJson.data) {
    for (const row of resJson.data) {
      if (!map.has(row.id)) map.set(row.id, row)
    }
  }

  return [...map.values()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

/**
 * @param {string} id
 * @returns {Promise<JobRow|undefined>}
 */
export async function fetchJobById(id) {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from(JOBS_TABLE).select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data ?? undefined
  }
  return readLsJobs().find((j) => j.id === id)
}

/**
 * Map wizard quote ref (price_inputs.quoteRef) → job id for admin links.
 * Loads id + price_inputs only; builds map for refs that appear in `quoteRefs`.
 *
 * @param {string[]} quoteRefs
 * @returns {Promise<Record<string, string>>} quote_ref → job uuid
 */
export async function fetchJobIdsForQuoteRefs(quoteRefs) {
  const uniq = [...new Set(quoteRefs.filter(Boolean).map((s) => String(s).trim()))]
  if (!isSupabaseConfigured || !supabase || uniq.length === 0) {
    return {}
  }

  const { data, error } = await supabase.from(JOBS_TABLE).select('id, price_inputs')
  if (error) throw error

  /** @type {Record<string, string>} */
  const map = {}
  for (const row of data ?? []) {
    const pi = row.price_inputs
    const ref =
      pi && typeof pi === 'object' && pi.quoteRef != null ? String(pi.quoteRef).trim() : ''
    if (ref && uniq.includes(ref) && map[ref] == null) {
      map[ref] = row.id
    }
  }
  return map
}

/**
 * @param {string} jobId
 * @returns {Promise<JobItemRow[]>}
 */
export async function fetchJobItems(jobId) {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from(JOB_ITEMS_TABLE)
      .select('*')
      .eq('job_id', jobId)
    if (error) throw error
    return data ?? []
  }
  return readLsJobItems().filter((r) => r.job_id === jobId)
}

/**
 * @param {string} id
 * @param {Partial<JobRow>} patch
 */
export async function updateJob(id, patch) {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from(JOBS_TABLE)
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return data
  }
  const jobs = readLsJobs()
  const next = jobs.map((j) => (j.id === id ? { ...j, ...patch } : j))
  localStorage.setItem(LS_JOBS, JSON.stringify(next))
  return next.find((j) => j.id === id)
}

/**
 * @param {string} id
 */
export async function deleteJob(id) {
  if (isSupabaseConfigured && supabase) {
    const { error: e1 } = await supabase.from(JOB_ITEMS_TABLE).delete().eq('job_id', id)
    if (e1) throw e1
    const { error: e2 } = await supabase.from(JOBS_TABLE).delete().eq('id', id)
    if (e2) throw e2
    return
  }
  localStorage.setItem(
    LS_JOBS,
    JSON.stringify(readLsJobs().filter((j) => j.id !== id)),
  )
  localStorage.setItem(
    LS_JOB_ITEMS,
    JSON.stringify(readLsJobItems().filter((r) => r.job_id !== id)),
  )
}

function readLsJobs() {
  const raw = localStorage.getItem(LS_JOBS)
  if (!raw) return []
  try {
    const p = JSON.parse(raw)
    return Array.isArray(p) ? p : []
  } catch {
    return []
  }
}

function readLsJobItems() {
  const raw = localStorage.getItem(LS_JOB_ITEMS)
  if (!raw) return []
  try {
    const p = JSON.parse(raw)
    return Array.isArray(p) ? p : []
  } catch {
    return []
  }
}

/**
 * Fetch jobs from `quotes` legacy table (read-only) for dashboard stats when only quotes exist.
 * @returns {Promise<number>}
 */
export async function countLegacyQuotes() {
  if (!isSupabaseConfigured || !supabase) return 0
  const { count, error } = await supabase
    .from('quotes')
    .select('id', { count: 'exact', head: true })
  if (error) return 0
  return count ?? 0
}
