import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { assertAdminCaller } from '../_shared/verifyAdminCaller.ts'
import { cashInvoiceAdminClient, sendCashPaidInvoice } from '../_shared/cashPaidInvoice.ts'

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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader) return jsonResponse({ ok: false, error: 'unauthorized' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const admin = cashInvoiceAdminClient()
  if (!supabaseUrl || !anonKey || !admin) return jsonResponse({ ok: false, error: 'server_misconfigured' }, 503)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData?.user) return jsonResponse({ ok: false, error: 'unauthorized' }, 401)
  const allowed = await assertAdminCaller(admin, userData.user)
  if (!allowed.ok) return jsonResponse({ ok: false, error: 'forbidden' }, 403)

  const body = (await req.json().catch(() => ({}))) as { quoteId?: string }
  const quoteId = String(body.quoteId || '').trim()
  if (!quoteId) return jsonResponse({ ok: false, error: 'missing_quote' }, 400)

  const result = await sendCashPaidInvoice(admin, quoteId, { manual: true })
  return jsonResponse(result, 200)
})
