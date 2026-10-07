/**
 * Admin data helpers for driver_support_requests (Driver Messages).
 */
import { isSupabaseConfigured, supabase } from './supabase'

export const DRIVER_MESSAGES_SELECT =
  'id, driver_id, driver_name, driver_phone, driver_email, driver_photo_url, topic, message, urgent, status, scope, quote_id, quote_ref, assignment_id, created_at, updated_at, resolved_at, admin_notes, read_at, read_by'

/** @param {object | null | undefined} row */
export function isMessageUnread(row) {
  return row != null && (row.read_at == null || row.read_at === '')
}

/**
 * @returns {Promise<{ rows: object[], error: string | null }>}
 */
export async function fetchDriverSupportMessages() {
  if (!isSupabaseConfigured || !supabase) {
    return { rows: [], error: null }
  }
  const { data, error } = await supabase
    .from('driver_support_requests')
    .select(DRIVER_MESSAGES_SELECT)
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) return { rows: [], error: error.message || 'Could not load messages.' }
  return { rows: data || [], error: null }
}

/**
 * @returns {Promise<number>}
 */
export async function countUnreadDriverMessages() {
  if (!isSupabaseConfigured || !supabase) return 0
  const { count, error } = await supabase
    .from('driver_support_requests')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
  if (error) return 0
  return Number(count) || 0
}

/**
 * Mark a single message as read when Admin actually opens/views it.
 * @param {string} id
 * @param {string | null} [readBy]
 */
export async function markDriverMessageRead(id, readBy = null) {
  if (!supabase || !id) return { ok: false, error: 'Missing id' }
  const { error } = await supabase
    .from('driver_support_requests')
    .update({
      read_at: new Date().toISOString(),
      read_by: readBy || null,
    })
    .eq('id', id)
    .is('read_at', null)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/**
 * @param {string} id
 * @param {'new' | 'in_progress' | 'resolved'} status
 */
export async function updateDriverMessageStatus(id, status) {
  if (!supabase || !id) return { ok: false, error: 'Missing id' }
  const patch = {
    status,
    resolved_at: status === 'resolved' ? new Date().toISOString() : null,
  }
  const { error } = await supabase.from('driver_support_requests').update(patch).eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/**
 * Group messages by driver for the inbox list.
 * Drivers with unread first; within that, urgent unread first; then latest activity.
 * @param {object[]} rows
 */
export function groupMessagesByDriver(rows) {
  /** @type {Map<string, { driverId: string, driverName: string, driverPhone: string | null, driverEmail: string | null, driverPhotoUrl: string | null, messages: object[], unreadCount: number, urgentUnread: number, latest: object }>} */
  const map = new Map()

  for (const row of rows || []) {
    const driverId = String(row.driver_id || '')
    if (!driverId) continue
    let g = map.get(driverId)
    if (!g) {
      g = {
        driverId,
        driverName: String(row.driver_name || 'Driver').trim() || 'Driver',
        driverPhone: row.driver_phone ? String(row.driver_phone) : null,
        driverEmail: row.driver_email ? String(row.driver_email) : null,
        driverPhotoUrl: row.driver_photo_url ? String(row.driver_photo_url) : null,
        messages: [],
        unreadCount: 0,
        urgentUnread: 0,
        latest: row,
      }
      map.set(driverId, g)
    }
    g.messages.push(row)
    if (isMessageUnread(row)) {
      g.unreadCount += 1
      if (row.urgent) g.urgentUnread += 1
    }
    // Prefer fresher photo/name if present
    if (row.driver_photo_url && !g.driverPhotoUrl) g.driverPhotoUrl = String(row.driver_photo_url)
    if (row.driver_name) g.driverName = String(row.driver_name).trim() || g.driverName
    if (row.driver_phone) g.driverPhone = String(row.driver_phone)
    if (row.driver_email) g.driverEmail = String(row.driver_email)
    if (new Date(row.created_at).getTime() > new Date(g.latest.created_at).getTime()) {
      g.latest = row
    }
  }

  const groups = [...map.values()]
  for (const g of groups) {
    g.messages.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )
  }

  groups.sort((a, b) => {
    if (a.unreadCount > 0 !== b.unreadCount > 0) return a.unreadCount > 0 ? -1 : 1
    if (Boolean(a.urgentUnread) !== Boolean(b.urgentUnread)) return a.urgentUnread ? -1 : 1
    if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount
    return new Date(b.latest.created_at).getTime() - new Date(a.latest.created_at).getTime()
  })

  return groups
}
