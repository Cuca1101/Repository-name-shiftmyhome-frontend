import { isSupabaseConfigured, supabase } from '../supabase'
import {
  DRIVER_DOCUMENT_BUCKET,
  assertDriverDocumentFile,
  isDriverDocumentType,
} from './driverDocumentConstants'

const TABLE = 'driver_documents'
const SIGNED_URL_TTL_SEC = 3600

/**
 * @param {string} driverId
 * @param {import('./driverDocumentConstants.js').DriverDocumentType} documentType
 * @param {File} file
 */
function buildStoragePath(driverId, documentType, file) {
  const ext =
    file.type === 'application/pdf'
      ? 'pdf'
      : file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const safeBase = file.name
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .slice(0, 60)
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  return `${driverId}/${documentType}/${unique}-${safeBase || 'document'}.${ext}`
}

/**
 * @param {Record<string, unknown>[]} rows
 */
async function attachSignedUrls(rows) {
  if (!isSupabaseConfigured || !supabase || !rows.length) return []

  return Promise.all(
    rows.map(async (row) => {
      const path = row.storage_path != null ? String(row.storage_path) : ''
      if (!path) return { ...row, signedUrl: null }
      const { data, error } = await supabase.storage
        .from(DRIVER_DOCUMENT_BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SEC)
      if (error) {
        return { ...row, signedUrl: null, signedUrlError: error.message || 'Could not create signed URL' }
      }
      return { ...row, signedUrl: data?.signedUrl ?? null, signedUrlError: null }
    }),
  )
}

/**
 * @param {string} driverId
 * @returns {Promise<(Record<string, unknown> & { signedUrl: string | null })[]>}
 */
export async function fetchDriverDocuments(driverId) {
  if (!isSupabaseConfigured || !supabase) return []
  const id = String(driverId || '').trim()
  if (!id) return []

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('driver_id', id)
    .order('uploaded_at', { ascending: true })
  if (error) throw error
  return attachSignedUrls(data ?? [])
}

/**
 * Map driver id → set of document_type for list badges.
 * @returns {Promise<Map<string, Set<string>>>}
 */
export async function fetchDriverDocumentTypesByDriver() {
  if (!isSupabaseConfigured || !supabase) return new Map()

  const { data, error } = await supabase.from(TABLE).select('driver_id, document_type')
  if (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[driver_documents] summary fetch failed', error.message)
    }
    return new Map()
  }

  /** @type {Map<string, Set<string>>} */
  const map = new Map()
  for (const row of data ?? []) {
    const did = row.driver_id != null ? String(row.driver_id) : ''
    const type = row.document_type != null ? String(row.document_type) : ''
    if (!did || !type) continue
    if (!map.has(did)) map.set(did, new Set())
    map.get(did).add(type)
  }
  return map
}

/**
 * @param {string} driverId
 * @param {import('./driverDocumentConstants.js').DriverDocumentType} documentType
 * @param {File} file
 */
export async function uploadDriverDocument(driverId, documentType, file) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Document storage is not configured.')
  }
  const id = String(driverId || '').trim()
  if (!id) throw new Error('Driver id is required to upload documents.')
  if (!isDriverDocumentType(documentType)) throw new Error('Invalid document type.')
  assertDriverDocumentFile(file)

  const { data: existing } = await supabase
    .from(TABLE)
    .select('id, storage_path')
    .eq('driver_id', id)
    .eq('document_type', documentType)
    .maybeSingle()

  if (existing?.id) {
    await deleteDriverDocument(String(existing.id), { skipStorageIfMissing: true })
  }

  const storagePath = buildStoragePath(id, documentType, file)
  const { error: uploadError } = await supabase.storage.from(DRIVER_DOCUMENT_BUCKET).upload(storagePath, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      driver_id: id,
      document_type: documentType,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_at: new Date().toISOString(),
    })
    .select('*')
    .single()
  if (error) {
    await supabase.storage.from(DRIVER_DOCUMENT_BUCKET).remove([storagePath])
    throw error
  }

  const [withUrl] = await attachSignedUrls([data])
  return withUrl
}

/**
 * @param {string} documentId
 * @param {{ skipStorageIfMissing?: boolean }} [opts]
 */
export async function deleteDriverDocument(documentId, opts = {}) {
  if (!isSupabaseConfigured || !supabase) return

  const { data: row, error: fetchErr } = await supabase
    .from(TABLE)
    .select('id, storage_path')
    .eq('id', documentId)
    .maybeSingle()
  if (fetchErr) throw fetchErr
  if (!row?.id) return

  const path = row.storage_path != null ? String(row.storage_path) : ''
  if (path) {
    const { error: storageErr } = await supabase.storage.from(DRIVER_DOCUMENT_BUCKET).remove([path])
    if (storageErr && !opts.skipStorageIfMissing) throw storageErr
  }

  const { error } = await supabase.from(TABLE).delete().eq('id', documentId)
  if (error) throw error
}

/**
 * Upload multiple pending files after a new driver is created.
 * @param {string} driverId
 * @param {Record<string, File | null | undefined>} pendingByType
 * @returns {Promise<{ uploaded: (Record<string, unknown> & { signedUrl: string | null })[], errors: string[] }>}
 */
export async function uploadPendingDriverDocuments(driverId, pendingByType) {
  /** @type {(Record<string, unknown> & { signedUrl: string | null })[]} */
  const uploaded = []
  /** @type {string[]} */
  const errors = []

  for (const [documentType, file] of Object.entries(pendingByType || {})) {
    if (!(file instanceof File)) continue
    try {
      const row = await uploadDriverDocument(driverId, /** @type {import('./driverDocumentConstants.js').DriverDocumentType} */ (documentType), file)
      uploaded.push(row)
    } catch (e) {
      errors.push(`${documentType}: ${e?.message || 'Upload failed'}`)
    }
  }

  return { uploaded, errors }
}
