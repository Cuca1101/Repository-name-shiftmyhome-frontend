import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const BUCKET = 'quote-photos'
const TABLE = 'job_photos'
const SIGNED_URL_TTL_SEC = 3600

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

function normalizePath(path: unknown) {
  return String(path ?? '')
    .trim()
    .replace(/^\/+/, '')
}

function extractSmhRefs(text: unknown) {
  const matches = String(text ?? '').match(/SMH-\d{4}-\d{4,6}/gi) ?? []
  return [...new Set(matches.map((m) => m.toUpperCase()))]
}

function collectKeys(body: Record<string, unknown>) {
  const quoteRefs = new Set<string>()
  const jobIds = new Set<string>()
  const addRef = (v: unknown) => {
    const t = String(v ?? '').trim()
    if (t) quoteRefs.add(t)
  }
  const addJob = (v: unknown) => {
    const t = String(v ?? '').trim()
    if (t) jobIds.add(t)
  }

  addRef(body.quote_ref)
  if (Array.isArray(body.quote_refs)) body.quote_refs.forEach(addRef)
  addJob(body.job_id)
  if (Array.isArray(body.job_ids)) body.job_ids.forEach(addJob)
  addJob(body.quote_id)

  for (const field of ['details', 'pricing', 'inventory_text']) {
    extractSmhRefs(body[field]).forEach((r) => quoteRefs.add(r))
  }

  return { quoteRefs: [...quoteRefs], jobIds: [...jobIds], quoteId: String(body.quote_id ?? '').trim() || null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return jsonResponse({ ok: false, error: 'unauthorized' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return jsonResponse({ ok: false, error: 'server_misconfigured' }, 503)
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user?.id) {
      return jsonResponse({ ok: false, error: 'unauthorized' }, 401)
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const keys = collectKeys(body)
    const admin = createClient(supabaseUrl, serviceKey)

    /** @type {Record<string, unknown>[]} */
    const rows = []
    const seenPaths = new Set<string>()
    const seenIds = new Set<string>()
    const tablesQueried: string[] = []
    const queryErrors: { query: string; message: string }[] = []

    const merge = (list: Record<string, unknown>[] | null) => {
      for (const row of list ?? []) {
        const path = normalizePath(row.storage_path)
        const id = row.id != null ? String(row.id) : ''
        const key = path || id
        if (!key) continue
        if (path && seenPaths.has(path)) continue
        if (id && seenIds.has(id)) continue
        if (path) seenPaths.add(path)
        if (id) seenIds.add(id)
        rows.push(path ? { ...row, storage_path: path } : row)
      }
    }

    if (keys.quoteRefs.length) {
      const { data, error } = await admin.from(TABLE).select('*').in('quote_ref', keys.quoteRefs)
      tablesQueried.push(`job_photos.quote_ref IN (${keys.quoteRefs.length})`)
      if (error) queryErrors.push({ query: 'quote_ref.in', message: error.message })
      else merge(data)
    }

    if (keys.jobIds.length) {
      const { data, error } = await admin.from(TABLE).select('*').in('job_id', keys.jobIds)
      tablesQueried.push(`job_photos.job_id IN (${keys.jobIds.length})`)
      if (error) queryErrors.push({ query: 'job_id.in', message: error.message })
      else merge(data)
    }

    for (const ref of keys.quoteRefs) {
      const { data, error } = await admin
        .from(TABLE)
        .select('*')
        .ilike('storage_path', `${ref}/%`)
      tablesQueried.push(`job_photos.storage_path ILIKE ${ref}/%`)
      if (error) queryErrors.push({ query: `storage_path ilike ${ref}`, message: error.message })
      else merge(data)
    }

    if (keys.quoteId) {
      const { data, error } = await admin
        .from(TABLE)
        .select('*')
        .ilike('storage_path', `${keys.quoteId}/%`)
      tablesQueried.push(`job_photos.storage_path ILIKE quote_id/%`)
      if (error) queryErrors.push({ query: 'storage_path ilike quote_id', message: error.message })
      else merge(data)
    }

    for (const ref of keys.quoteRefs) {
      const { data: files, error } = await admin.storage.from(BUCKET).list(ref, { limit: 100 })
      tablesQueried.push(`storage.list(${ref})`)
      if (error) {
        queryErrors.push({ query: `storage.list ${ref}`, message: error.message })
        continue
      }
      for (const file of files ?? []) {
        const name = file?.name != null ? String(file.name) : ''
        if (!name || name === '.emptyFolderPlaceholder') continue
        const path = normalizePath(`${ref}/${name}`)
        if (!path || seenPaths.has(path)) continue
        seenPaths.add(path)
        rows.push({
          id: `storage:${path}`,
          quote_ref: ref,
          storage_path: path,
          file_name: name,
          uploaded_by: 'customer',
          source_label: 'Added by customer',
          photo_type: 'general',
          fromStorageOnly: true,
        })
      }
    }

    let signedUrlOk = 0
    let signedUrlFailed = 0
    const signedUrlErrors: string[] = []

    const withUrls = await Promise.all(
      rows.map(async (row) => {
        const path = normalizePath(row.storage_path)
        if (!path) return { ...row, signedUrl: null, signedUrlError: 'missing storage_path' }
        const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SEC)
        if (error) {
          signedUrlFailed += 1
          if (signedUrlErrors.length < 3) signedUrlErrors.push(`${path}: ${error.message}`)
          return { ...row, signedUrl: null, signedUrlError: error.message }
        }
        signedUrlOk += 1
        return { ...row, signedUrl: data?.signedUrl ?? null, signedUrlError: null }
      }),
    )

    return jsonResponse({
      ok: true,
      rows: withUrls,
      debug: {
        quote_id: keys.quoteId,
        booking_id: null,
        job_id: keys.jobIds[0] ?? null,
        quote_ref: keys.quoteRefs[0] ?? null,
        quote_refs: keys.quoteRefs,
        job_ids: keys.jobIds,
        tables_queried: tablesQueried,
        row_count: withUrls.length,
        storage_bucket: BUCKET,
        signed_url_ok: signedUrlOk,
        signed_url_failed: signedUrlFailed,
        signed_url_errors: signedUrlErrors,
        query_errors: queryErrors,
        authenticated_admin: true,
        via: 'edge_service_role',
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return jsonResponse({ ok: false, error: message }, 500)
  }
})
