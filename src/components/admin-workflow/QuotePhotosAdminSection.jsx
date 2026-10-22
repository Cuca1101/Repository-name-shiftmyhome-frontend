import { useEffect, useState } from 'react'
import JobPhotoThumbGrid from '../job-photos/JobPhotoThumbGrid'
import {
  attachSignedUrlsToJobPhotos,
  fetchJobPhotosForAdminLookup,
} from '../../lib/data/jobPhotosRepository'
import { isSupabaseConfigured } from '../../lib/supabase'

const cardShell =
  'overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]'

/**
 * @param {{
 *   quoteRef?: string|null,
 *   jobId?: string|null,
 *   quoteRow?: Record<string, unknown>|null,
 *   linkedJob?: Record<string, unknown>|null,
 *   legacyPhotoFileNames?: string[],
 * }} props
 */
export default function QuotePhotosAdminSection({
  quoteRef,
  jobId,
  quoteRow = null,
  linkedJob = null,
  legacyPhotoFileNames = [],
}) {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [fetchDebug, setFetchDebug] = useState(null)

  const legacyNames = Array.isArray(legacyPhotoFileNames)
    ? legacyPhotoFileNames.map((n) => String(n).trim()).filter(Boolean)
    : []

  const lookupKey = [
    quoteRow?.id ?? '',
    quoteRef ?? '',
    jobId ?? '',
    linkedJob?.id ?? '',
  ].join('|')

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setPhotos([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        const { rows, debug } = await fetchJobPhotosForAdminLookup({
          quoteRef,
          jobId,
          quoteRow,
          linkedJob,
        })
        const withUrls = await attachSignedUrlsToJobPhotos(rows)
        const signedOk = withUrls.filter((p) => p.signedUrl).length
        const signedFailed = withUrls.filter((p) => p.storage_path && !p.signedUrl).length
        const mergedDebug = {
          ...debug,
          signed_url_ok: signedOk,
          signed_url_failed: signedFailed,
        }
        if (!cancelled) {
          setFetchDebug(mergedDebug)
          setPhotos(withUrls)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Could not load photos.')
          setPhotos([])
          setFetchDebug({
            quote_id: quoteRow?.id ?? null,
            quote_ref: quoteRef ?? quoteRow?.quote_ref ?? null,
            job_id: jobId ?? linkedJob?.id ?? null,
            empty_reason: err?.message || 'Fetch failed',
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [lookupKey, quoteRef, jobId, quoteRow, linkedJob])

  if (!isSupabaseConfigured) return null

  const signedUrlFailures = photos.filter((p) => p.storage_path && !p.signedUrl)

  if (loading) {
    return (
      <section className={cardShell}>
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4 sm:px-6">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Photos</h3>
          <p className="mt-0.5 text-sm text-slate-600">Loading…</p>
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className={cardShell}>
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4 sm:px-6">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Photos</h3>
        </div>
        <p className="p-5 text-sm text-amber-800 sm:p-6">{error}</p>
      </section>
    )
  }

  const devEmptyHint =
    import.meta.env.DEV && fetchDebug?.empty_reason ? String(fetchDebug.empty_reason) : null

  if (!photos.length) {
    return (
      <section className={cardShell}>
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4 sm:px-6">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Photos</h3>
          <p className="mt-0.5 text-sm font-semibold text-slate-800">Customer & job images</p>
        </div>
        {legacyNames.length > 0 ? (
          <p className="p-5 text-sm text-amber-900 sm:p-6">
            Photos were selected by customer ({legacyNames.length} file
            {legacyNames.length === 1 ? '' : 's'}: {legacyNames.join(', ')}), but no image records were found in{' '}
            <span className="font-mono text-xs">job_photos</span> or the{' '}
            <span className="font-mono text-xs">quote-photos</span> bucket for this job&apos;s quote reference.
          </p>
        ) : (
          <p className="p-5 text-sm text-slate-500 sm:p-6">No photos uploaded for this job.</p>
        )}
        {devEmptyHint ? (
          <p className="border-t border-amber-100 bg-amber-50/90 px-5 py-3 font-mono text-[11px] leading-relaxed text-amber-950 sm:px-6">
            <span className="font-semibold">[dev] Photo lookup:</span> {devEmptyHint}
            {fetchDebug?.via ? ` · via ${fetchDebug.via}` : ''}
            {Array.isArray(fetchDebug?.tables_queried) && fetchDebug.tables_queried.length > 0
              ? ` · queried: ${fetchDebug.tables_queried.join('; ')}`
              : ''}
          </p>
        ) : null}
      </section>
    )
  }

  return (
    <>
      <section className={cardShell}>
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4 sm:px-6">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Photos</h3>
          <p className="mt-0.5 text-sm font-semibold text-slate-800">
            {photos.length} file{photos.length === 1 ? '' : 's'}
          </p>
        </div>
        {signedUrlFailures.length > 0 ? (
          <p className="border-b border-amber-100 bg-amber-50/80 px-5 py-3 text-sm text-amber-900 sm:px-6">
            {signedUrlFailures.length} photo{signedUrlFailures.length === 1 ? '' : 's'} could not be previewed
            (signed URL failed). Check storage permissions for the{' '}
            <span className="font-mono text-xs">quote-photos</span> bucket or try refreshing this page.
          </p>
        ) : null}
        <div className="p-5 sm:p-6">
          <JobPhotoThumbGrid photos={photos} />
        </div>
      </section>
    </>
  )
}
