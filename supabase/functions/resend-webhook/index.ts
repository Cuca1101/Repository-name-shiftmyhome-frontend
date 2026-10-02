import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { Webhook } from 'npm:svix@1.65.0'

/**
 * Resend delivery webhooks. Updates the saved provider status only.
 * Does not send email and does not build an invoice.
 *
 * sent     = provider accepted the message
 * delivered = provider confirmed delivery
 * failed   = bounce, complaint, or provider failure
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, svix-id, svix-timestamp, svix-signature',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function providerStatusFromResendEvent(type: string) {
  const name = String(type || '').toLowerCase()
  if (name === 'email.delivered' || name === 'email.opened' || name === 'email.clicked') return 'delivered'
  if (name === 'email.bounced' || name === 'email.complained' || name === 'email.failed') return 'failed'
  if (name === 'email.sent' || name === 'email.delivery_delayed') return 'sent'
  return ''
}

function nextStatus(current: string, incoming: string) {
  if (incoming === 'failed') return 'failed'
  if (current === 'failed') return 'failed'
  if (incoming === 'delivered' || current === 'delivered') return 'delivered'
  return 'sent'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405)

  const secret = (Deno.env.get('RESEND_WEBHOOK_SECRET') || '').trim()
  if (!secret) return jsonResponse({ ok: false, error: 'webhook_not_configured' }, 503)

  const payload = await req.text()
  const headers = {
    'svix-id': req.headers.get('svix-id') || '',
    'svix-timestamp': req.headers.get('svix-timestamp') || '',
    'svix-signature': req.headers.get('svix-signature') || '',
  }
  let event: { type?: string; data?: { email_id?: string } }
  try {
    event = new Webhook(secret).verify(payload, headers) as { type?: string; data?: { email_id?: string } }
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_signature' }, 401)
  }

  const incoming = providerStatusFromResendEvent(String(event?.type || ''))
  const messageId = String(event?.data?.email_id || '').trim()
  if (!incoming || !messageId) return jsonResponse({ ok: true, ignored: true })

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceKey) return jsonResponse({ ok: false, error: 'server_misconfigured' }, 503)
  const supabase = createClient(supabaseUrl, serviceKey)

  const { data: notes } = await supabase
    .from('job_customer_notifications')
    .select('id, provider_status')
    .eq('provider_message_id', messageId)

  for (const note of notes || []) {
    const providerStatus = nextStatus(String(note.provider_status || ''), incoming)
    await supabase.from('job_customer_notifications').update({ provider_status: providerStatus }).eq('id', note.id)
  }

  const { data: archives } = await supabase
    .from('customer_email_archive')
    .select('id, provider_status')
    .eq('provider_message_id', messageId)

  for (const archive of archives || []) {
    const providerStatus = nextStatus(String(archive.provider_status || ''), incoming)
    await supabase.from('customer_email_archive').update({ provider_status: providerStatus }).eq('id', archive.id)
  }

  return jsonResponse({
    ok: true,
    updated: (notes?.length || 0) + (archives?.length || 0),
    status: incoming,
  })
})
