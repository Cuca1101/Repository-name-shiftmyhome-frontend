import { isSupabaseConfigured, supabase } from '../supabase'
import { isSupabasePublicConfigured, supabasePublic } from '../supabasePublicClient'

const QUOTES_TABLE = 'quotes'

/** Homepage contact section — matches admin filter & reporting */
export const HOME_PAGE_QUOTE_SOURCE = 'home_page_quote_form'

/** Admin → New phone booking (staff-created while customer is on the phone). */
export const ADMIN_PHONE_BOOKING_SOURCE = 'admin_phone_booking'

/** Sources shown in Admin → Quote Requests (public + admin phone leads). */
export const PUBLIC_QUOTE_REQUEST_SOURCES = [
  HOME_PAGE_QUOTE_SOURCE,
  ADMIN_PHONE_BOOKING_SOURCE,
  'website',
  'public_quote_request',
  'quote_request',
]

/**
 * @returns {string} SMH-YYYY-XXXXXX (6 digits)
 */
export function generateQuoteRef() {
  const y = new Date().getFullYear()
  const n = Math.floor(100000 + Math.random() * 900000)
  return `SMH-${y}-${n}`
}

/**
 * Insert lead from the Home Page simple quote form (anon RLS).
 *
 * @param {{
 *   name: string,
 *   email: string,
 *   phone: string,
 *   service: string,
 *   pickup: string,
 *   delivery: string,
 *   move_date: string,
 *   details: string,
 *   quote_ref?: string,
 * }} form
 * @returns {Promise<{ id: string, quote_ref: string }>}
 */
export async function insertHomePageQuoteLead(form) {
  if (!isSupabasePublicConfigured || !supabasePublic) {
    throw new Error('Supabase is not configured (set VITE_SUPABASE_URL and key in .env).')
  }

  /** Always anon — main client may carry an admin session from the same browser tab. */
  const db = supabasePublic

  let quoteRef = (form.quote_ref || '').trim()
  if (!quoteRef) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = generateQuoteRef()
      const row = buildHomePageQuoteRow({ ...form, quote_ref: candidate })
      const { error } = await db.from(QUOTES_TABLE).insert(row)
      if (!error) {
        return { id: '', quote_ref: row.quote_ref }
      }
      if (error?.code === '23505') {
        continue
      }
      throw new Error(formatHomePageQuoteInsertError(error))
    }
    throw new Error('Could not allocate a unique quote reference. Please try again.')
  }

  const row = buildHomePageQuoteRow({ ...form, quote_ref: quoteRef })
  const { error } = await db.from(QUOTES_TABLE).insert(row)

  if (error) {
    if (error.code === '23505') {
      throw new Error(
        'This quote reference is already in use. Leave it blank to get a new one, or use the reference we emailed you.',
      )
    }
    throw new Error(formatHomePageQuoteInsertError(error))
  }
  return { id: '', quote_ref: row.quote_ref }
}

/**
 * @param {{ message?: string, code?: string }} error
 */
function formatHomePageQuoteInsertError(error) {
  const detail = error?.message || String(error)
  if (/row-level security/i.test(detail)) {
    return `Could not save your quote: ${detail}. If you are logged into Admin in this browser, refresh the page and try again in a private window, or ask your administrator to run migration 047_quotes_public_lead_insert_rls.sql.`
  }
  return `Could not save your quote: ${detail}.`
}

/**
 * @param {{ quote_ref: string } & Record<string, unknown>} form
 */
function buildHomePageQuoteRow(form) {
  const ref = String(form.quote_ref || '').trim()
  return {
    quote_ref: ref,
    full_name: (form.name || '').trim(),
    email: (form.email || '').trim(),
    phone: (form.phone || '').trim(),
    service: (form.service || '').trim() || null,
    service_type: (form.service || '').trim() || null,
    pickup_address: (form.pickup || '').trim(),
    delivery_address: (form.delivery || '').trim(),
    move_date: normalizeMoveDate(form.move_date),
    details: (form.details || '').trim() || null,
    source: HOME_PAGE_QUOTE_SOURCE,
    status: 'New',
    inventory: [],
    message: null,
  }
}

/**
 * @param {string|undefined} dateStr
 * @returns {string} YYYY-MM-DD
 */
function normalizeMoveDate(dateStr) {
  const t = (dateStr || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  return new Date().toISOString().slice(0, 10)
}

/**
 * Build a row for public.quotes from EmailJS templateParams + optional extras.
 *
 * @param {Record<string, string|undefined>} templateParams
 * @param {{ arrival_window?: string | null, distance_miles?: number | null, crew_size?: number | null, vehicle_size?: string | null }} [extras]
 */
/**
 * Prefer ISO from `move_date_iso` (EmailJS display uses UK `move_date`).
 * @param {Record<string, unknown>} p
 * @returns {string}
 */
function resolveIsoMoveDateFromParams(p) {
  const isoField = String(p.move_date_iso ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoField)) return isoField
  const fallback = String(p.move_date ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(fallback)) return fallback
  return normalizeMoveDate(fallback)
}

export function buildQuoteRowFromTemplateParams(templateParams, extras = {}) {
  const p = templateParams || {}
  const inv = p.inventory != null && String(p.inventory).trim() !== '' ? String(p.inventory) : null
  return {
    quote_ref: p.quote_ref?.trim() || null,
    full_name: (p.name || '').trim(),
    email: (p.email || '').trim(),
    phone: (p.phone || '').trim(),
    service: (p.service || '').trim() || null,
    service_type: (p.service || '').trim() || null,
    pickup_address: (p.pickup || '').trim(),
    delivery_address: (p.delivery || '').trim(),
    move_date: resolveIsoMoveDateFromParams(p),
    arrival_window: extras.arrival_window != null ? String(extras.arrival_window) : null,
    arrival_type: p.arrival_type != null && String(p.arrival_type).trim() !== '' ? String(p.arrival_type).trim() : null,
    arrival_time: p.arrival_time != null && String(p.arrival_time).trim() !== '' ? String(p.arrival_time).trim() : null,
    distance_miles:
      extras.distance_miles != null && !Number.isNaN(Number(extras.distance_miles))
        ? Number(extras.distance_miles)
        : null,
    crew_size:
      extras.crew_size != null && !Number.isNaN(Number(extras.crew_size))
        ? Number(extras.crew_size)
        : null,
    vehicle_size:
      extras.vehicle_size != null && String(extras.vehicle_size).trim() !== ''
        ? String(extras.vehicle_size).trim()
        : null,
    details: p.details != null ? String(p.details) : null,
    pricing: p.pricing != null ? String(p.pricing) : null,
    inventory_text: inv,
    inventory: inv ? [{ summary: inv }] : [],
    message: null,
    status: 'New',
  }
}

/**
 * Inserts lead into Supabase `quotes` (anon insert allowed by RLS).
 *
 * @param {Record<string, string|undefined>} templateParams
 * @param {{ arrival_window?: string | null, distance_miles?: number | null }} [extras]
 * @returns {Promise<{ id: string }|null>}
 */
/**
 * Row for Admin → New phone booking (authenticated insert).
 *
 * @param {{
 *   quote_ref?: string,
 *   name: string,
 *   email?: string,
 *   phone: string,
 *   service?: string,
 *   pickup: string,
 *   delivery: string,
 *   move_date: string,
 *   arrival_time?: string,
 *   details?: string,
 *   payment_mode?: 'quote_only' | 'deposit' | 'paid_full',
 *   amount_paid?: number | null,
 *   estimated_total?: number | null,
 *   created_by?: string,
 * }} form
 */
export function buildAdminPhoneBookingRow(form) {
  const ref = String(form.quote_ref || '').trim() || generateQuoteRef()
  const mode = form.payment_mode === 'deposit' || form.payment_mode === 'paid_full' ? form.payment_mode : 'quote_only'
  const now = new Date().toISOString()
  const amount =
    form.amount_paid != null && !Number.isNaN(Number(form.amount_paid))
      ? Number(form.amount_paid)
      : form.estimated_total != null && !Number.isNaN(Number(form.estimated_total))
        ? Number(form.estimated_total)
        : null

  let payment_status = 'unpaid'
  let status = 'New'
  let paid_at = null
  let payment_type = null
  let operational_status = null

  if (mode === 'paid_full') {
    payment_status = 'paid'
    status = 'Booked'
    payment_type = 'full'
    paid_at = now
    operational_status = 'Assigned'
  } else if (mode === 'deposit') {
    payment_status = 'deposit_paid'
    status = 'deposit_paid'
    payment_type = 'deposit'
    paid_at = now
    operational_status = 'Assigned'
  }

  const staffNote = form.created_by ? `Created by admin (${form.created_by})` : 'Created by admin (phone booking)'
  const customerDetails = (form.details || '').trim()
  const details = customerDetails ? `${staffNote}\n\n${customerDetails}` : staffNote

  return {
    quote_ref: ref,
    full_name: (form.name || '').trim(),
    email: (form.email || '').trim() || 'phone-booking@shiftmyhome.local',
    phone: (form.phone || '').trim(),
    service: (form.service || '').trim() || 'Phone booking',
    service_type: (form.service || '').trim() || 'Phone booking',
    pickup_address: (form.pickup || '').trim(),
    delivery_address: (form.delivery || '').trim(),
    move_date: normalizeMoveDate(form.move_date),
    arrival_time:
      form.arrival_time != null && String(form.arrival_time).trim() !== ''
        ? String(form.arrival_time).trim()
        : null,
    details,
    source: ADMIN_PHONE_BOOKING_SOURCE,
    status,
    payment_status,
    payment_type,
    amount_paid: amount,
    paid_at,
    operational_status,
    inventory: [],
    message: null,
  }
}

/**
 * Insert a phone booking from admin (authenticated session).
 *
 * @param {Parameters<typeof buildAdminPhoneBookingRow>[0]} form
 * @returns {Promise<{ id: string, quote_ref: string }>}
 */
export async function insertAdminPhoneBooking(form) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.')
  }

  const requestedRef = (form.quote_ref || '').trim()
  if (requestedRef) {
    const row = buildAdminPhoneBookingRow({ ...form, quote_ref: requestedRef })
    const { data, error } = await supabase.from(QUOTES_TABLE).insert(row).select('id, quote_ref').single()
    if (error) {
      if (error.code === '23505') {
        throw new Error('This quote reference is already in use. Leave it blank for a new one.')
      }
      throw new Error(error.message || 'Could not save booking.')
    }
    return { id: String(data.id), quote_ref: String(data.quote_ref) }
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const row = buildAdminPhoneBookingRow(form)
    const { data, error } = await supabase.from(QUOTES_TABLE).insert(row).select('id, quote_ref').single()
    if (!error && data?.id) {
      return { id: String(data.id), quote_ref: String(data.quote_ref) }
    }
    if (error?.code === '23505') {
      continue
    }
    throw new Error(error?.message || 'Could not save booking.')
  }
  throw new Error('Could not allocate a unique quote reference. Try again.')
}

export async function insertQuoteFromTemplateParams(templateParams, extras) {
  if (!isSupabaseConfigured || !supabase) {
    const msg = 'Supabase is not configured (set VITE_SUPABASE_URL and key in .env).'
    throw new Error(msg)
  }

  const row = buildQuoteRowFromTemplateParams(templateParams, extras)
  const { data, error } = await supabase.from(QUOTES_TABLE).insert(row).select('id').single()

  if (import.meta.env.DEV && error) {
    // eslint-disable-next-line no-console
    console.warn('[Supabase quotes insert]', { data, error })
  }

  if (error) {
    const detail = error.message || String(error)
    throw new Error(
      `Could not save your quote to the database: ${detail}. If columns are missing, run SQL migration 003_quotes_lead_fields.sql in the Supabase SQL editor.`,
    )
  }
  return data
}
