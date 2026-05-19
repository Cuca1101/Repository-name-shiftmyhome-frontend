import { isSupabaseConfigured, supabase } from '../supabaseClient'
import {
  JOB_PHOTO_BUCKET,
  JOB_PHOTO_SOURCE_LABEL,
  JOB_PHOTO_UPLOADED_BY,
  isValidQuoteRefForPhotos,
} from './jobPhotoConstants'

const TABLE = 'job_photos'
const SIGNED_URL_TTL_SEC = 3600

/**
 * @param {string} quoteRef
 * @param {string|null|undefined} jobId
 * @returns {Promise<Record<string, unknown>[]>}
 */
export async function fetchJobPhotosForAdmin(quoteRef, jobId) {
  if (!isSupabaseConfigured || !supabase) return []
  const ref = String(quoteRef || '').trim()
  const jid = jobId != null ? String(jobId).trim() : ''
  if (!ref && !jid) return []

  /** @type {Record<string, unknown>[]} */
  const rows = []
  const seen = new Set()

  const merge = (list) => {
    for (const row of list ?? []) {
      const id = row?.id != null ? String(row.id) : ''
      if (!id || seen.has(id)) continue
      seen.add(id)
      rows.push(row)
    }
  }

  if (ref) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('quote_ref', ref)
      .order('created_at', { ascending: true })
    if (error) throw error
    merge(data)
  }

  if (jid) {
    const { data: byJob, error: jobErr } = await supabase
      .from(TABLE)
      .select('*')
      .eq('job_id', jid)
      .order('created_at', { ascending: true })
    if (jobErr) throw jobErr
    merge(byJob)
  }

  rows.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  return rows
}

/**
 * @param {Record<string, unknown>[]} rows
 * @returns {Promise<(Record<string, unknown> & { signedUrl: string | null })[]>}
 */
export async function attachSignedUrlsToJobPhotos(rows) {
  if (!isSupabaseConfigured || !supabase || !rows.length) return []

  const out = await Promise.all(
    rows.map(async (row) => {
      const path = row.storage_path != null ? String(row.storage_path) : ''
      if (!path) return { ...row, signedUrl: null }
      const { data, error } = await supabase.storage.from(JOB_PHOTO_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SEC)
      if (error) {
        console.warn('[job_photos] signed URL failed', path, error)
        return {
          ...row,
          signedUrl: null,
          signedUrlError: error.message || 'Could not create signed URL',
        }
      }
      return { ...row, signedUrl: data?.signedUrl ?? null, signedUrlError: null }
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
