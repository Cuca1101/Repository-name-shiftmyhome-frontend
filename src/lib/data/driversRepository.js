import { isSupabaseConfigured, supabase } from '../supabase'

const TABLE = 'drivers'

/**
 * @typedef {{
 *   id: string,
 *   user_id: string | null,
 *   full_name: string,
 *   email: string,
 *   phone: string,
 *   vehicle_type: string,
 *   vehicle_registration: string | null,
 *   fleet_status: 'Active' | 'Inactive' | 'Suspended' | 'Archived',
 *   notes: string,
 *   rating: string,
 *   partner_id: string | null,
 *   legacy_session_id: string | null,
 *   active: boolean,
 *   address: string | null,
 *   date_of_birth: string | null,
 *   emergency_contact_name: string | null,
 *   emergency_contact_phone: string | null,
 * }} FleetDriverRow
 */

/**
 * Admin UI driver card shape (compatible with legacy sessionStorage records).
 * @param {FleetDriverRow} row
 */
export function fleetDriverToAdminRecord(row) {
  const accountActive = row.active !== false
  return {
    id: String(row.id),
    name: String(row.full_name || '').trim(),
    email: String(row.email || '').trim(),
    phone: String(row.phone || '').trim(),
    vehicleType: String(row.vehicle_type || '').trim(),
    vehicleRegistration: String(row.vehicle_registration || '').trim(),
    status:
      row.fleet_status === 'Archived'
        ? 'Archived'
        : row.fleet_status === 'Suspended'
          ? 'Suspended'
          : row.fleet_status === 'Inactive'
            ? 'Inactive'
            : 'Active',
    accountActive,
    hasLogin: Boolean(row.user_id),
    notes: String(row.notes || '').trim(),
    rating: String(row.rating || '').trim(),
    partnerId: row.partner_id != null ? String(row.partner_id) : '',
    userId: row.user_id != null ? String(row.user_id) : '',
    legacySessionId: row.legacy_session_id != null ? String(row.legacy_session_id) : '',
    address: String(row.address || '').trim(),
    dateOfBirth: row.date_of_birth ? String(row.date_of_birth).slice(0, 10) : '',
    emergencyContactName: String(row.emergency_contact_name || '').trim(),
    emergencyContactPhone: String(row.emergency_contact_phone || '').trim(),
  }
}

/**
 * @param {Record<string, unknown>} rec
 * @returns {Record<string, unknown>}
 */
export function adminRecordToFleetDriverPayload(rec) {
  const status = String(rec.status || 'Active')
  let fleetStatus = 'Active'
  if (status === 'Archived') fleetStatus = 'Archived'
  else if (status === 'Suspended') fleetStatus = 'Suspended'
  else if (status === 'Inactive') fleetStatus = 'Inactive'

  const accountActive =
    rec.accountActive !== false &&
    fleetStatus !== 'Suspended' &&
    fleetStatus !== 'Inactive' &&
    fleetStatus !== 'Archived'

  return {
    full_name: String(rec.name || '').trim(),
    email: String(rec.email || '').trim() || null,
    phone: String(rec.phone || '').trim() || null,
    vehicle_type: String(rec.vehicleType || '').trim() || null,
    vehicle_registration: String(rec.vehicleRegistration || '').trim() || null,
    fleet_status: fleetStatus,
    notes: String(rec.notes || '').trim() || null,
    rating: String(rec.rating || '').trim() || null,
    partner_id: rec.partnerId ? String(rec.partnerId) : null,
    legacy_session_id: rec.legacySessionId ? String(rec.legacySessionId) : rec.id ? String(rec.id) : null,
    active: accountActive,
    address: String(rec.address || '').trim() || null,
    date_of_birth: String(rec.dateOfBirth || '').trim() || null,
    emergency_contact_name: String(rec.emergencyContactName || '').trim() || null,
    emergency_contact_phone: String(rec.emergencyContactPhone || '').trim() || null,
    updated_at: new Date().toISOString(),
  }
}

/**
 * @returns {Promise<ReturnType<typeof fleetDriverToAdminRecord>[]>}
 */
export async function fetchFleetDrivers() {
  if (!isSupabaseConfigured || !supabase) return []
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('full_name', { ascending: true })
  if (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[drivers] fetch failed', error.message)
    }
    return []
  }
  return (data ?? []).map((row) => fleetDriverToAdminRecord(/** @type {FleetDriverRow} */ (row)))
}

/**
 * @param {Record<string, unknown>} rec admin driver record (with id for updates)
 * @returns {Promise<ReturnType<typeof fleetDriverToAdminRecord> | null>}
 */
export async function upsertFleetDriver(rec) {
  if (!isSupabaseConfigured || !supabase) return null
  const id = String(rec.id || '').trim()
  const payload = adminRecordToFleetDriverPayload(rec)

  if (id) {
    const { data, error } = await supabase.from(TABLE).update(payload).eq('id', id).select('*').single()
    if (error) throw error
    return fleetDriverToAdminRecord(/** @type {FleetDriverRow} */ (data))
  }

  const { data, error } = await supabase.from(TABLE).insert(payload).select('*').single()
  if (error) throw error
  return fleetDriverToAdminRecord(/** @type {FleetDriverRow} */ (data))
}

/**
 * @param {string} driverId
 */
/**
 * @param {string} userId auth.users.id
 * @returns {Promise<FleetDriverRow | null>}
 */
export async function fetchFleetDriverByUserId(userId) {
  const uid = String(userId || '').trim()
  if (!isSupabaseConfigured || !supabase || !uid) return null
  const { data, error } = await supabase.from(TABLE).select('*').eq('user_id', uid).maybeSingle()
  if (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[drivers] fetch by user_id failed', error.message)
    }
    return null
  }
  return data ?? null
}

/**
 * @param {string} driverId
 */
export async function setFleetDriverUserId(driverId, userId) {
  if (!isSupabaseConfigured || !supabase) return
  const { error } = await supabase
    .from(TABLE)
    .update({ user_id: userId, updated_at: new Date().toISOString() })
    .eq('id', driverId)
  if (error) throw error
}

/**
 * @param {string} name
 * @param {ReturnType<typeof fleetDriverToAdminRecord>[]} drivers
 */
export function findFleetDriverByNormalizedName(name, drivers) {
  const t = String(name || '').trim().toLowerCase()
  if (!t) return null
  return drivers.find((d) => String(d.name || '').trim().toLowerCase() === t) ?? null
}
