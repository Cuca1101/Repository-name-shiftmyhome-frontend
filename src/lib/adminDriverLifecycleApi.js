import { isSupabaseConfigured, supabase } from './supabase'
import { fleetDriverToAdminRecord } from './data/driversRepository'
import {
  buildAdminFunctionInvokeOpts,
  detailFromFunctionsInvokeError,
} from './functionsInvokeError'

const LIFECYCLE_FN = 'admin-driver-lifecycle'

/**
 * @param {string} code
 */
function mapLifecycleError(code) {
  switch (String(code || '')) {
    case 'driver_has_history':
      return 'Driver cannot be deleted because history exists. Archive the driver instead.'
    case 'driver_not_found':
      return 'Driver not found.'
    case 'unauthorized':
      return 'Admin session expired — sign in again.'
    case 'forbidden':
      return 'You do not have permission to manage drivers.'
    case 'invalid_action':
      return 'Invalid driver action.'
    case 'driver_update_failed':
      return 'Could not update driver — try again or contact support.'
    case 'driver_delete_failed':
      return 'Could not delete driver.'
    case 'driver_cleanup_failed':
      return 'Could not remove driver assignments before delete.'
    default:
      return ''
  }
}

/**
 * @param {string} driverId
 * @param {'disable' | 'enable' | 'reactivate' | 'archive' | 'delete'} action
 * @param {{ deleteAuthUser?: boolean, forceCleanup?: boolean }} [opts]
 */
export async function invokeAdminDriverLifecycle(driverId, action, opts = {}) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Connect Supabase to manage drivers.')
  }

  const id = String(driverId || '').trim()
  if (!id) throw new Error('Driver id is required.')

  const body = {
    driver_id: id,
    action: String(action || '').trim().toLowerCase(),
  }
  if (action === 'delete') {
    body.delete_auth_user = opts.deleteAuthUser !== false
    if (opts.forceCleanup) body.force_cleanup = true
  }

  const invokeOpts = await buildAdminFunctionInvokeOpts(supabase, body)
  const { data, error } = await supabase.functions.invoke(LIFECYCLE_FN, invokeOpts)

  if (error) {
    throw new Error(
      await detailFromFunctionsInvokeError(
        error,
        `Could not reach ${LIFECYCLE_FN}. Deploy: npx supabase functions deploy ${LIFECYCLE_FN}`,
      ),
    )
  }

  const payload = data && typeof data === 'object' ? data : {}
  if (!payload.ok) {
    const msg =
      (typeof payload.message === 'string' && payload.message) ||
      mapLifecycleError(payload.error) ||
      'Driver action failed.'
    const err = new Error(msg)
    if (payload.error === 'driver_has_history') {
      err.code = 'driver_has_history'
      err.canForceDelete = Boolean(payload.canForceDelete)
      err.reasons = Array.isArray(payload.reasons) ? payload.reasons : []
    }
    throw err
  }

  return {
    message: typeof payload.message === 'string' ? payload.message : 'Done',
    driverId: id,
    driver: payload.driver ? fleetDriverToAdminRecord(payload.driver) : null,
    action: payload.action,
    authUserDeleted: Boolean(payload.authUserDeleted),
    partial: Boolean(payload.partial),
  }
}
