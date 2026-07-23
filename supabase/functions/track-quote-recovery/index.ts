import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

/** Public open / click tracking pixel and beacon for recovery emails. */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PIXEL_GIF = Uint8Array.from(
  atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'),
  (c) => c.charCodeAt(0),
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = new URL(req.url)
  const token = (url.searchParams.get('t') || '').trim()
  const event = (url.searchParams.get('e') || 'open').trim().toLowerCase()

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (token && supabaseUrl && serviceKey) {
    try {
      const supabase = createClient(supabaseUrl, serviceKey)
      await supabase.rpc('public_track_recovery_event', {
        p_token: token,
        p_event: event === 'open' || event === 'resume_click' || event === 'payment_click' ? event : 'open',
      })
    } catch (e) {
      console.error('[track-quote-recovery]', e)
    }
  }

  if (req.method === 'POST') {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(PIXEL_GIF, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  })
})
