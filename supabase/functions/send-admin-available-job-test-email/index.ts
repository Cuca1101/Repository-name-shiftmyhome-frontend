import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendAdminAvailableJobTestEmail } from '../_shared/adminAvailableJobTestEmail.ts'

/**
 * Admin-only: send sample Available Jobs notification (no DB / Stripe changes).
 * Requires authenticated Supabase session (admin login).
 *
 * Secrets: RESEND_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return jsonResponse({ ok: false, error: 'unauthorized' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    if (!supabaseUrl || !anonKey) {
      return jsonResponse({ ok: false, error: 'server_misconfigured' }, 503)
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user?.id) {
      return jsonResponse({ ok: false, error: 'unauthorized' }, 401)
    }

    const userId = userData.user.id
    const result = await sendAdminAvailableJobTestEmail(userId)

    return jsonResponse(result, result.ok ? 200 : 500)
  } catch (e) {
    console.error('[send-admin-available-job-test-email]', e)
    return jsonResponse(
      { ok: false, error: e instanceof Error ? e.message : 'test_email_failed' },
      500,
    )
  }
})
