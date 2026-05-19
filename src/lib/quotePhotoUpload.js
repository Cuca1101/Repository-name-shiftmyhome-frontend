import { uploadCustomerJobPhoto } from './data/jobPhotosRepository'

const MAX_CUSTOMER_PHOTOS = 12

/**
 * Upload customer photos from the quote wizard after job/quote creation.
 * Failures are thrown to the caller (submit flow catches and shows a soft warning).
 *
 * @param {{ files: File[], quoteRef: string, jobId?: string|null }} params
 * @returns {Promise<{ uploaded: number, failed: number }>}
 */
export async function uploadCustomerQuotePhotos({ files, quoteRef, jobId }) {
  const list = Array.isArray(files) ? files.filter((f) => f instanceof File && f.size > 0) : []
  if (!list.length) return { uploaded: 0, failed: 0 }

  const batch = list.slice(0, MAX_CUSTOMER_PHOTOS)
  let uploaded = 0
  let failed = 0

  for (const file of batch) {
    try {
      await uploadCustomerJobPhoto(file, { quoteRef, jobId })
      uploaded += 1
    } catch (err) {
      failed += 1
      console.warn('[Quote] photo upload failed for', file.name, err)
    }
  }

  if (failed > 0 && uploaded === 0) {
    throw new Error('Could not upload photos.')
  }
  if (failed > 0) {
    throw new Error(`${failed} of ${batch.length} photo(s) could not be uploaded.`)
  }

  return { uploaded, failed }
}
