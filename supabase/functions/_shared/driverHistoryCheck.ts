import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

export type DriverHistoryCheck = {
  hasHistory: boolean
  reasons: string[]
  canForceDelete: boolean
}

/** Blocks hard delete even after assignment cleanup (financial audit). */
export const DRIVER_HISTORY_HARD_BLOCKERS = new Set(['driver_charges', 'driver_payout_audit_log'])

/** Safe to clear before delete (test / mistaken assignment). */
export const DRIVER_HISTORY_SOFT_REASONS = new Set([
  'assigned_quotes',
  'job_assignments',
  'job_status_history',
  'driver_locations',
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
  if (!reasons.length) return true
  return reasons.every((r) => DRIVER_HISTORY_SOFT_REASONS.has(r))
}

/**
 * Remove assignment / status links so driver row can be deleted (admin test cleanup).
 */
export async function cleanupDriverFleetLinks(
  admin: SupabaseClient,
  driverId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const errors: string[] = []

  const { error: histErr } = await admin.from('job_status_history').delete().eq('driver_id', driverId)
  if (histErr) errors.push(`status history: ${histErr.message}`)

  const { error: jaErr } = await admin.from('job_assignments').delete().eq('driver_id', driverId)
  if (jaErr) errors.push(`assignments: ${jaErr.message}`)

  const { error: quotesErr } = await admin
    .from('quotes')
    .update({ assigned_driver_id: null })
    .eq('assigned_driver_id', driverId)
  if (quotesErr) errors.push(`quotes: ${quotesErr.message}`)

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

  const unique = [...new Set(reasons)]
  const hasHard = unique.some((r) => DRIVER_HISTORY_HARD_BLOCKERS.has(r))
  return {
    hasHistory: unique.length > 0,
    reasons: unique,
    canForceDelete: unique.length > 0 && !hasHard && canForceDeleteFromReasons(unique),
  }
}
