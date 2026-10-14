import { supabase, isSupabaseConfigured } from './supabase'

const FN = 'phone-quote'

const ERROR_MESSAGES = {
  not_found: 'This quote link is not valid. Please contact ShiftMyHome.',
  already_paid: 'This quote has already been paid.',
  quote_closed: 'This booking is no longer open for payment. Please contact ShiftMyHome.',
  no_price: 'This quote has no price yet. Please contact ShiftMyHome.',
  missing_customer_email: 'Add a customer email address before sending the quote.',
  email_failed: 'The email could not be sent. Try again in a moment.',
  unauthorized: 'Admin sign-in required or session expired.',
  forbidden: 'You do not have permission for this action.',
}

function supabaseFunctionsUrl() {
  const base = String(import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '')
  return base ? `${base}/functions/v1/${FN}` : ''
}

function anonKey() {
  return String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim().replace(/^["']|["']$/g, '')
}

/**
 * @param {Record<string, unknown>} body
 * @param {{ admin?: boolean }} [opts]
 * @returns {Promise<Record<string, any>>}
 */
async function callPhoneQuote(body, { admin = false } = {}) {
  const url = supabaseFunctionsUrl()
  if (!url) throw new Error('Supabase is not configured.')
  const key = anonKey()
  /** @type {Record<string, string>} */
  const headers = { 'Content-Type': 'application/json', apikey: key }
  if (admin) {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase is not configured.')
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    if (!token) throw new Error(ERROR_MESSAGES.unauthorized)
    headers.Authorization = `Bearer ${token}`
  } else if (key.startsWith('eyJ')) {
    headers.Authorization = `Bearer ${key}`
  }
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.ok === false) {
    const code = String(json?.error || `http_${res.status}`)
    const err = new Error(json?.message || ERROR_MESSAGES[code] || 'Something went wrong. Please try again.')
    err.code = code
    err.payload = json
    throw err
  }
  return json
}

/** @param {string} token */
export async function fetchPhoneQuoteView(token) {
  const res = await callPhoneQuote({ action: 'view', token })
  return res.quote
}

/**
 * Server re-checks the 48h rule before creating the PaymentIntent.
 * @param {string} token
 * @param {'deposit' | 'full'} paymentType
 */
export async function createPhoneQuotePayment(token, paymentType) {
  return callPhoneQuote({ action: 'create_payment', token, payment_type: paymentType })
}

/** Builds the email without sending it. @param {string} quoteId */
export async function previewPhoneQuoteEmail(quoteId) {
  return callPhoneQuote({ action: 'preview', quoteId }, { admin: true })
}

/** @param {string} quoteId */
export async function sendPhoneQuoteEmail(quoteId) {
  return callPhoneQuote({ action: 'send', quoteId }, { admin: true })
}
