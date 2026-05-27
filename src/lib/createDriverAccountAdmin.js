import { normalizeDriverEmail } from './driverAuthModel'
import { isSupabaseConfigured, supabase } from './supabase'
import { fleetDriverToAdminRecord } from './data/driversRepository'
import {
  buildAdminFunctionInvokeOpts,
  detailFromFunctionsInvokeError,
} from './functionsInvokeError'

/**
 * Admin-only: create Supabase Auth user + drivers row (no public driver sign-up).
 *
 * @param {{
 *   fullName: string,
 *   email: string,
 *   phone?: string,
 *   vehicleType?: string,
 *   vehicleRegistration?: string,
 *   temporaryPassword: string,
 *   active?: boolean,
 * }} input
 */
const CREATE_DRIVER_FN = 'admin-create-driver'
const CREATE_DRIVER_FN_LEGACY = 'create-driver-account'

/**
 * @param {string} fnName
 * @param {Record<string, unknown>} body
 */
async function invokeCreateDriverFunction(fnName, body) {
  const invokeOpts = await buildAdminFunctionInvokeOpts(supabase, body)
  const { data, error } = await supabase.functions.invoke(fnName, invokeOpts)
  return { data, error, fnName }
}

export async function createDriverAccountAdmin(input) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Connect Supabase to create driver login accounts.')
  }

  const body = {
    full_name: String(input.fullName || '').trim(),
    email: normalizeDriverEmail(input.email),
    phone: String(input.phone || '').trim(),
    vehicle_type: String(input.vehicleType || '').trim(),
    vehicle_registration: String(input.vehicleRegistration || '').trim(),
    temporary_password: String(input.temporaryPassword || ''),
    active: input.active !== false,
  }

  let { data, error, fnName: fnUsed } = await invokeCreateDriverFunction(CREATE_DRIVER_FN, body)

  if (error) {
    const primaryDetail = await detailFromFunctionsInvokeError(
      error,
      `Could not reach ${CREATE_DRIVER_FN}. Deploy it: npx supabase functions deploy ${CREATE_DRIVER_FN}`,
    )

    const legacy = await invokeCreateDriverFunction(CREATE_DRIVER_FN_LEGACY, body)
    if (!legacy.error) {
      data = legacy.data
      error = null
      fnUsed = legacy.fnName
    } else {
      const legacyDetail = await detailFromFunctionsInvokeError(legacy.error, '')
      const combined = [primaryDetail, legacyDetail].filter(Boolean).join(' ')
      throw new Error(
        combined ||
          `Deploy Edge Function: npx supabase functions deploy ${CREATE_DRIVER_FN}`,
      )
    }
  }

  const payload = data && typeof data === 'object' ? data : {}
  if (!payload.ok) {
    const msg =
      (typeof payload.message === 'string' && payload.message) ||
      mapCreateDriverError(payload.error) ||
      `Could not create driver account (${fnUsed}).`
    throw new Error(msg)
  }

  const driver = payload.driver ? fleetDriverToAdminRecord(payload.driver) : null
  return {
    successMessage:
      (typeof payload.message === 'string' && payload.message) || 'Driver account created',
    userId: payload.userId != null ? String(payload.userId) : '',
    driverId: payload.driverId != null ? String(payload.driverId) : driver?.id || '',
    driver,
  }
}

/**
 * @param {string} code
 */
function mapCreateDriverError(code) {
  switch (String(code || '')) {
    case 'full_name_required':
      return 'Enter the driver full name.'
    case 'email_required':
      return 'Enter a valid email address.'
    case 'password_min_8':
      return 'Temporary password must be at least 8 characters.'
    case 'driver_email_exists':
      return 'A driver profile with this email already exists.'
    case 'auth_email_exists':
      return 'This email is already registered. Use a different email or link the existing Auth user manually.'
    case 'unauthorized':
      return 'Admin session expired — sign in again.'
    case 'forbidden':
      return 'You do not have permission to create driver accounts. Set app_metadata.role = admin on your Auth user.'
    case 'server_misconfigured':
      return 'Edge Function is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY secrets.'
    default:
      return ''
  }
}
