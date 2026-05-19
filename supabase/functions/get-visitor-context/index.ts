import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function header(req: Request, name: string): string {
  return (req.headers.get(name) || req.headers.get(name.toLowerCase()) || '').trim()
}

function clientIp(req: Request): string {
  const cf = header(req, 'cf-connecting-ip')
  if (cf) return cf
  const xff = header(req, 'x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() || ''
  const real = header(req, 'x-real-ip')
  return real
}

function maskIp(ip: string): string {
  const t = ip.trim()
  if (!t) return ''
  if (t.includes('.')) {
    const parts = t.split('.')
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`
    return `${t.slice(0, 12)}…`
  }
  const segs = t.split(':').filter(Boolean)
  if (segs.length >= 2) return `${segs.slice(0, 3).join(':')}:…`
  return `${t.slice(0, 8)}…`
}

async function hashIp(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${ip}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const ip = clientIp(req)
    const salt = Deno.env.get('VISITOR_IP_HASH_SALT') || 'shiftmyhome-visitor-context'
    const city =
      header(req, 'cf-ipcity') ||
      header(req, 'x-vercel-ip-city') ||
      ''
    const region =
      header(req, 'cf-region') ||
      header(req, 'cf-ipregion') ||
      header(req, 'x-vercel-ip-country-region') ||
      ''
    const country =
      header(req, 'cf-ipcountry') ||
      header(req, 'x-vercel-ip-country') ||
      ''

    const ip_hash = ip ? await hashIp(ip, salt) : ''
    const ip_masked = ip ? maskIp(ip) : ''

    return new Response(
      JSON.stringify({
        ip_hash,
        ip_masked,
        city: city || null,
        region: region || null,
        country: country || null,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (e) {
    return new Response(
      JSON.stringify({
        ip_hash: null,
        ip_masked: null,
        city: null,
        region: null,
        country: null,
        error: e instanceof Error ? e.message : 'context_failed',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  }
})
