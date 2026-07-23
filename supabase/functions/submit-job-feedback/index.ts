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

/** Submit one-time customer feedback via tracking token. */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRole) return jsonResponse({ error: 'Server misconfigured' }, 500)

  const body = await req.json().catch(() => ({}))
  const token = typeof body?.token === 'string' ? body.token.trim() : ''
  const rating = Number(body?.rating)
  const driverRating = body?.driver_rating != null ? Number(body.driver_rating) : null
  const reviewText = typeof body?.review_text === 'string' ? body.review_text.trim().slice(0, 4000) : ''
  const customerName = typeof body?.customer_name === 'string' ? body.customer_name.trim().slice(0, 120) : ''

  if (!token) return jsonResponse({ error: 'token required' }, 400)
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return jsonResponse({ error: 'rating must be 1–5' }, 400)
  }

  const supabase = createClient(supabaseUrl, serviceRole)
  const { data: portal } = await supabase.rpc('public_get_job_tracking', { p_token: token })
  if (!portal?.ok) return jsonResponse({ error: portal?.error || 'invalid_token' }, 400)
  if (!portal.completed) return jsonResponse({ error: 'Feedback is available after the job is completed' }, 400)
  if (portal.feedback_submitted) return jsonResponse({ error: 'Feedback already submitted', already: true }, 409)

  const { data: tok } = await supabase
    .from('job_tracking_tokens')
    .select('quote_id')
    .eq('token', token)
    .maybeSingle()
  if (!tok?.quote_id) return jsonResponse({ error: 'invalid_token' }, 400)

  const { error } = await supabase.from('job_customer_feedback').insert({
    quote_id: tok.quote_id,
    tracking_token: token,
    rating,
    driver_rating:
      driverRating != null && Number.isFinite(driverRating) && driverRating >= 1 && driverRating <= 5
        ? driverRating
        : null,
    review_text: reviewText || null,
    customer_name: customerName || portal.customer_name || null,
  })

  if (error) {
    if (String(error.code) === '23505') {
      return jsonResponse({ error: 'Feedback already submitted', already: true }, 409)
    }
    return jsonResponse({ error: error.message }, 500)
  }

  await supabase
    .from('quotes')
    .update({
      customer_feedback_submitted_at: new Date().toISOString(),
      customer_feedback_rating: rating,
    })
    .eq('id', tok.quote_id)

  return jsonResponse({ ok: true })
})
