import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { customerFirstName, siteBaseUrl } from '../_shared/jobCustomerNotify.ts'
import { sendPortalEmailChangeEmail, sendPortalRecoveryEmail, sendPortalSignInEmail } from '../_shared/customerPortalMagicLink.ts'
import { customerOwnsBooking, normalizeEmail, portalSiteOrigin, safePortalNext } from '../_shared/portalAuthPolicy.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GENERIC = {
  ok: true,
  message: 'If this email has a ShiftMyHome booking, we have sent a sign-in link. It expires automatically.',
}

const RECOVERY = {
  ok: true,
  message: 'If an account exists for this email, we have sent a password reset link. It expires automatically.',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!supabaseUrl || !serviceKey) return jsonResponse({ ok: false, error: 'Server misconfigured' }, 500)

  const supabase = createClient(supabaseUrl, serviceKey)
  const body = await req.json().catch(() => ({}))
  const rawPurpose = String(body?.purpose || 'sign-in')
  if (rawPurpose === 'confirm-email' || rawPurpose === 'email-change') {
    return handleProfileEmail(req, supabase, body, rawPurpose, supabaseUrl)
  }
  const email = normalizeEmail(body?.email)
  if (!email || !email.includes('@')) {
    return jsonResponse({ ok: false, error: 'Enter the email address used on your booking.' }, 400)
  }

  const purpose = rawPurpose === 'recovery' ? 'recovery' : 'sign-in'
  const generic = purpose === 'recovery' ? RECOVERY : GENERIC
  const unavailable = purpose === 'recovery'
    ? 'Password reset is temporarily unavailable. Try again in a minute.'
    : 'Sign-in email is temporarily unavailable. Try again in a minute.'
  const claimName = purpose === 'recovery' ? 'customer_portal_claim_recovery_send' : 'customer_portal_claim_link_send'
  const { data: claimed, error: claimError } = await supabase.rpc(claimName, {
    p_email: email,
  })
  if (claimError) {
    console.error('[customer-portal-link] claim', claimError.message)
    return jsonResponse({ ok: false, error: unavailable }, 500)
  }
  if (!claimed) {
    return jsonResponse({
      ok: false,
      error: 'Please wait a minute before requesting another email.',
    }, 429)
  }

  const { data: quotes, error: quoteError } = await supabase.rpc('customer_portal_booking_ids_for_email', { p_email: email })
  if (quoteError) {
    console.error('[customer-portal-link] bookings', quoteError.message)
    return jsonResponse({ ok: false, error: unavailable }, 500)
  }
  const owned = (quotes || []).filter((row) => customerOwnsBooking(email, row.email))
  if (!owned.length) return jsonResponse(generic)

  const { data: emailKind, error: kindError } = await supabase.rpc('account_email_kind', { p_email: email })
  if (kindError) {
    console.error('[customer-portal-link] role', kindError.message)
    return jsonResponse({ ok: false, error: unavailable }, 500)
  }
  if (emailKind === 'admin' || emailKind === 'driver') {
    return jsonResponse({
      ok: false,
      error: emailKind === 'driver'
        ? 'This email is a driver login. Use the driver app. The driver session was left as it is.'
        : 'This email is an admin login. Use Admin, or open a customer from Admin → Customers. The admin session was left as it is.',
    }, 403)
  }

  const siteOrigin = portalSiteOrigin(req, siteBaseUrl())
  if (purpose === 'recovery') {
    const sent = await sendPortalRecoveryEmail({ supabase, email, siteOrigin })
    if (!sent.ok) {
      console.error('[customer-portal-link] recovery send failed', sent.error)
      return jsonResponse({
        ok: false,
        error: 'The password reset email could not be sent. Try again in a minute.',
      }, 502)
    }
    return jsonResponse(generic)
  }

  const requestedId = String(body?.quote_id || '').trim()
  const match = owned.find((row) => String(row.id) === requestedId) || null
  const next = safePortalNext(match ? `/portal/bookings/${match.id}` : '/portal/bookings')
  const sent = await sendPortalSignInEmail({
    supabase,
    email,
    nextPath: next,
    quoteRef: match?.quote_ref || '',
    firstName: customerFirstName(match?.full_name || owned[0]?.full_name),
    siteOrigin,
  })
  if (!sent.ok) {
    console.error('[customer-portal-link] send failed', sent.error)
    return jsonResponse({
      ok: false,
      error: 'The login email could not be sent. Try again in a minute.',
    }, 502)
  }
  return jsonResponse(GENERIC)
})

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, '0')).join('')
}

async function handleProfileEmail(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  purpose: string,
  supabaseUrl: string,
) {
  if (purpose === 'confirm-email') {
    const token = String(body?.token || '').trim()
    if (token.length < 20) {
      return jsonResponse({ ok: false, error: 'This confirmation link is invalid or has expired. The current email is unchanged.' }, 400)
    }
    const applied = await supabase.rpc('customer_apply_email_change', { p_token_hash: await sha256(token) })
    if (applied.error) {
      console.error('[customer-portal-link] confirm', applied.error.message)
      return jsonResponse({ ok: false, error: 'The email could not be confirmed. The current email is unchanged.' }, 500)
    }
    const result = applied.data as { ok?: boolean; error?: string; auth_user_id?: string; new_email?: string; old_email?: string; customer_id?: string }
    if (!result?.ok) return jsonResponse({ ok: false, error: result?.error || 'The current email is unchanged.' }, 400)
    if (result.auth_user_id && result.new_email) {
      const updated = await supabase.auth.admin.updateUserById(result.auth_user_id, {
        email: result.new_email,
        email_confirm: true,
      })
      if (updated.error) {
        console.error('[customer-portal-link] auth email', updated.error.message)
        await supabase.rpc('customer_revert_email_change', {
          p_customer_id: result.customer_id,
          p_old_email: result.old_email,
          p_pending_email: result.new_email,
        })
        return jsonResponse({
          ok: false,
          error: 'This email already belongs to another ShiftMyHome account. The accounts were not combined.',
        }, 409)
      }
    }
    return jsonResponse({ ok: true, email: result.new_email })
  }

  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
  const header = req.headers.get('Authorization') || ''
  const jwt = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!anonKey || !jwt) return jsonResponse({ ok: false, error: 'Sign in to continue.' }, 401)
  const { data: userData, error: userError } = await supabase.auth.getUser(jwt)
  if (userError || !userData.user) return jsonResponse({ ok: false, error: 'Sign in to continue.' }, 401)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const kindResult = await userClient.rpc('account_session_kind')
  const role = String(userData.user.app_metadata?.role || userData.user.user_metadata?.role || '').toLowerCase()
  const kind = !kindResult.error && typeof kindResult.data === 'string'
    ? kindResult.data
    : (role === 'admin' ? 'admin' : role === 'driver' ? 'driver' : 'customer')
  if (kind === 'driver' || kind === 'none') {
    return jsonResponse({ ok: false, error: 'Sign in with the customer account.' }, 403)
  }

  const nextEmail = normalizeEmail(body?.new_email)
  if (!nextEmail || !nextEmail.includes('@')) {
    return jsonResponse({ ok: false, error: 'Enter a valid email address.' }, 400)
  }
  let customerId = ''
  if (kind === 'admin') {
    customerId = String(body?.admin_customer_id || '').trim()
    if (!customerId) return jsonResponse({ ok: false, error: 'Open this customer from Admin → Customers.' }, 403)
  } else {
    const { data: own } = await supabase
      .from('customers')
      .select('id')
      .eq('email', normalizeEmail(userData.user.email))
      .maybeSingle()
    customerId = String(own?.id || '')
    if (!customerId) return jsonResponse({ ok: false, error: 'Customer profile not found.' }, 404)
  }

  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll('-', '')
  const started = await supabase.rpc('customer_begin_email_change', {
    p_customer_id: customerId,
    p_new_email: nextEmail,
    p_token_hash: await sha256(token),
  })
  if (started.error) {
    console.error('[customer-portal-link] email change', started.error.message)
    return jsonResponse({ ok: false, error: 'The confirmation email could not be sent. The current email is unchanged.' }, 500)
  }
  const startedBody = started.data as { ok?: boolean; error?: string }
  if (!startedBody?.ok) return jsonResponse({ ok: false, error: startedBody?.error || 'The current email is unchanged.' }, 400)

  const origin = portalSiteOrigin(req, siteBaseUrl())
  const url = `${origin}/portal/confirm-email?token=${encodeURIComponent(token)}`
  const sent = await sendPortalEmailChangeEmail({ to: nextEmail, url })
  if (!sent.ok) {
    await supabase.rpc('customer_revert_email_change', {
      p_customer_id: customerId,
      p_old_email: (started.data as { current_email?: string }).current_email,
      p_pending_email: '',
    })
    return jsonResponse({ ok: false, error: 'The confirmation email could not be sent. The current email is unchanged.' }, 502)
  }
  return jsonResponse({
    ok: true,
    pending_email: nextEmail,
    message: 'Pending verification. The current email stays in place until the new address is confirmed.',
  })
}
