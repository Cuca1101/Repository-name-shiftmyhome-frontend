import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let postcode = ''
  let query = ''
  try {
    const body = await req.json()
    postcode = String(body?.postcode || '').trim()
    query = String(body?.q || '').trim()
  } catch {
    return json({ error: 'Invalid request' }, 400)
  }

  const key = String(Deno.env.get('SNAPADDRESS_API_KEY') || '').trim()
  if (!key) return json({ error: 'Address lookup is not configured' }, 500)

  if (query) {
    if (query.length < 2 || query.length > 80) return json({ suggestions: [] })
    const response = await fetch(
      `https://api.snapaddress.io/v1/autocomplete?q=${encodeURIComponent(query)}&limit=15`,
      { headers: { 'x-api-key': key } },
    )
    let data: { suggestions?: unknown[] } = {}
    try {
      data = await response.json()
    } catch {
      data = {}
    }
    if (!response.ok) return json({ error: 'Address lookup failed' }, 502)
    return json({ suggestions: Array.isArray(data.suggestions) ? data.suggestions : [] })
  }

  const compact = postcode.replace(/\s+/g, '').toUpperCase()
  if (!UK_POSTCODE.test(compact)) return json({ addresses: [] })

  const response = await fetch(`https://api.snapaddress.io/v1/postcodes/${encodeURIComponent(compact)}`, {
    headers: { 'x-api-key': key },
  })

  let data: { postcode?: string; addresses?: unknown[]; message?: string } = {}
  try {
    data = await response.json()
  } catch {
    data = {}
  }

  if (response.status === 404) return json({ addresses: [] })
  if (!response.ok) return json({ error: 'Address lookup failed' }, 502)

  return json({
    postcode: data.postcode || postcode,
    addresses: Array.isArray(data.addresses) ? data.addresses : [],
  })
})
