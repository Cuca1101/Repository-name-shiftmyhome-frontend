import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { Webhook } from 'npm:standardwebhooks@1.0.0'
import { resendApiKey, sendResendEmail } from '../_shared/resendClient.ts'

/**
 * Supabase Auth Send Email Hook.
 * Replaces the built-in mailer (no SMTP was configured, and that mailer
 * allows only a couple of messages per hour). Uses the same Resend account
 * as invoices and booking emails.
 */

type EmailData = {
  token?: string
  token_hash?: string
  redirect_to?: string
  email_action_type?: string
  site_url?: string
  token_new?: string
  token_hash_new?: string
}

type HookPayload = {
  user?: { email?: string; new_email?: string }
  email_data?: EmailData
}

function hookSecret(): string {
  const raw = (Deno.env.get('SEND_EMAIL_HOOK_SECRET') || '').trim()
  return raw.replace(/^v1,whsec_/, '')
}

function failure(message: string, status = 500): Response {
  console.error('[send-auth-email]', message)
  return new Response(JSON.stringify({ error: { http_code: status, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function actionCopy(action: string): { subject: string; intro: string } {
  switch (action) {
    case 'recovery':
      return {
        subject: 'Reset your ShiftMyHome password',
        intro: 'Use the link below to choose a new password. It expires after a short time.',
      }
    case 'signup':
      return {
        subject: 'Confirm your ShiftMyHome email',
        intro: 'Confirm your email address to finish creating the account.',
      }
    case 'invite':
      return {
        subject: 'You are invited to ShiftMyHome',
        intro: 'Accept the invitation to set up your account.',
      }
    case 'magiclink':
      return {
        subject: 'Your ShiftMyHome sign-in link',
        intro: 'Use this link to sign in.',
      }
    case 'email_change':
      return {
        subject: 'Confirm your new ShiftMyHome email',
        intro: 'Confirm this change of email address.',
      }
    default:
      return {
        subject: 'ShiftMyHome account message',
        intro: 'Use the link below to continue.',
      }
  }
}

function confirmationUrl(data: EmailData): string {
  const base = (Deno.env.get('SUPABASE_URL') || 'https://msjhkfdqogymkartariq.supabase.co').replace(/\/$/, '')
  const token = String(data.token_hash || '').trim()
  const type = String(data.email_action_type || '').trim()
  const redirect = String(data.redirect_to || 'https://www.shiftmyhome.co.uk/driver/reset-password').trim()
  const params = new URLSearchParams({ token, type, redirect_to: redirect })
  return `${base}/auth/v1/verify?${params.toString()}`
}

async function providerEvent(apiKey: string, resendId: string): Promise<string> {
  const started = Date.now()
  let last = ''
  while (Date.now() - started < 8000) {
    const res = await fetch(`https://api.resend.com/emails/${resendId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const body = await res.json().catch(() => ({})) as { last_event?: string }
    last = String(body.last_event || '')
    if (last === 'delivered' || last === 'bounced' || last === 'failed' || last === 'complained' || last === 'suppressed') {
      return last
    }
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  return last || 'accepted'
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return failure('Method not allowed', 405)

  const secret = hookSecret()
  if (!secret) return failure('Password reset email is not configured.')

  const payload = await req.text()
  const headers = Object.fromEntries(req.headers)
  let verified: HookPayload
  try {
    verified = new Webhook(secret).verify(payload, headers) as HookPayload
  } catch (e) {
    console.error('[send-auth-email] signature', e instanceof Error ? e.message : String(e))
    return failure('Password reset email could not be verified.', 401)
  }

  const action = String(verified.email_data?.email_action_type || '').trim()
  const recipient = String(
    action === 'email_change'
      ? (verified.user?.new_email || verified.user?.email)
      : verified.user?.email,
  ).trim()
  if (!recipient || !verified.email_data?.token_hash) {
    return failure('Password reset email is missing a recipient.')
  }

  const copy = actionCopy(action)
  const link = confirmationUrl(verified.email_data)
  const html = `<p>${copy.intro}</p><p><a href="${link}">Continue</a></p><p>If you did not ask for this, you can ignore this email.</p>`
  const text = `${copy.intro}\n\n${link}\n\nIf you did not ask for this, you can ignore this email.`

  const sent = await sendResendEmail({
    to: recipient,
    subject: copy.subject,
    html,
    text,
    logTag: 'send-auth-email',
  })
  if (!sent.ok || !sent.resendId) {
    return failure(sent.error || 'The reset email was rejected by the mail provider.')
  }

  const event = await providerEvent(resendApiKey(), sent.resendId)
  console.log('[send-auth-email] provider', { action, resendId: sent.resendId, event })
  if (event === 'bounced' || event === 'failed' || event === 'complained' || event === 'suppressed') {
    return failure(`The reset email was ${event} by the mail provider.`)
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
