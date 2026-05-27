import { countAssignedJobsForDriver, countCompletedJobsForDriver } from './adminDriverStats'
import { invokeAdminDriverLifecycle } from './adminDriverLifecycleApi'
import { isSupabaseConfigured, supabase } from './supabase'
import { upsertFleetDriver } from './data/driversRepository'

/** @typedef {'active' | 'suspended' | 'archived'} DriverLifecyclePhase */

const HISTORY_MESSAGE =
  'Driver cannot be deleted because history exists. Archive the driver instead.'

/**
 * @param {{ status?: string, accountActive?: boolean } | null | undefined} driver
 * @returns {DriverLifecyclePhase}
 */
export function getDriverLifecyclePhase(driver) {
  const st = String(driver?.status || 'Active')
  if (st === 'Archived') return 'archived'
  if (st === 'Suspended' || st === 'Inactive') return 'suspended'
  if (driver?.accountActive === false) return 'suspended'
  return 'active'
}

/**
 * @param {{ status?: string, accountActive?: boolean } | null | undefined} driver
 */
export function isDriverEligibleForAssignment(driver) {
  return getDriverLifecyclePhase(driver) === 'active'
}

/**
 * @param {string} driverId
 * @param {'disable' | 'enable' | 'reactivate' | 'archive' | 'delete'} action
 * @returns {Promise<{ driver: import('./data/driversRepository').ReturnType<typeof import('./data/driversRepository').fleetDriverToAdminRecord> | null, message: string } | null>}
 */
async function runLifecycleAction(driverId, action) {
  if (isSupabaseConfigured && supabase) {
    const result = await invokeAdminDriverLifecycle(driverId, action)
    return { driver: result.driver, message: result.message }
  }
  return null
}

/**
 * @param {Record<string, unknown>} driver
 * @param {'disable' | 'enable' | 'reactivate' | 'archive'} action
 * @param {Record<string, unknown>} patch
 */
async function localFallback(driver, action, patch) {
  const rec = { ...driver, ...patch }
  if (!isSupabaseConfigured || !supabase) return rec
  const saved = await upsertFleetDriver(rec)
  if (!saved) throw new Error('Could not update driver.')
  return saved
}

/**
 * @param {Record<string, unknown>} driver
 */
export async function disableFleetDriver(driver) {
  const id = String(driver?.id || '').trim()
  const remote = await runLifecycleAction(id, 'disable')
  if (remote) return remote
  const saved = await localFallback(driver, 'disable', { status: 'Suspended', accountActive: false })
  return { driver: saved, message: 'Driver disabled' }
}

/**
 * @param {Record<string, unknown>} driver
 */
export async function reactivateFleetDriver(driver) {
  const id = String(driver?.id || '').trim()
  const remote = await runLifecycleAction(id, 'enable')
  if (remote) return remote
  const saved = await localFallback(driver, 'enable', { status: 'Active', accountActive: true })
  return { driver: saved, message: 'Driver enabled' }
}

/**
 * @param {Record<string, unknown>} driver
 */
export async function archiveFleetDriver(driver) {
  const id = String(driver?.id || '').trim()
  const remote = await runLifecycleAction(id, 'archive')
  if (remote) return remote
  const saved = await localFallback(driver, 'archive', { status: 'Archived', accountActive: false })
  return { driver: saved, message: 'Driver archived' }
}

/**
 * @param {string} driverId
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
async function tableHasDriverRows(client, table, column, driverId) {
  const { count, error } = await client
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(column, driverId)
  if (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn(`[driverHistory] ${table}`, error.message)
    }
    return true
  }
  return (count ?? 0) > 0
}

/**
 * @param {string} driverId
 * @param {{ quotes?: Record<string, unknown>[], jobs?: Record<string, unknown>[] }} [ctx]
 */
export async function checkDriverCanHardDelete(driverId, ctx = {}) {
  const id = String(driverId || '').trim()
  if (!id) {
    return { canDelete: false, message: 'Invalid driver.', reasons: [] }
  }

  const reasons = []
  const driver = { id }
  const quotes = ctx.quotes || []
  const jobs = ctx.jobs || []

  if (countAssignedJobsForDriver(driver, quotes, jobs) > 0) {
    reasons.push('assigned_quotes')
  }
  if (countCompletedJobsForDriver(driver, quotes, jobs) > 0) {
    reasons.push('completed_jobs')
  }

  if (isSupabaseConfigured && supabase) {
    const checks = await Promise.all([
      tableHasDriverRows(supabase, 'quotes', 'assigned_driver_id', id).then((v) => v && 'assigned_quotes'),
      tableHasDriverRows(supabase, 'job_assignments', 'driver_id', id).then((v) => v && 'job_assignments'),
      tableHasDriverRows(supabase, 'driver_charges', 'driver_id', id).then((v) => v && 'driver_charges'),
      tableHasDriverRows(supabase, 'job_status_history', 'driver_id', id).then((v) => v && 'job_status_history'),
      tableHasDriverRows(supabase, 'driver_payout_audit_log', 'driver_id', id).then(
        (v) => v && 'driver_payout_audit_log',
      ),
    ])
    for (const r of checks) {
      if (r && !reasons.includes(r)) reasons.push(r)
    }
  }

  const unique = [...new Set(reasons)]
  if (unique.length > 0) {
    return { canDelete: false, message: HISTORY_MESSAGE, reasons: unique }
  }
  return { canDelete: true, message: '', reasons: [] }
}

export { HISTORY_MESSAGE as DRIVER_ARCHIVE_INSTEAD_MESSAGE }
