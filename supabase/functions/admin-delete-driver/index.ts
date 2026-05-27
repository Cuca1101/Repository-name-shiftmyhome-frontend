import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { handleAdminDriverLifecycle, lifecycleCorsHeaders } from '../_shared/adminDriverLifecycleHandler.ts'

/** @deprecated Prefer admin-driver-lifecycle with action=delete */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: lifecycleCorsHeaders })
  }
  if (req.method !== 'POST') {
    return handleAdminDriverLifecycle(req)
  }
  const body = await req.json().catch(() => ({}))
  const nextReq = new Request(req.url, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify({ ...body, action: 'delete' }),
  })
  return handleAdminDriverLifecycle(nextReq)
})
