/**
 * Driver mobile auth — admin-created accounts only (no public driver sign-up).
 */

export const DRIVER_AUTH_NO_PROFILE = 'no_profile'
export const DRIVER_AUTH_INACTIVE = 'inactive'

export const DRIVER_AUTH_MESSAGES = {
  [DRIVER_AUTH_NO_PROFILE]: 'No driver profile found',
  [DRIVER_AUTH_INACTIVE]: 'Driver account inactive',
}

/** @type {readonly string[]} */
export const DRIVER_VEHICLE_TYPE_OPTIONS = [
  'Small van',
  'SWB van',
  'LWB van',
  'Luton van',
  'Luton with tail lift',
  '7.5 tonne',
  'Other',
]

/**
 * @param {string} email
 */
export function normalizeDriverEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase()
}

/**
 * Preview / offline driver profile for development (VITE_DRIVER_PREVIEW_MODE=true).
 * @returns {import('./data/driversRepository').ReturnType<import('./data/driversRepository').fleetDriverToAdminRecord>}
 */
export function buildPreviewDriverProfile() {
  return {
    id: 'preview-driver',
    name: 'Preview Driver',
    email: 'preview@shiftmyhome.local',
    phone: '',
    status: 'Active',
    notes: 'Preview mode — no Supabase Auth',
    rating: '',
    partnerId: '',
    userId: 'preview-user',
    legacySessionId: '',
    address: '',
    dateOfBirth: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    vehicleType: 'LWB van',
    accountActive: true,
    hasLogin: true,
  }
}

/**
 * @param {unknown} code
 */
export function driverAuthMessageForCode(code) {
  const c = String(code || '').trim()
  return DRIVER_AUTH_MESSAGES[c] || 'Could not sign in as driver.'
}
