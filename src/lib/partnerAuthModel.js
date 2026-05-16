/**
 * Partner auth / persistence model (Supabase `public.partners`).
 * Admin UI may still mirror partners in sessionStorage (`adminFleetLocalStore`) until the admin Partners screen is wired to this table.
 * When syncing legacy session rows: map status `Active` → `active`; `Inactive` or `Suspended` → `inactive`.
 *
 * Login: email is the username; link `auth_user_id` to `auth.users.id` after sign-up or invite flow.
 * Jobs: `quotes.assigned_partner_id` should eventually store `partners.id` so partner sessions can query:
 *   `select * from quotes where assigned_partner_id = :my_partner_row_id` under RLS.
 *
 * @typedef {'active' | 'inactive'} PartnerAccountStatus
 */

/** @type {PartnerAccountStatus} */
export const PARTNER_STATUS_ACTIVE = 'active'

/** @type {PartnerAccountStatus} */
export const PARTNER_STATUS_INACTIVE = 'inactive'

/**
 * Row shape for `public.partners` (snake_case columns as returned by PostgREST).
 *
 * @typedef {{
 *   id: string,
 *   auth_user_id: string | null,
 *   email: string,
 *   company_name: string,
 *   contact_name: string,
 *   phone: string,
 *   status: PartnerAccountStatus,
 *   created_at: string,
 *   updated_at: string,
 * }} PartnerAuthRow
 */

/**
 * Normalize email for storage or lookup (username).
 * @param {string} email
 * @returns {string}
 */
export function normalizePartnerEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase()
}
