import { isSupabaseConfigured, supabase } from './supabase'

const SITE =
  (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : import.meta.env.VITE_SITE_URL || 'https://www.shiftmyhome.co.uk'
  ).replace(/\/$/, '')

/**
 * @param {string} resumeToken
 */
export function buildResumeQuoteUrl(resumeToken) {
  return `${SITE}/quote/resume/${resumeToken}`
}

/**
 * @param {string} resumeToken
 */
export function buildPayQuoteUrl(resumeToken) {
  return `${SITE}/quote/pay/${resumeToken}`
}

/**
 * @param {string} leadId
 */
export async function ensureLeadResumeToken(leadId) {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.rpc('ensure_customer_lead_resume_token', {
    p_lead_id: leadId,
  })
  if (error) throw new Error(error.message || 'Could not create resume token')
  return String(data)
}

/**
 * @param {string} leadId
 * @param {{ kind?: string, force?: boolean }} [opts]
 */
export async function sendCustomerLeadRecoveryEmail(leadId, opts = {}) {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.functions.invoke('process-quote-recovery', {
    body: { lead_id: leadId, kind: opts.kind, force: opts.force !== false },
  })
  if (error) throw new Error(error.message || 'Failed to send recovery email')
  if (data && data.ok === false) throw new Error(data.error || 'Failed to send recovery email')
  return data
}

/**
 * @param {string} leadId
 * @returns {Promise<{ url: string, amount: number | null, agreed_price: number | null, calculated_total: number | null }>}
 */
export async function createLeadRecoveryCheckoutUrl(leadId) {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase.functions.invoke('create-recovery-checkout', {
    body: { lead_id: leadId },
  })
  if (error) throw new Error(error.message || 'Failed to create payment link')
  if (!data?.url) throw new Error(data?.error || 'No payment URL returned')
  return {
    url: String(data.url),
    amount: data.amount != null ? Number(data.amount) : null,
    agreed_price: data.agreed_price != null ? Number(data.agreed_price) : null,
    calculated_total: data.calculated_total != null ? Number(data.calculated_total) : null,
  }
}

/**
 * @param {string} text
 */
export async function copyTextToClipboard(text) {
  const value = String(text || '')
  if (!value) throw new Error('Nothing to copy')
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }
  const ta = document.createElement('textarea')
  ta.value = value
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  document.body.removeChild(ta)
}
