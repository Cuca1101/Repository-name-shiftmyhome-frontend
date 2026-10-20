import { buildQuoteRowFromTemplateParams } from './data/quotesRepository'
import { getCustomerLeadCache } from './customerLeadTracker'
import { getWebsiteLeadSessionId } from './websiteLeadSession'
import {
  buildCustomerOfferIdentity,
  hashCustomerOfferIdentity,
  offerNeedsNewReview,
} from './customerOfferSnapshot'
import { isSupabaseConfigured, supabase } from './supabase'

const FN = 'customer-offer'
const MEMORY_KEY = 'smh_customer_offer_v1'

function supabaseFunctionsUrl() {
  const base = String(import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '')
  return base ? `${base}/functions/v1/${FN}` : ''
}

function anonKey() {
  return String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim().replace(/^["']|["']$/g, '')
}

function readMemory() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(MEMORY_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeMemory(offer, hash) {
  if (typeof window === 'undefined' || !offer) return
  const payable = Boolean(offer.payable)
  window.localStorage.setItem(
    MEMORY_KEY,
    JSON.stringify({
      token: offer.view_token || offer.token || readMemory()?.token || '',
      hash,
      status: offer.status || '',
      payable,
      agreedAmount: offer.agreed_amount ?? null,
      proposedAmount: offer.proposed_amount ?? null,
      originalTotal: offer.original_total ?? null,
    }),
  )
}

export function rememberedCustomerOffer() {
  return readMemory()
}

async function callCustomerOffer(body, { admin = false } = {}) {
  const url = supabaseFunctionsUrl()
  if (!url) throw new Error('Supabase is not configured.')
  const key = anonKey()
  const headers = { 'Content-Type': 'application/json', apikey: key }
  if (admin) {
    if (!isSupabaseConfigured || !supabase) throw new Error('Supabase is not configured.')
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    if (!token) throw new Error('Admin sign-in required or session expired.')
    headers.Authorization = `Bearer ${token}`
  } else if (key.startsWith('eyJ')) {
    headers.Authorization = `Bearer ${key}`
  }
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.ok === false) {
    throw new Error(json?.message || 'Something went wrong. Please try again.')
  }
  return json
}

export async function submitCustomerOffer({
  wizard,
  breakdown,
  totalM3,
  quoteRef,
  payload,
  proposedAmount,
  message,
  dateFlexibility,
  customerName,
  customerPhone,
  customerEmail,
  summary,
}) {
  const identity = buildCustomerOfferIdentity({ wizard, breakdown, totalM3 })
  const hash = await hashCustomerOfferIdentity(identity)
  const quoteLead = buildQuoteRowFromTemplateParams(payload.templateParams, payload.extras)
  const lead = getCustomerLeadCache()
  const result = await callCustomerOffer({
    action: 'submit',
    original_total: breakdown?.estimatedTotal,
    proposed_amount: proposedAmount,
    snapshot_hash: hash,
    identity,
    summary,
    quote_lead: quoteLead,
    quote_ref: quoteRef,
    lead_id: lead?.id || '',
    session_id: getWebsiteLeadSessionId(),
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_email: customerEmail,
    message,
    date_flexibility: dateFlexibility,
  })
  const offer = result.offer || {}
  writeMemory({ ...offer, view_token: result.token }, hash)
  return { ...result, hash }
}

export async function fetchCustomerOffer(token) {
  const result = await callCustomerOffer({ action: 'view', token })
  return result.offer
}

export async function respondToCounteroffer(token, accept) {
  const result = await callCustomerOffer({
    action: accept ? 'accept_counter' : 'decline_counter',
    token,
  })
  return result.offer
}

export async function adminDecideOffer(action, offerId, extra = {}) {
  return callCustomerOffer({ action, offer_id: offerId, ...extra }, { admin: true })
}

/**
 * Compare the live quote with the offer remembered in this browser.
 * A different move, package, or total must not keep the negotiated price.
 */
export async function matchRememberedCustomerOffer({ wizard, breakdown, totalM3 }) {
  const saved = readMemory()
  if (!saved?.token || !saved.hash || !breakdown) return null
  const identity = buildCustomerOfferIdentity({ wizard, breakdown, totalM3 })
  const hash = await hashCustomerOfferIdentity(identity)
  if (offerNeedsNewReview(hash, saved.hash)) {
    return { ...saved, stale: true, payable: false }
  }
  try {
    const offer = await fetchCustomerOffer(saved.token)
    const next = {
      ...saved,
      ...offer,
      token: saved.token,
      hash,
      stale: false,
    }
    writeMemory({ ...next, view_token: saved.token }, hash)
    return next
  } catch {
    return { ...saved, hash, stale: false }
  }
}

export function payableOfferAmount(offer) {
  if (!offer || offer.stale || !offer.payable) return null
  const amount = Number(offer.agreed_amount)
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null
}
