import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { assertAdminCaller } from '../_shared/verifyAdminCaller.ts'
import { BOOKING_INVOICE_BUCKET } from '../_shared/customerEmailArchive.ts'

/**
 * Read a PDF that was stored when the email was sent.
 * Does not send email and does not build a new invoice.
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

function providerStatusFromLastEvent(lastEvent: string) {
  const name = String(lastEvent || '').toLowerCase()
  if (name === 'delivered' || name === 'opened' || name === 'clicked') return 'delivered'
  if (name === 'bounced' || name === 'complained' || name === 'failed') return 'failed'
  if (name === 'sent' || name === 'delivery_delayed') return 'sent'
  return ''
}

function nextStatus(current: string, incoming: string) {
  if (incoming === 'failed') return 'failed'
  if (current === 'failed') return 'failed'
  if (incoming === 'delivered' || current === 'delivered') return 'delivered'
  return 'sent'
}

async function syncProviderStatuses(
  // deno-lint-ignore no-explicit-any
  admin: any,
  quoteId: string,
) {
  const apiKey = (Deno.env.get('RESEND_API_KEY') || '').trim()
  if (!apiKey) return
  const [notes, archives] = await Promise.all([
    admin
      .from('job_customer_notifications')
      .select('id, provider_message_id, provider_status')
      .eq('quote_id', quoteId)
      .not('provider_message_id', 'is', null)
      .limit(20),
    admin
      .from('customer_email_archive')
      .select('id, provider_message_id, provider_status')
      .eq('quote_id', quoteId)
      .not('provider_message_id', 'is', null)
      .limit(20),
  ])
  const ids = new Set<string>()
  for (const row of [...(notes.data || []), ...(archives.data || [])]) {
    const id = String(row.provider_message_id || '').trim()
    if (id) ids.add(id)
  }
  for (const id of ids) {
    const response = await fetch(`https://api.resend.com/emails/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!response.ok) continue
    const payload = (await response.json().catch(() => ({}))) as { last_event?: string }
    const incoming = providerStatusFromLastEvent(String(payload.last_event || ''))
    if (!incoming) continue
    for (const note of notes.data || []) {
      if (note.provider_message_id !== id) continue
      const providerStatus = nextStatus(String(note.provider_status || ''), incoming)
      await admin.from('job_customer_notifications').update({ provider_status: providerStatus }).eq('id', note.id)
    }
    for (const archive of archives.data || []) {
      if (archive.provider_message_id !== id) continue
      const providerStatus = nextStatus(String(archive.provider_status || ''), incoming)
      await admin.from('customer_email_archive').update({ provider_status: providerStatus }).eq('id', archive.id)
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return jsonResponse({ ok: false, error: 'unauthorized' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !anonKey || !serviceKey) return jsonResponse({ ok: false, error: 'server_misconfigured' }, 503)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData?.user) return jsonResponse({ ok: false, error: 'unauthorized' }, 401)

  const admin = createClient(supabaseUrl, serviceKey)
  const allowed = await assertAdminCaller(admin, userData.user)
  if (!allowed.ok) return jsonResponse({ ok: false, error: 'forbidden' }, 403)

  const body = (await req.json().catch(() => ({}))) as { archiveId?: string; quoteId?: string; sync?: boolean }
  const archiveId = String(body.archiveId || '').trim()
  const quoteId = String(body.quoteId || '').trim()

  if (body.sync && quoteId) {
    await syncProviderStatuses(admin, quoteId)
    return jsonResponse({ ok: true, synced: true })
  }

  let query = admin
    .from('customer_email_archive')
    .select('id, quote_id, invoice_bucket, invoice_path, invoice_filename, sent_at')
    .not('invoice_path', 'is', null)

  if (archiveId) query = query.eq('id', archiveId)
  else if (quoteId) query = query.eq('quote_id', quoteId).order('sent_at', { ascending: false }).limit(1)
  else return jsonResponse({ ok: false, error: 'missing_target' }, 400)

  const { data, error } = archiveId ? await query.maybeSingle() : await query
  if (error) return jsonResponse({ ok: false, error: 'lookup_failed' }, 500)
  const row = Array.isArray(data) ? data[0] : data
  const path = String(row?.invoice_path || '').trim()
  const bucket = String(row?.invoice_bucket || BOOKING_INVOICE_BUCKET).trim()
  if (!row || !path || path.includes('..') || bucket !== BOOKING_INVOICE_BUCKET) {
    return jsonResponse({ ok: false, reason: 'not_stored' })
  }

  const downloaded = await admin.storage.from(bucket).download(path)
  if (downloaded.error || !downloaded.data) {
    return jsonResponse({ ok: false, reason: 'not_stored' })
  }
  const bytes = new Uint8Array(await downloaded.data.arrayBuffer())
  if (!bytes.length) return jsonResponse({ ok: false, reason: 'not_stored' })

  return jsonResponse({
    ok: true,
    filename: row.invoice_filename || 'invoice.pdf',
    contentBase64: bytesToBase64(bytes),
  })
})
