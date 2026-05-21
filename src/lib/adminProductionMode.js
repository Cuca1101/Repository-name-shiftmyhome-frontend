/**
 * Production admin UI: hide demo/test labels and dev-only tooling by default.
 * Set VITE_SHOW_DEMO_ADMIN_UI=true in .env to restore demo helpers locally.
 */

/** @returns {boolean} */
export function isProductionAdmin() {
  if (import.meta.env.VITE_SHOW_DEMO_ADMIN_UI === 'true') return false
  return import.meta.env.PROD === true
}

/** Show demo badges, legacy test cancel helpers, etc. */
export function showDemoAdminUi() {
  return import.meta.env.VITE_SHOW_DEMO_ADMIN_UI === 'true'
}

/** Hide archived/test/demo rows in admin lists unless demo UI is enabled. */
export function shouldApplyProductionAdminFilters() {
  return import.meta.env.VITE_SHOW_DEMO_ADMIN_UI !== 'true'
}
