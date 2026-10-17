import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { BOOKING_INVOICE_BUCKET } from '../_shared/customerEmailArchive.ts'

/**
 * Download the invoice PDF that was attached to the payment email.
 * Does not build a new invoice and does not send email.
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

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function isAdmin(user: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } | null) {
  const role = String(user?.app_metadata?.role || user?.user_metadata?.role || '').toLowerCase()
  return role === 'admin'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
  if (!supabaseUrl || !serviceKey || !anonKey) return jsonResponse({ ok: false, error: 'Server misconfigured' }, 500)

  const header = req.headers.get('Authorization') || ''
  const jwt = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!jwt) return jsonResponse({ ok: false, error: 'Sign in to continue.' }, 401)

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: userData, error: userError } = await admin.auth.getUser(jwt)
  if (userError || !userData.user) return jsonResponse({ ok: false, error: 'Sign in to continue.' }, 401)

  const body = await req.json().catch(() => ({}))
  const quoteId = String(body?.quote_id || '').trim()
  if (!quoteId) return jsonResponse({ ok: false, error: 'Missing booking.' }, 400)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const kindResult = await userClient.rpc('account_session_kind')
  const kind = !kindResult.error && typeof kindResult.data === 'string'
    ? kindResult.data
    : (isAdmin(userData.user) ? 'admin' : 'customer')
  if (kind === 'driver' || kind === 'none') {
    return jsonResponse({ ok: false, error: 'Booking not found.' }, 404)
  }

  if (kind === 'admin') {
    const customerId = String(body?.admin_customer_id || '').trim()
    if (!customerId) return jsonResponse({ ok: false, error: 'Open this booking from Admin → Customers.' }, 403)
    const { data, error } = await userClient.rpc('admin_customer_portal_booking', {
      p_customer_id: customerId,
      p_quote_id: quoteId,
    })
    if (error || !data?.ok) return jsonResponse({ ok: false, error: 'Booking not found.' }, 404)
  } else {
    const { data, error } = await userClient.rpc('customer_portal_get_booking', { p_quote_id: quoteId })
    if (error || !data?.ok) return jsonResponse({ ok: false, error: 'Booking not found.' }, 404)
  }

  const { data: rows, error: lookupError } = await admin
    .from('customer_email_archive')
    .select('invoice_bucket, invoice_path, invoice_filename, sent_at')
    .eq('quote_id', quoteId)
    .not('invoice_path', 'is', null)
    .order('sent_at', { ascending: false })
    .limit(1)
  if (lookupError) return jsonResponse({ ok: false, error: 'Could not open the invoice.' }, 500)

  const row = rows?.[0]
  const path = String(row?.invoice_path || '').trim()
  const bucket = String(row?.invoice_bucket || BOOKING_INVOICE_BUCKET).trim()
  if (!path || path.includes('..') || bucket !== BOOKING_INVOICE_BUCKET) {
    return jsonResponse({ ok: false, error: 'Invoice PDF is not saved for this booking yet.' })
  }

  const downloaded = await admin.storage.from(bucket).download(path)
  if (downloaded.error || !downloaded.data) {
    return jsonResponse({ ok: false, error: 'Invoice PDF is not saved for this booking yet.' })
  }
  const bytes = new Uint8Array(await downloaded.data.arrayBuffer())
  if (!bytes.length) return jsonResponse({ ok: false, error: 'Invoice PDF is not saved for this booking yet.' })

  return jsonResponse({
    ok: true,
    filename: row.invoice_filename || 'invoice.pdf',
    contentBase64: bytesToBase64(bytes),
  })
})
