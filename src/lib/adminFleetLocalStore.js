const DRIVERS_KEY = 'smh_admin_drivers_v1'
const PARTNERS_KEY = 'smh_admin_partners_v1'

/**
 * @typedef {{ id: string, name: string, email: string, phone: string, status: 'Active'|'Inactive'|'Suspended', notes: string, rating: string, partnerId?: string }} AdminDriverRecord
 */

/**
 * @typedef {{ id: string, companyName: string, contactPerson: string, email: string, phone: string, vehicles: string, notes: string, status: 'Active'|'Inactive'|'Suspended', payoutNotes: string }} AdminPartnerRecord
 */

function readJson(key, fallback) {
  if (typeof sessionStorage === 'undefined') return fallback
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return fallback
    const p = JSON.parse(raw)
    return Array.isArray(p) ? p : fallback
  } catch {
    return fallback
  }
}

function writeJson(key, data) {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(key, JSON.stringify(data))
  } catch {
    /* quota */
  }
}

/** @returns {AdminDriverRecord[]} */
export function loadAdminDrivers() {
  return readJson(DRIVERS_KEY, [])
}

/** @param {AdminDriverRecord[]} list */
export function saveAdminDrivers(list) {
  writeJson(DRIVERS_KEY, list)
}

/** @returns {AdminPartnerRecord[]} */
export function loadAdminPartners() {
  return readJson(PARTNERS_KEY, [])
}

/** @param {AdminPartnerRecord[]} list */
export function saveAdminPartners(list) {
  writeJson(PARTNERS_KEY, list)
}

/** @param {string} name */
export function findAdminDriverByNormalizedName(name) {
  const t = String(name || '').trim().toLowerCase()
  if (!t) return null
  return loadAdminDrivers().find((d) => String(d.name || '').trim().toLowerCase() === t) ?? null
}

/** @param {string} companyName */
export function findAdminPartnerByNormalizedCompany(companyName) {
  const t = String(companyName || '').trim().toLowerCase()
  if (!t) return null
  return loadAdminPartners().find((p) => String(p.companyName || '').trim().toLowerCase() === t) ?? null
}
