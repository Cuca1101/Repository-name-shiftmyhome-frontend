/**
 * Sync quote wizard / homepage form progress to customer_leads (parallel to website_leads).
 */
import { buildCustomerLeadUpsertPayload, buildHomePageCustomerLeadPayload } from './customerLeadCapture'
import { upsertCustomerLead, linkCustomerLeadToBooking } from './data/customerLeadsRepository'
import { getWebsiteLeadSessionId } from './websiteLeadSession'

const CACHE_KEY = 'shiftmyhome_customer_lead_cache_v1'

/**
 * @returns {{ leadRef?: string, id?: string } | null}
 */
export function getCustomerLeadCache() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

/**
 * @param {{ leadRef?: string, id?: string }} data
 */
export function setCustomerLeadCache(data) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        leadRef: data.leadRef || null,
        id: data.id || null,
      }),
    )
  } catch {
    /* ignore quota */
  }
}

/**
 * @param {{
 *   step: number,
 *   quoteRef: string,
 *   serviceType: string,
 *   wizard: Record<string, unknown>,
 *   estimatedTotal?: number | null,
 *   totalM3?: number | null,
 *   landingPath?: string,
 *   currentStatus?: string,
 *   paymentPhase?: 'none' | 'started' | 'converted',
 *   quoteId?: string | null,
 * }} opts
 */
export async function syncCustomerLeadFromWizard(opts) {
  if (typeof window === 'undefined') return null
  const landingPath =
    opts.landingPath ||
    (typeof window !== 'undefined' ? window.location.pathname || '/quote' : '/quote')
  const sourceUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${landingPath}${window.location.search || ''}`
      : landingPath

  const payload = buildCustomerLeadUpsertPayload({
    step: opts.step,
    quoteRef: opts.quoteRef,
    serviceType: opts.serviceType,
    wizard: opts.wizard,
    sourcePageUrl: sourceUrl,
    entryPoint: 'quote_wizard',
    estimatedTotal: opts.estimatedTotal ?? null,
    totalM3: opts.totalM3 ?? null,
    quoteId: opts.quoteId ?? null,
    currentStatus: opts.currentStatus || 'new_lead',
    paymentPhase: opts.paymentPhase || 'none',
  })

  const result = await upsertCustomerLead(payload, getWebsiteLeadSessionId())
  if (result?.lead_ref) {
    setCustomerLeadCache({ leadRef: result.lead_ref, id: result.id })
  }
  return result
}

/**
 * @param {{
 *   name: string,
 *   email: string,
 *   phone: string,
 *   service: string,
 *   pickup: string,
 *   delivery: string,
 *   move_date: string,
 *   details: string,
 *   quote_ref: string,
 * }} form
 */
export async function syncCustomerLeadFromHomePageForm(form) {
  if (typeof window === 'undefined') return null
  const source_page_url =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname || '/'}`
      : '/'

  const payload = buildHomePageCustomerLeadPayload({
    ...form,
    source_page_url,
  })

  const result = await upsertCustomerLead(payload, getWebsiteLeadSessionId())
  if (result?.lead_ref) {
    setCustomerLeadCache({ leadRef: result.lead_ref, id: result.id })
  }
  return result
}

/**
 * @param {{ quoteRef: string, quoteId?: string | null }} params
 */
export async function markCustomerLeadBookingComplete(params) {
  const ref = String(params?.quoteRef || '').trim()
  if (!ref) return null

  const viaSession = await upsertCustomerLead(
    {
      quote_ref: ref,
      quote_id: params.quoteId ? String(params.quoteId) : null,
      status: 'converted_to_booking',
    },
    getWebsiteLeadSessionId(),
  )

  if (viaSession?.status === 'converted_to_booking') return viaSession
  return linkCustomerLeadToBooking({
    quoteRef: ref,
    quoteId: params.quoteId ?? null,
  })
}

/**
 * @param {{ quoteRef: string, step?: number, serviceType?: string, wizard?: Record<string, unknown>, estimatedTotal?: number }} params
 */
export async function markCustomerLeadPaymentStarted(params) {
  return syncCustomerLeadFromWizard({
    step: params.step ?? 4,
    quoteRef: params.quoteRef,
    serviceType: params.serviceType || '',
    wizard: params.wizard || {},
    estimatedTotal: params.estimatedTotal ?? null,
    paymentPhase: 'started',
    currentStatus: 'payment_started',
  })
}
