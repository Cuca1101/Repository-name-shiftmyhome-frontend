import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

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

const BUCKETS = ['job-evidence', 'job-photos', 'quote-photos']

/** Return signed photo URLs for a tracking token (customer portal). */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRole) return jsonResponse({ error: 'Server misconfigured' }, 500)

  const body = await req.json().catch(() => ({}))
  const token = typeof body?.token === 'string' ? body.token.trim() : ''
  if (!token) return jsonResponse({ error: 'token required' }, 400)

  const supabase = createClient(supabaseUrl, serviceRole)
  const { data: portal } = await supabase.rpc('public_get_job_tracking', { p_token: token })
  if (!portal?.ok) return jsonResponse({ error: portal?.error || 'invalid_token' }, 400)

  const photos = Array.isArray(portal.photos) ? portal.photos : []
  const waivers = Array.isArray(portal.waivers) ? portal.waivers : []
  const all = [...photos, ...waivers]

  const withUrls = []
  for (const p of all) {
    const path = String(p.storage_path || '').replace(/^\/+/, '')
    if (!path) continue
    let signedUrl = null
    for (const bucket of BUCKETS) {
      const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600)
      if (data?.signedUrl) {
        signedUrl = data.signedUrl
        break
      }
    }
    withUrls.push({ ...p, signed_url: signedUrl })
  }

  return jsonResponse({ ok: true, photos: withUrls })
})
