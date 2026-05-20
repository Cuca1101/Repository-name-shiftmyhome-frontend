import {
  customerJobPhotoDedupKey,
  fetchCustomerJobPhotoDedupKeys,
  linkCustomerJobPhotosToJobId,
  uploadCustomerJobPhoto,
} from './data/jobPhotosRepository'

const MAX_CUSTOMER_PHOTOS = 12

/** sessionStorage notice shown on payment success if upload had issues */
export const PHOTO_UPLOAD_NOTICE_KEY = 'smh_photo_upload_notice_v1'

function sessionDedupStorageKey(quoteRef) {
  return `smh_uploaded_photo_keys_v1:${quoteRef}`
}

/**
 * @param {string} quoteRef
 * @returns {Set<string>}
 */
function loadSessionDedupKeys(quoteRef) {
  if (typeof sessionStorage === 'undefined') return new Set()
  try {
    const raw = sessionStorage.getItem(sessionDedupStorageKey(quoteRef))
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((k) => typeof k === 'string'))
  } catch {
    return new Set()
  }
}

/**
 * @param {string} quoteRef
 * @param {Set<string>} keys
 */
function saveSessionDedupKeys(quoteRef, keys) {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(sessionDedupStorageKey(quoteRef), JSON.stringify([...keys]))
  } catch {
    /* ignore quota */
  }
}

/**
 * @param {number} uploaded
 * @param {number} skipped
 * @param {number} failed
 * @param {number} total
 */
function buildUploadWarningMessage(uploaded, skipped, failed, total) {
  if (failed <= 0) return null
  if (uploaded > 0) {
    return `${failed} of ${total} photo(s) could not be uploaded. Your booking is confirmed — we may follow up for the remaining image(s).`
  }
  return `Your photos could not be uploaded (${failed} failed). Your booking is confirmed — please email us your images or contact support with your quote reference.`
}

/**
 * Upload customer photos after job/quote creation. Idempotent per file name+size per quote ref.
 *
 * @param {{ files: File[], quoteRef: string, jobId?: string|null }} params
 * @returns {Promise<{
 *   uploaded: number,
 *   skipped: number,
 *   failed: number,
 *   warningMessage: string|null,
 *   completedFingerprints: Set<string>,
 * }>}
 */
export async function uploadCustomerQuotePhotos({ files, quoteRef, jobId }) {
  const ref = String(quoteRef || '').trim()
  const list = Array.isArray(files) ? files.filter((f) => f instanceof File && f.size > 0) : []
  const emptyResult = {
    uploaded: 0,
    skipped: 0,
    failed: 0,
    warningMessage: null,
    completedFingerprints: new Set(),
  }
  if (!list.length) return emptyResult

  const batch = list.slice(0, MAX_CUSTOMER_PHOTOS)
  const dbKeys = await fetchCustomerJobPhotoDedupKeys(ref)
  const sessionKeys = loadSessionDedupKeys(ref)
  const knownKeys = new Set([...dbKeys, ...sessionKeys])

  let uploaded = 0
  let skipped = 0
  let failed = 0
  /** @type {Set<string>} */
  const completedFingerprints = new Set()

  for (const file of batch) {
    const key = customerJobPhotoDedupKey(file)
    if (knownKeys.has(key)) {
      skipped += 1
      completedFingerprints.add(key)
      continue
    }

    try {
      await uploadCustomerJobPhoto(file, { quoteRef: ref, jobId: jobId ?? null })
      uploaded += 1
      knownKeys.add(key)
      sessionKeys.add(key)
      completedFingerprints.add(key)
    } catch (err) {
      failed += 1
      console.warn('[Quote] photo upload failed for', file.name, err?.message || err)
    }
  }

  saveSessionDedupKeys(ref, sessionKeys)

  if (jobId) {
    await linkCustomerJobPhotosToJobId(ref, String(jobId))
  }

  const warningMessage = buildUploadWarningMessage(uploaded, skipped, failed, batch.length)

  if (warningMessage) {
    console.warn('[Quote] customer photo upload:', warningMessage, { uploaded, skipped, failed, quoteRef: ref })
  }

  return {
    uploaded,
    skipped,
    failed,
    warningMessage,
    completedFingerprints,
  }
}

/**
 * @param {{ warningMessage?: string|null }} result
 */
export function persistPhotoUploadNotice(result) {
  if (typeof sessionStorage === 'undefined') return
  const msg = result?.warningMessage != null ? String(result.warningMessage).trim() : ''
  if (msg) {
    sessionStorage.setItem(PHOTO_UPLOAD_NOTICE_KEY, msg)
  } else {
    sessionStorage.removeItem(PHOTO_UPLOAD_NOTICE_KEY)
  }
}

/**
 * @returns {string|null}
 */
export function consumePhotoUploadNotice() {
  if (typeof sessionStorage === 'undefined') return null
  const msg = sessionStorage.getItem(PHOTO_UPLOAD_NOTICE_KEY)
  sessionStorage.removeItem(PHOTO_UPLOAD_NOTICE_KEY)
  return msg && msg.trim() ? msg.trim() : null
}
