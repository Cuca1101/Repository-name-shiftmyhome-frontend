import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { siteBaseUrl } from './jobCustomerNotify.ts'
import { safePortalNext } from './portalAuthPolicy.ts'
import { sendResendEmail } from './resendClient.ts'

function esc(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * Supabase magic link that signs the customer in on any device.
 * Uses the hashed token so the link is not tied to the browser that requested it.
 */
export async function buildPortalMagicUrl(
  supabase: SupabaseClient,
  email: string,
  nextPath: string,
  siteOrigin = siteBaseUrl(),
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const to = String(email || '').trim().toLowerCase()
  if (!to || !to.includes('@')) return { ok: false, error: 'invalid_email' }
  const next = safePortalNext(nextPath)
  const origin = siteOrigin.replace(/\/$/, '')
  const redirectTo = `${origin}/portal/auth`

  const generated = await generateAuthLink(supabase, to, redirectTo, 'magiclink')
  if (!generated.ok) return generated

  const url = `${origin}/portal/auth?token_hash=${encodeURIComponent(generated.tokenHash)}&type=magiclink&next=${encodeURIComponent(next)}`
  return { ok: true, url }
}

/**
 * Recovery link for the same auth user as the magic link.
 * createUser is only used when no user exists, and it never sets a role.
 * The link always opens the public site, never the browser that requested it.
 */
const CUSTOMER_RESET_ORIGIN = 'https://www.shiftmyhome.co.uk'
const CUSTOMER_RESET_PATH = '/portal/reset-password'
const CUSTOMER_RESET_SUBJECT = 'Reset your ShiftMyHome password'
const CUSTOMER_LOGO_URL = `${CUSTOMER_RESET_ORIGIN}/logo.png`

export async function buildPortalRecoveryUrl(
  supabase: SupabaseClient,
  email: string,
  _siteOrigin = siteBaseUrl(),
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const to = String(email || '').trim().toLowerCase()
  if (!to || !to.includes('@')) return { ok: false, error: 'invalid_email' }
  const redirectTo = `${CUSTOMER_RESET_ORIGIN}${CUSTOMER_RESET_PATH}`
  const generated = await generateAuthLink(supabase, to, redirectTo, 'recovery')
  if (!generated.ok) return generated
  const url = `${redirectTo}?token_hash=${encodeURIComponent(generated.tokenHash)}&type=recovery`
  return { ok: true, url }
}

/** Same mailbox as other mail, with the customer-facing name ShiftMyHome. */
function customerRecoveryFrom(): string {
  const raw = (Deno.env.get('RESEND_FROM_EMAIL') || 'ShiftMyHome <bookings@shiftmyhome.co.uk>').trim()
  const match = raw.match(/<([^>]+)>/)
  const address = (match?.[1] || 'bookings@shiftmyhome.co.uk').trim()
  return `ShiftMyHome <${address}>`
}

async function generateAuthLink(
  supabase: SupabaseClient,
  email: string,
  redirectTo: string,
  type: 'magiclink' | 'recovery',
): Promise<{ ok: true; tokenHash: string } | { ok: false; error: string }> {
  const first = await supabase.auth.admin.generateLink({
    type,
    email,
    options: { redirectTo },
  })
  const firstHash = tokenHashFrom(first.data)
  if (firstHash) return { ok: true, tokenHash: firstHash }

  const message = String(first.error?.message || '')
  const missingUser = /not found|does not exist|user_not_found/i.test(message)
  if (message && !missingUser) return { ok: false, error: message }

  const created = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { account_kind: 'customer' },
  })
  if (created.error && !/already/i.test(created.error.message)) {
    return { ok: false, error: created.error.message || message || 'link_failed' }
  }

  const second = await supabase.auth.admin.generateLink({
    type,
    email,
    options: { redirectTo },
  })
  const secondHash = tokenHashFrom(second.data)
  if (!secondHash) return { ok: false, error: second.error?.message || message || 'link_failed' }
  return { ok: true, tokenHash: secondHash }
}

function tokenHashFrom(data: { properties?: { hashed_token?: string } } | null) {
  const hash = String(data?.properties?.hashed_token || '').trim()
  return hash || ''
}

export function portalSignInEmail(params: { url: string; quoteRef?: string; firstName?: string }) {
  const company = (Deno.env.get('COMPANY_NAME') || 'ShiftMyHome').trim()
  const ref = String(params.quoteRef || '').trim()
  const name = String(params.firstName || 'there').trim() || 'there'
  const subject = ref ? `View your booking ${ref}` : 'Your ShiftMyHome bookings'
  const intro = ref
    ? `Use the button below to open booking ${ref}. This link signs you in and expires automatically.`
    : 'Use the button below to open your ShiftMyHome bookings. This link signs you in and expires automatically.'
  const html = `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 12px;"><tr><td align="center">
  <table width="560" style="max-width:560px;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:14px;"><tr><td style="padding:28px 24px;">
    <p style="margin:0 0 8px;font-size:13px;font-weight:800;letter-spacing:-0.02em;color:#0f172a;">ShiftMy<span style="color:#2563eb;">Home</span></p>
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;">${esc(subject)}</h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#334155;">Hi ${esc(name)},</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#334155;">${esc(intro)}</p>
    <p style="margin:0 0 20px;"><a href="${esc(params.url)}" style="display:inline-block;background:#0284c7;color:#fff;text-decoration:none;font-weight:700;padding:14px 18px;border-radius:10px;">View my booking</a></p>
    <p style="margin:0;font-size:13px;line-height:1.5;color:#64748b;">If the button does not work, copy this link into your browser:<br>${esc(params.url)}</p>
    <p style="margin:16px 0 0;font-size:13px;color:#94a3b8;">${esc(company)}</p>
  </td></tr></table>
  </td></tr></table></body></html>`
  const text = `Hi ${name},\n\n${intro}\n\nView my booking: ${params.url}\n\n${company}`
  return { subject: `[${company}] ${subject}`, html, text }
}

export function portalRecoveryEmail(params: { url: string }) {
  const brand = 'ShiftMyHome'
  const subject = CUSTOMER_RESET_SUBJECT
  const html = `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 12px;"><tr><td align="center">
  <table width="560" style="max-width:560px;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:14px;"><tr><td style="padding:28px 24px;">
    <p style="margin:0 0 18px;"><img src="${esc(CUSTOMER_LOGO_URL)}" width="220" alt="ShiftMyHome" style="display:block;width:220px;max-width:100%;height:auto;border:0;" /></p>
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;">Choose a new password</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#334155;">This link expires automatically. You can still sign in with an email link afterwards. A password is optional.</p>
    <p style="margin:0 0 20px;"><a href="${esc(params.url)}" style="display:inline-block;background:#0284c7;color:#fff;text-decoration:none;font-weight:700;padding:14px 18px;border-radius:10px;">Choose a new password</a></p>
    <p style="margin:0;font-size:13px;line-height:1.5;color:#64748b;">If the button does not work, copy this link into your browser:<br><a href="${esc(params.url)}" style="color:#0369a1;word-break:break-all;">${esc(params.url)}</a></p>
    <p style="margin:16px 0 0;font-size:13px;color:#94a3b8;">${esc(brand)}</p>
  </td></tr></table>
  </td></tr></table></body></html>`
  const text = `Choose a new password. This link expires automatically.\n\n${params.url}\n\n${brand}`
  return { subject, html, text }
}

export async function sendPortalRecoveryEmail(params: { supabase: SupabaseClient; email: string; siteOrigin?: string }) {
  const link = await buildPortalRecoveryUrl(params.supabase, params.email)
  if (!link.ok) return link
  const rendered = portalRecoveryEmail({ url: link.url })
  const sent = await sendResendEmail({
    to: params.email,
    from: customerRecoveryFrom(),
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    logTag: 'customer-portal-recovery',
  })
  if (!sent.ok) return { ok: false as const, error: sent.error || 'email_failed' }
  return { ok: true as const, url: link.url }
}

export function portalEmailChangeEmail(params: { url: string }) {
  const company = (Deno.env.get('COMPANY_NAME') || 'ShiftMyHome').trim()
  const subject = 'Confirm your new ShiftMyHome email'
  const html = `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 12px;"><tr><td align="center">
  <table width="560" style="max-width:560px;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:14px;"><tr><td style="padding:28px 24px;">
    <p style="margin:0 0 8px;font-size:13px;font-weight:800;letter-spacing:-0.02em;color:#0f172a;">ShiftMy<span style="color:#2563eb;">Home</span></p>
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;">Confirm this email address</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#334155;">Your current sign-in email stays in place until you open this link. Your bookings, payments and feedback stay on the same account.</p>
    <p style="margin:0 0 20px;"><a href="${esc(params.url)}" style="display:inline-block;background:#0284c7;color:#fff;text-decoration:none;font-weight:700;padding:14px 18px;border-radius:10px;">Confirm email address</a></p>
    <p style="margin:0;font-size:13px;line-height:1.5;color:#64748b;">If the button does not work, copy this link into your browser:<br>${esc(params.url)}</p>
    <p style="margin:16px 0 0;font-size:13px;color:#94a3b8;">${esc(company)}</p>
  </td></tr></table>
  </td></tr></table></body></html>`
  const text = `Confirm this email address. Your current email stays in place until you open this link.\n\n${params.url}\n\n${company}`
  return { subject: `[${company}] ${subject}`, html, text }
}

export async function sendPortalEmailChangeEmail(params: { to: string; url: string }) {
  const rendered = portalEmailChangeEmail({ url: params.url })
  const sent = await sendResendEmail({
    to: params.to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    logTag: 'customer-portal-email-change',
  })
  if (!sent.ok) return { ok: false as const, error: sent.error || 'email_failed' }
  return { ok: true as const }
}

export async function sendPortalSignInEmail(params: {
  supabase: SupabaseClient
  email: string
  nextPath: string
  quoteRef?: string
  firstName?: string
  siteOrigin?: string
}) {
  const link = await buildPortalMagicUrl(params.supabase, params.email, params.nextPath, params.siteOrigin)
  if (!link.ok) return link
  const rendered = portalSignInEmail({ url: link.url, quoteRef: params.quoteRef, firstName: params.firstName })
  const sent = await sendResendEmail({
    to: params.email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    logTag: 'customer-portal-link',
  })
  if (!sent.ok) return { ok: false as const, error: sent.error || 'email_failed' }
  return { ok: true as const, url: link.url }
}
