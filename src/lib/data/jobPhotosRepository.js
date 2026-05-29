import { isSupabaseConfigured, supabase } from '../supabaseClient'
import {
  JOB_PHOTO_BUCKET,
  JOB_PHOTO_SOURCE_LABEL,
  JOB_PHOTO_UPLOADED_BY,
  isValidQuoteRefForPhotos,
} from './jobPhotoConstants'

const TABLE = 'job_photos'
const SIGNED_URL_TTL_SEC = 3600

/** @param {unknown} path */
function normalizeStoragePath(path) {
  return String(path ?? '')
    .trim()
    .replace(/^\/+/, '')
}

/** Admin storage list: SMH-2026-123456 or SMH-2026-0001 job references */
function isAdminStorageFolderRef(ref) {
  return /^SMH-\d{4}-\d{4,6}$/i.test(String(ref || '').trim())
}

/** @param {unknown} text */
function extractSmhRefsFromText(text) {
  const matches = String(text ?? '').match(/SMH-\d{4}-\d{4,6}/gi) ?? []
  return [...new Set(matches.map((m) => m.trim().toUpperCase()))]
}

/** @param {Record<string, unknown>|null|undefined} quoteRow */
export function extractSmhRefsFromQuoteRow(quoteRow) {
  if (!quoteRow || typeof quoteRow !== 'object') return []
  const refs = new Set()
  extractSmhRefsFromText(quoteRow.details).forEach((r) => refs.add(r))
  extractSmhRefsFromText(quoteRow.pricing).forEach((r) => refs.add(r))
  extractSmhRefsFromText(quoteRow.inventory_text).forEach((r) => refs.add(r))
  extractSmhRefsFromText(quoteRow.quote_ref).forEach((r) => refs.add(r))
  return [...refs]
}

/**
 * Collect every quote ref / job id that may identify photos for an admin job view.
 * @param {{
 *   quoteRef?: string|null,
 *   jobId?: string|null,
 *   quoteRow?: Record<string, unknown>|null,
 *   linkedJob?: Record<string, unknown>|null,
 * }} input
 */
export function resolveJobPhotoLookupKeys({ quoteRef, jobId, quoteRow, linkedJob }) {
  /** @type {Set<string>} */
  const quoteRefs = new Set()
  /** @type {Set<string>} */
  const jobIds = new Set()

  const addRef = (value) => {
    const t = String(value ?? '').trim()
    if (t) quoteRefs.add(t)
  }
  const addJobId = (value) => {
    const t = String(value ?? '').trim()
    if (t) jobIds.add(t)
  }

  addRef(quoteRef)
  if (quoteRow) {
    addRef(quoteRow.quote_ref)
    addJobId(quoteRow.id)
    extractSmhRefsFromQuoteRow(quoteRow).forEach((r) => addRef(r))
  }
  if (linkedJob) {
    addJobId(linkedJob.id)
    const pi = linkedJob.price_inputs
    if (pi && typeof pi === 'object') {
      addRef(pi.quoteRef)
      extractSmhRefsFromText(pi.quoteRef).forEach((r) => addRef(r))
    }
  }
  addJobId(jobId)

  return {
    quoteRefs: [...quoteRefs],
    jobIds: [...jobIds],
    quoteId: quoteRow?.id != null ? String(quoteRow.id) : null,
  }
}

/**
 * @param {ReturnType<typeof resolveJobPhotoLookupKeys>} keys
 * @param {Record<string, unknown>} extra
 */
function buildPhotoFetchDebug(keys, extra = {}) {
  return {
    quote_id: keys.quoteId ?? null,
    booking_id: null,
    job_id: keys.jobIds[0] ?? null,
    quote_ref: keys.quoteRefs[0] ?? null,
    quote_refs: keys.quoteRefs,
    job_ids: keys.jobIds,
    tables_queried: [],
    row_count: 0,
    storage_bucket: JOB_PHOTO_BUCKET,
    signed_url_ok: 0,
    signed_url_failed: 0,
    signed_url_errors: [],
    query_errors: [],
    authenticated: false,
    via: 'client',
    empty_reason: null,
    ...extra,
  }
}

function logPhotoFetchDebug(debug) {
  if (!import.meta.env.DEV) return
  // eslint-disable-next-line no-console
  console.debug('[job_photos] admin fetch', debug)
}

/**
 * @param {Record<string, unknown>[]} rows
 * @param {string[]} quoteRefs
 * @param {Set<string>} seenPaths
 */
async function appendStorageOnlyPhotoRows(rows, quoteRefs, seenPaths) {
  if (!isSupabaseConfigured || !supabase) return

  for (const ref of quoteRefs) {
    if (!isAdminStorageFolderRef(ref)) continue
    const { data: files, error } = await supabase.storage.from(JOB_PHOTO_BUCKET).list(ref, {
      limit: 100,
      sortBy: { column: 'created_at', order: 'asc' },
    })
    if (error) {
      if (import.meta.env.DEV) {
        console.warn('[job_photos] storage list failed', { quoteRef: ref, error })
      }
      continue
    }
    for (const file of files ?? []) {
      const name = file?.name != null ? String(file.name) : ''
      if (!name || name === '.emptyFolderPlaceholder') continue
      const path = normalizeStoragePath(`${ref}/${name}`)
      if (!path || seenPaths.has(path)) continue
      seenPaths.add(path)
      rows.push({
        id: `storage:${path}`,
        quote_ref: ref,
        job_id: null,
        storage_path: path,
        file_name: name,
        mime_type: file.metadata?.mimetype ?? file.metadata?.contentType ?? null,
        size_bytes: file.metadata?.size ?? null,
        uploaded_by: JOB_PHOTO_UPLOADED_BY.CUSTOMER,
        source_label: JOB_PHOTO_SOURCE_LABEL.CUSTOMER,
        photo_type: 'general',
        created_at: file.created_at ?? file.updated_at ?? new Date().toISOString(),
        fromStorageOnly: true,
      })
    }
  }
}

/**
 * @param {ReturnType<typeof resolveJobPhotoLookupKeys>} keys
 * @param {{ tablesQueried: string[], queryErrors: { query: string, message: string }[] }} trace
 */
async function fetchJobPhotosClient(keys, trace) {
  /** @type {Record<string, unknown>[]} */
  const rows = []
  const seenPaths = new Set()
  const seenIds = new Set()

  const merge = (list) => {
    for (const row of list ?? []) {
      const path = normalizeStoragePath(row?.storage_path)
      const id = row?.id != null ? String(row.id) : ''
      const dedupeKey = path || id
      if (!dedupeKey) continue
      if (path && seenPaths.has(path)) continue
      if (id && seenIds.has(id)) continue
      if (path) seenPaths.add(path)
      if (id) seenIds.add(id)
      rows.push(path ? { ...row, storage_path: path } : row)
    }
  }

  if (keys.quoteId) {
    trace.tablesQueried.push(`job_photos.quote_id = ${keys.quoteId}`)
    const { data, error } = await supabase.from(TABLE).select('*').eq('quote_id', keys.quoteId)
    if (error) trace.queryErrors.push({ query: 'quote_id.eq', message: error.message })
    else merge(data)
  }

  if (keys.quoteRefs.length) {
    trace.tablesQueried.push(`job_photos.quote_ref IN (${keys.quoteRefs.length})`)
    const { data, error } = await supabase.from(TABLE).select('*').in('quote_ref', keys.quoteRefs)
    if (error) trace.queryErrors.push({ query: 'quote_ref.in', message: error.message })
    else merge(data)
  }

  if (keys.jobIds.length) {
    trace.tablesQueried.push(`job_photos.job_id IN (${keys.jobIds.length})`)
    const { data, error } = await supabase.from(TABLE).select('*').in('job_id', keys.jobIds)
    if (error) trace.queryErrors.push({ query: 'job_id.in', message: error.message })
    else merge(data)
  }

  for (const ref of keys.quoteRefs) {
    trace.tablesQueried.push(`job_photos.storage_path ILIKE ${ref}/%`)
    const { data, error } = await supabase.from(TABLE).select('*').ilike('storage_path', `${ref}/%`)
    if (error) trace.queryErrors.push({ query: `storage_path ilike ${ref}`, message: error.message })
    else merge(data)
  }

  if (keys.quoteId) {
    trace.tablesQueried.push('job_photos.storage_path ILIKE quote_id/%')
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .ilike('storage_path', `${keys.quoteId}/%`)
    if (error) trace.queryErrors.push({ query: 'storage_path ilike quote_id', message: error.message })
    else merge(data)
  }

  await appendStorageOnlyPhotoRows(rows, keys.quoteRefs, seenPaths)

  if (keys.quoteId) {
    trace.tablesQueried.push(`storage.list(${keys.quoteId})`)
    const { data: files, error } = await supabase.storage.from(JOB_PHOTO_BUCKET).list(keys.quoteId, { limit: 100 })
    if (error) {
      trace.queryErrors.push({ query: `storage.list quote_id`, message: error.message })
    } else {
      for (const file of files ?? []) {
        const name = file?.name != null ? String(file.name) : ''
        if (!name || name === '.emptyFolderPlaceholder') continue
        const path = normalizeStoragePath(`${keys.quoteId}/${name}`)
        if (!path || seenPaths.has(path)) continue
        seenPaths.add(path)
        rows.push({
          id: `storage:${path}`,
          quote_ref: keys.quoteRefs[0] ?? null,
          storage_path: path,
          file_name: name,
          uploaded_by: JOB_PHOTO_UPLOADED_BY.CUSTOMER,
          source_label: JOB_PHOTO_SOURCE_LABEL.CUSTOMER,
          photo_type: 'general',
          fromStorageOnly: true,
        })
      }
    }
  }

  rows.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  return rows
}

/**
 * @param {ReturnType<typeof resolveJobPhotoLookupKeys>} keys
 * @param {Record<string, unknown>|null|undefined} quoteRow
 */
async function fetchJobPhotosViaEdge(keys, quoteRow) {
  const { data, error } = await supabase.functions.invoke('admin-job-photos', {
    body: {
      quote_id: keys.quoteId,
      quote_ref: keys.quoteRefs[0] ?? null,
      quote_refs: keys.quoteRefs,
      job_id: keys.jobIds[0] ?? null,
      job_ids: keys.jobIds,
      details: quoteRow?.details ?? null,
      pricing: quoteRow?.pricing ?? null,
      inventory_text: quoteRow?.inventory_text ?? null,
    },
  })

  if (error) {
    return {
      rows: [],
      debug: buildPhotoFetchDebug(keys, {
        via: 'edge_invoke_failed',
        empty_reason: error.message || 'Edge function invoke failed',
        query_errors: [{ query: 'admin-job-photos', message: error.message || 'invoke failed' }],
      }),
    }
  }

  const payload = data && typeof data === 'object' ? data : {}
  if (!payload.ok) {
    return {
      rows: [],
      debug: buildPhotoFetchDebug(keys, {
        via: 'edge_error',
        empty_reason: String(payload.error || 'admin-job-photos returned error'),
        query_errors: [{ query: 'admin-job-photos', message: String(payload.error || 'error') }],
      }),
    }
  }

  const edgeRows = Array.isArray(payload.rows) ? payload.rows : []
  const edgeDebug = payload.debug && typeof payload.debug === 'object' ? payload.debug : {}
  return {
    rows: edgeRows,
    debug: buildPhotoFetchDebug(keys, { ...edgeDebug, via: edgeDebug.via || 'edge_service_role' }),
  }
}

/**
 * @param {{
 *   quoteRef?: string|null,
 *   jobId?: string|null,
 *   quoteRow?: Record<string, unknown>|null,
 *   linkedJob?: Record<string, unknown>|null,
 * }} lookup
 * @returns {Promise<{ rows: Record<string, unknown>[], debug: Record<string, unknown> }>}
 */
export async function fetchJobPhotosForAdminLookup(lookup) {
  if (!isSupabaseConfigured || !supabase) {
    const keys = resolveJobPhotoLookupKeys(lookup)
    return {
      rows: [],
      debug: buildPhotoFetchDebug(keys, {
        empty_reason: 'Supabase not configured',
        authenticated: false,
      }),
    }
  }

  const keys = resolveJobPhotoLookupKeys(lookup)
  const trace = { tablesQueried: [], queryErrors: [] }

  if (!keys.quoteRefs.length && !keys.jobIds.length && !keys.quoteId) {
    const debug = buildPhotoFetchDebug(keys, {
      empty_reason: 'No quote_ref, quote_id, or job_id available for photo lookup',
      authenticated: false,
    })
    logPhotoFetchDebug(debug)
    return { rows: [], debug }
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const authenticated = Boolean(sessionData?.session)

  let rows = []
  let debug = buildPhotoFetchDebug(keys, { authenticated })

  try {
    rows = await fetchJobPhotosClient(keys, trace)
    debug = buildPhotoFetchDebug(keys, {
      authenticated,
      tables_queried: trace.tablesQueried,
      query_errors: trace.queryErrors,
      row_count: rows.length,
      via: 'client',
    })

    const shouldTryEdge =
      rows.length === 0 ||
      trace.queryErrors.some((e) => /permission|policy|jwt|unauthorized|403/i.test(e.message))

    if (shouldTryEdge && authenticated) {
      const edge = await fetchJobPhotosViaEdge(keys, lookup.quoteRow)
      if (edge.rows.length > 0 || rows.length === 0) {
        rows = edge.rows
        debug = {
          ...edge.debug,
          client_row_count: debug.row_count,
          client_query_errors: debug.query_errors,
        }
      } else if (rows.length === 0) {
        debug = {
          ...debug,
          ...edge.debug,
          empty_reason:
            edge.debug.empty_reason ||
            'No rows in job_photos or quote-photos storage for resolved keys (client + edge)',
        }
      }
    } else if (rows.length === 0) {
      debug.empty_reason = authenticated
        ? 'No rows in job_photos or quote-photos storage for resolved keys'
        : 'Admin not signed in — photo metadata requires an authenticated Supabase session'
    }
  } catch (err) {
    debug.query_errors.push({ query: 'client_fetch', message: err?.message || String(err) })
    if (authenticated) {
      const edge = await fetchJobPhotosViaEdge(keys, lookup.quoteRow)
      rows = edge.rows
      debug = { ...edge.debug, client_error: err?.message || String(err) }
    } else {
      debug.empty_reason = err?.message || 'Client fetch failed'
      throw err
    }
  }

  debug.row_count = rows.length
  logPhotoFetchDebug(debug)
  return { rows, debug }
}

/**
 * @param {string} quoteRef
 * @param {string|null|undefined} jobId
 * @param {Record<string, unknown>|null} [quoteRow]
 * @param {Record<string, unknown>|null} [linkedJob]
 * @returns {Promise<Record<string, unknown>[]>}
 */
export async function fetchJobPhotosForAdmin(quoteRef, jobId, quoteRow = null, linkedJob = null) {
  const { rows } = await fetchJobPhotosForAdminLookup({ quoteRef, jobId, quoteRow, linkedJob })
  return rows
}

/**
 * @param {Record<string, unknown>[]} rows
 * @returns {Promise<(Record<string, unknown> & { signedUrl: string | null })[]>}
 */
const DRIVER_EVIDENCE_BUCKETS = [JOB_PHOTO_BUCKET, 'job-photos', 'job-evidence']

/**
 * @param {string} path
 * @returns {Promise<{ signedUrl: string|null, bucket: string|null, error: string|null }>}
 */
async function createSignedUrlForEvidencePath(path) {
  if (!isSupabaseConfigured || !supabase || !path) {
    return { signedUrl: null, bucket: null, error: 'No storage path' }
  }
  for (const bucket of DRIVER_EVIDENCE_BUCKETS) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SEC)
    if (!error && data?.signedUrl) {
      return { signedUrl: data.signedUrl, bucket, error: null }
    }
  }
  return { signedUrl: null, bucket: null, error: 'Could not create signed URL' }
}

export async function attachSignedUrlsToJobPhotos(rows) {
  if (!isSupabaseConfigured || !supabase || !rows.length) return []

  const needsSigning = rows.some((row) => !row.signedUrl && row.storage_path)
  if (!needsSigning) return rows

  const out = await Promise.all(
    rows.map(async (row) => {
      const path = normalizeStoragePath(row.storage_path)
      if (!path) return { ...row, signedUrl: null }
      const { signedUrl, bucket, error } = await createSignedUrlForEvidencePath(path)
      if (!signedUrl) {
        if (import.meta.env.DEV) {
          console.warn('[job_photos] signed URL failed', path, error)
        }
        return {
          ...row,
          signedUrl: null,
          signedUrlError: error || 'Could not create signed URL',
        }
      }
      if (import.meta.env.DEV && signedUrl) {
        // eslint-disable-next-line no-console
        console.debug('[job_photos] signed URL ok', { path, bucket, signedUrl: signedUrl.slice(0, 80) + '…' })
      }
      return { ...row, signedUrl, signedUrlError: null, signedUrlBucket: bucket }
    }),
  )
  return out
}

/**
 * @param {File} file
 * @param {string} quoteRef
 * @returns {string}
 */
function buildStoragePath(file, quoteRef) {
  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const safeBase = file.name
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .slice(0, 80)
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  return `${quoteRef}/${unique}-${safeBase || 'photo'}.${ext}`
}

/**
 * Upload one customer photo file and insert metadata (anon RLS).
 * @param {File} file
 * @param {{ quoteRef: string, jobId?: string|null }} ctx
 */
export async function uploadCustomerJobPhoto(file, ctx) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Photo storage is not configured.')
  }
  const quoteRef = String(ctx.quoteRef || '').trim()
  if (!isValidQuoteRefForPhotos(quoteRef)) {
    throw new Error('Invalid quote reference for photo upload.')
  }
  if (!file?.type?.startsWith('image/')) {
    throw new Error(`Unsupported file type: ${file?.name || 'unknown'}`)
  }

  const storagePath = buildStoragePath(file, quoteRef)

  const { error: uploadError } = await supabase.storage.from(JOB_PHOTO_BUCKET).upload(storagePath, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })
  if (uploadError) throw uploadError

  const { error: dbError } = await supabase.from(TABLE).insert({
    quote_ref: quoteRef,
    job_id: ctx.jobId ?? null,
    storage_path: storagePath,
    file_name: file.name,
    mime_type: file.type || null,
    size_bytes: file.size ?? null,
    uploaded_by: JOB_PHOTO_UPLOADED_BY.CUSTOMER,
    source_label: JOB_PHOTO_SOURCE_LABEL.CUSTOMER,
    photo_type: 'general',
  })
  if (dbError) {
    await supabase.storage.from(JOB_PHOTO_BUCKET).remove([storagePath]).catch(() => {})
    throw dbError
  }
}

/**
 * Stable key for deduplicating customer uploads (file name + size).
 * @param {File} file
 */
export function customerJobPhotoDedupKey(file) {
  const name = String(file?.name || '').trim().toLowerCase()
  const size = Number(file?.size) || 0
  return `${name}|${size}`
}

/**
 * Existing customer photo keys for a quote (anon read policy required).
 * @param {string} quoteRef
 * @returns {Promise<Set<string>>}
 */
export async function fetchCustomerJobPhotoDedupKeys(quoteRef) {
  const ref = String(quoteRef || '').trim()
  if (!isValidQuoteRefForPhotos(ref) || !isSupabaseConfigured || !supabase) {
    return new Set()
  }
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('file_name, size_bytes')
      .eq('quote_ref', ref)
      .eq('uploaded_by', JOB_PHOTO_UPLOADED_BY.CUSTOMER)
    if (error) {
      if (import.meta.env.DEV) {
        console.warn('[job_photos] dedup fetch failed', error.message || error)
      }
      return new Set()
    }
    const keys = new Set()
    for (const row of data ?? []) {
      const name = String(row.file_name || '').trim().toLowerCase()
      const size = Number(row.size_bytes) || 0
      if (name) keys.add(`${name}|${size}`)
    }
    return keys
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[job_photos] dedup fetch error', e)
    }
    return new Set()
  }
}

/**
 * Attach job_id to customer photos uploaded before job row existed.
 * @param {string} quoteRef
 * @param {string} jobId
 */
/**
 * Remove job photo metadata and storage objects for a quote ref (test cleanup only).
 * @param {string} quoteRef
 * @returns {Promise<{ deleted: number, errors: string[] }>}
 */
export async function deleteJobPhotosForQuoteRef(quoteRef) {
  const ref = String(quoteRef || '').trim()
  if (!ref || !isSupabaseConfigured || !supabase) {
    return { deleted: 0, errors: [] }
  }

  const { data, error } = await supabase.from(TABLE).select('id, storage_path').eq('quote_ref', ref)
  if (error) throw error
  const rows = data ?? []
  if (!rows.length) return { deleted: 0, errors: [] }

  const paths = rows.map((r) => String(r.storage_path || '').trim()).filter(Boolean)
  if (paths.length) {
    const { error: storageErr } = await supabase.storage.from(JOB_PHOTO_BUCKET).remove(paths)
    if (storageErr) {
      return { deleted: 0, errors: [storageErr.message || 'Storage delete failed'] }
    }
  }

  const ids = rows.map((r) => r.id).filter(Boolean)
  const { error: delErr } = await supabase.from(TABLE).delete().in('id', ids)
  if (delErr) throw delErr
  return { deleted: ids.length, errors: [] }
}

export async function linkCustomerJobPhotosToJobId(quoteRef, jobId) {
  const ref = String(quoteRef || '').trim()
  const jid = String(jobId || '').trim()
  if (!isValidQuoteRefForPhotos(ref) || !jid || !isSupabaseConfigured || !supabase) return

  const { error } = await supabase
    .from(TABLE)
    .update({ job_id: jid })
    .eq('quote_ref', ref)
    .eq('uploaded_by', JOB_PHOTO_UPLOADED_BY.CUSTOMER)
    .is('job_id', null)

  if (error && import.meta.env.DEV) {
    console.warn('[job_photos] link job_id failed', error.message || error)
  }
}
