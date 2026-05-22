import { isSupabaseConfigured, supabase } from '../supabase'
import { isSupabasePublicConfigured, supabasePublic } from '../supabasePublicClient'

const QUOTES_TABLE = 'quotes'

/** Homepage contact section — matches admin filter & reporting */
export const HOME_PAGE_QUOTE_SOURCE = 'home_page_quote_form'

/** Sources shown in Admin → Quote Requests (public lead forms only). */
export const PUBLIC_QUOTE_REQUEST_SOURCES = [
  HOME_PAGE_QUOTE_SOURCE,
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
