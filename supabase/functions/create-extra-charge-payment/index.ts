import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { validateStripeSecretKey } from '../_shared/stripeMode.ts'
import { processExtraChargePayment } from '../_shared/extraChargePayment.ts'
import { assertAdminCaller } from '../_shared/verifyAdminCaller.ts'

/**
 * Creates Stripe checkout for extra charges (link for admin to share with customer).
 * Customer receives confirmation email with items + amount only after payment (stripe-webhook).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function callerMayProcessRequest(
  req: Request,
  supabaseUrl: string,
  serviceRole: string,
  anonKey: string,
  requestId: string,
  driverIdOnRequest: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) {
    return { ok: false, error: 'Authorization required' }
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData?.user) {
    return { ok: false, error: 'Admin sign-in required — sign in at /admin/login and retry.' }
  }

  const adminClient = createClient(supabaseUrl, serviceRole)
  const adminCheck = await assertAdminCaller(adminClient, userData.user)
  if (adminCheck.ok) {
    return { ok: true }
  }

  if (!driverIdOnRequest) {
    return { ok: false, error: adminCheck.message || 'Not allowed' }
  }

  const { data: driverRow } = await adminClient
    .from('drivers')
    .select('id')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle()

  if (!driverRow?.id || String(driverRow.id) !== String(driverIdOnRequest)) {
    return { ok: false, error: 'You can only create payment for your own extra charge requests.' }
  }

  return { ok: true }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
  const resendApiKey = (Deno.env.get('RESEND_API_KEY') || '').trim()
  const resendFrom = (Deno.env.get('RESEND_FROM_EMAIL') || 'ShiftMyHome <onboarding@resend.dev>').trim()
  const siteUrl = (Deno.env.get('SITE_URL') || 'https://www.shiftmyhome.co.uk').trim()

  const stripeKeyCheck = validateStripeSecretKey(stripeKey)
  if (!stripeKeyCheck.ok) {
    return jsonResponse({ error: stripeKeyCheck.error || 'Invalid STRIPE_SECRET_KEY' }, 500)
  }
  if (!supabaseUrl || !serviceRole) {
    return jsonResponse({ error: 'Server misconfigured' }, 500)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const request_id = String(body.request_id ?? '').trim()
  if (!request_id) {
    return jsonResponse({ error: 'request_id is required' }, 400)
  }

  const supabase = createClient(supabaseUrl, serviceRole)

  const { data: ecrPreview } = await supabase
    .from('extra_charge_requests')
    .select('driver_id')
    .eq('id', request_id)
    .maybeSingle()

  const auth = await callerMayProcessRequest(
    req,
    supabaseUrl,
    serviceRole,
    anonKey,
    request_id,
    ecrPreview?.driver_id != null ? String(ecrPreview.driver_id) : null,
  )
  if (!auth.ok) {
    return jsonResponse({ error: auth.error }, 403)
  }

  const result = await processExtraChargePayment({
    supabase,
    stripeKey: stripeKey!,
    siteUrl,
    requestId: request_id,
    body,
  })

  if (!result.ok) {
    return jsonResponse({ error: result.error || 'Payment failed' }, 400)
  }

  console.log('[create-extra-charge-payment]', {
    request_id,
    amount: result.approved_amount,
    has_link: Boolean(result.stripe_payment_link),
  })

  return jsonResponse(result)
})
