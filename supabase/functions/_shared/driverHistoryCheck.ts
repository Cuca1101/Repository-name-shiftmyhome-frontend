import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

export type DriverHistoryCheck = {
  hasHistory: boolean
  reasons: string[]
  canForceDelete: boolean
}

/** Cleared automatically when admin deletes with force_cleanup. */
export const DRIVER_HISTORY_ADMIN_PURGE_REASONS = new Set([
  'assigned_quotes',
  'job_assignments',
  'job_status_history',
  'driver_locations',
  'driver_charges',
  'driver_payout_audit_log',
  'driver_documents',
])

async function hasRows(
  admin: SupabaseClient,
  table: string,
  column: string,
  driverId: string,
): Promise<boolean> {
  const { count, error } = await admin
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(column, driverId)
  if (error) {
    console.warn(`[driverHistoryCheck] ${table}:`, error.message)
    return false
  }
  return (count ?? 0) > 0
}

async function hasCompletedQuotes(admin: SupabaseClient, driverId: string): Promise<boolean> {
  const { count, error } = await admin
    .from('quotes')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_driver_id', driverId)
    .in('status', ['Completed', 'Cancelled'])
  if (error) {
    console.warn('[driverHistoryCheck] quotes completed:', error.message)
    return false
  }
  return (count ?? 0) > 0
}

export function canForceDeleteFromReasons(reasons: string[]): boolean {
  return reasons.length > 0
}

async function resolveDriverDisplayName(admin: SupabaseClient, driverId: string): Promise<string> {
  const { data, error } = await admin.from('drivers').select('full_name').eq('id', driverId).maybeSingle()
  if (error) {
    console.warn('[cleanupDriverFleetLinks] driver name:', error.message)
  }
  const name = String(data?.full_name || '').trim()
  return name || 'Former driver'
}

/** Stamp driver name on job rows; keep timeline rows (driver_id cleared on drivers delete). */
async function stampDriverOnQuotes(
  admin: SupabaseClient,
  driverId: string,
  driverName: string,
): Promise<string | null> {
  const { data: rows, error: selErr } = await admin
    .from('quotes')
    .select('id, assigned_driver_name')
    .eq('assigned_driver_id', driverId)
  if (selErr) return `quotes read: ${selErr.message}`

  for (const row of rows ?? []) {
    const stampedName = String(row.assigned_driver_name || '').trim() || driverName
    const { error } = await admin
      .from('quotes')
      .update({ assigned_driver_id: null, assigned_driver_name: stampedName })
      .eq('id', row.id)
    if (error) return `quotes: ${error.message}`
  }
  return null
}

/** Stamp driver_name on status history (rows kept for Status Tracker dates). */
async function stampDriverOnStatusHistory(
  admin: SupabaseClient,
  driverId: string,
  driverName: string,
): Promise<string | null> {
  const { data: rows, error: selErr } = await admin
    .from('job_status_history')
    .select('id, driver_name')
    .eq('driver_id', driverId)
  if (selErr) return `status history read: ${selErr.message}`

  for (const row of rows ?? []) {
    const stampedName = String(row.driver_name || '').trim() || driverName
    const { error } = await admin.from('job_status_history').update({ driver_name: stampedName }).eq('id', row.id)
    if (error) return `status history: ${error.message}`
  }
  return null
}

/**
 * Detach live fleet links; preserve job stamps (names + status timeline).
 */
export async function cleanupDriverFleetLinks(
  admin: SupabaseClient,
  driverId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const errors: string[] = []
  const driverName = await resolveDriverDisplayName(admin, driverId)

  const quoteStampErr = await stampDriverOnQuotes(admin, driverId, driverName)
  if (quoteStampErr) errors.push(quoteStampErr)

  const histStampErr = await stampDriverOnStatusHistory(admin, driverId, driverName)
  if (histStampErr) errors.push(histStampErr)

  const { error: jaErr } = await admin.from('job_assignments').delete().eq('driver_id', driverId)
  if (jaErr) errors.push(`assignments: ${jaErr.message}`)

  const { error: locErr } = await admin.from('driver_locations').delete().eq('driver_id', driverId)
  if (locErr && !String(locErr.message || '').toLowerCase().includes('does not exist')) {
    console.warn('[cleanupDriverFleetLinks] driver_locations:', locErr.message)
  }

  const { error: ecrErr } = await admin
    .from('extra_charge_requests')
    .update({ driver_id: null })
    .eq('driver_id', driverId)
  if (ecrErr) {
    console.warn('[cleanupDriverFleetLinks] extra_charge_requests:', ecrErr.message)
  }

  const { error: chargesErr } = await admin.from('driver_charges').delete().eq('driver_id', driverId)
  if (chargesErr) errors.push(`charges: ${chargesErr.message}`)

  const { error: auditErr } = await admin
    .from('driver_payout_audit_log')
    .update({ driver_id: null })
    .eq('driver_id', driverId)
  if (auditErr) errors.push(`payout audit: ${auditErr.message}`)

  const { error: docsErr } = await admin.from('driver_documents').delete().eq('driver_id', driverId)
  if (docsErr && !String(docsErr.message || '').toLowerCase().includes('does not exist')) {
    errors.push(`documents: ${docsErr.message}`)
  }

  if (errors.length) {
    return { ok: false, message: errors.join('; ') }
  }
  return { ok: true }
}

/**
 * True when driver must not be hard-deleted (job/payment/audit trail exists).
 */
export async function driverHasFleetHistory(
  admin: SupabaseClient,
  driverId: string,
): Promise<DriverHistoryCheck> {
  const reasons: string[] = []

  if (await hasRows(admin, 'quotes', 'assigned_driver_id', driverId)) {
    reasons.push('assigned_quotes')
  }
  if (await hasRows(admin, 'job_assignments', 'driver_id', driverId)) {
    reasons.push('job_assignments')
  }
  if (await hasRows(admin, 'driver_charges', 'driver_id', driverId)) {
    reasons.push('driver_charges')
  }
  if (await hasRows(admin, 'job_status_history', 'driver_id', driverId)) {
    reasons.push('job_status_history')
  }
  if (await hasRows(admin, 'driver_payout_audit_log', 'driver_id', driverId)) {
    reasons.push('driver_payout_audit_log')
  }
  if (await hasRows(admin, 'driver_locations', 'driver_id', driverId)) {
    reasons.push('driver_locations')
  }
  if (await hasRows(admin, 'driver_documents', 'driver_id', driverId)) {
    reasons.push('driver_documents')
  }

  const unique = [...new Set(reasons)]
  return {
    hasHistory: unique.length > 0,
    reasons: unique,
    canForceDelete: canForceDeleteFromReasons(unique),
  }
}
