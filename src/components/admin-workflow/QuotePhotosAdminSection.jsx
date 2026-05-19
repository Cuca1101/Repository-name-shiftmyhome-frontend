import { useEffect, useState } from 'react'

import { attachSignedUrlsToJobPhotos, fetchJobPhotosForAdmin } from '../../lib/data/jobPhotosRepository'

import { isSupabaseConfigured } from '../../lib/supabase'



const cardShell =

  'overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]'



/**

 * @param {{ quoteRef?: string|null, jobId?: string|null, legacyPhotoFileNames?: string[] }} props

 */

export default function QuotePhotosAdminSection({ quoteRef, jobId, legacyPhotoFileNames = [] }) {

  const [photos, setPhotos] = useState([])

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState(null)



  const ref = quoteRef != null ? String(quoteRef).trim() : ''

  const jid = jobId != null ? String(jobId).trim() : ''

  const legacyNames = Array.isArray(legacyPhotoFileNames)

    ? legacyPhotoFileNames.map((n) => String(n).trim()).filter(Boolean)

    : []



  useEffect(() => {

    if (!isSupabaseConfigured || (!ref && !jid)) {

      setPhotos([])

      setLoading(false)

      return

    }



    let cancelled = false

    setLoading(true)

    setError(null)



    ;(async () => {

      try {

        const rows = await fetchJobPhotosForAdmin(ref, jid || null)

        const withUrls = await attachSignedUrlsToJobPhotos(rows)

        if (!cancelled) setPhotos(withUrls)

      } catch (err) {

        if (!cancelled) {

          setError(err?.message || 'Could not load photos.')

          setPhotos([])

        }

      } finally {

        if (!cancelled) setLoading(false)

      }

    })()



    return () => {

      cancelled = true

    }

  }, [ref, jid])



  if (!isSupabaseConfigured || (!ref && !jid)) return null



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



  if (!photos.length) {

    return (

      <section className={cardShell}>

        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4 sm:px-6">

          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Photos</h3>

          <p className="mt-0.5 text-sm font-semibold text-slate-800">Customer & job images</p>

        </div>

        {legacyNames.length > 0 ? (

          <p className="p-5 text-sm text-amber-900 sm:p-6">

            Photos were selected by customer, but files were not stored for this older quote.

          </p>

        ) : (

          <p className="p-5 text-sm text-slate-500 sm:p-6">No photos uploaded.</p>

        )}

      </section>

    )

  }



  return (

    <section className={cardShell}>

      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4 sm:px-6">

        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Photos</h3>

        <p className="mt-0.5 text-sm font-semibold text-slate-800">

          {photos.length} file{photos.length === 1 ? '' : 's'}

        </p>

      </div>

      {signedUrlFailures.length > 0 ? (

        <p className="border-b border-amber-100 bg-amber-50/80 px-5 py-3 text-sm text-amber-900 sm:px-6">

          {signedUrlFailures.length} photo{signedUrlFailures.length === 1 ? '' : 's'} could not be

          previewed (signed URL failed). Check storage permissions for the{' '}

          <span className="font-mono text-xs">quote-photos</span> bucket or try refreshing this page.

        </p>

      ) : null}

      <ul className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">

        {photos.map((photo) => {

          const label = photo.source_label != null ? String(photo.source_label) : 'Added by customer'

          const fileName = photo.file_name != null ? String(photo.file_name) : 'Photo'

          const signedUrl = photo.signedUrl != null ? String(photo.signedUrl) : ''

          const signedUrlError =

            photo.signedUrlError != null ? String(photo.signedUrlError) : ''

          return (

            <li

              key={String(photo.id)}

              className="flex flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-slate-50/50"

            >

              <div className="relative aspect-[4/3] bg-slate-100">

                {signedUrl ? (

                  <img

                    src={signedUrl}

                    alt=""

                    className="h-full w-full object-cover"

                    loading="lazy"

                  />

                ) : (

                  <div className="flex h-full flex-col items-center justify-center gap-1 px-3 text-center text-xs text-slate-600">

                    <span>Preview unavailable</span>

                    {signedUrlError ? (

                      <span className="text-[10px] text-amber-800">{signedUrlError}</span>

                    ) : null}

                  </div>

                )}

              </div>

              <div className="flex flex-1 flex-col gap-2 p-3">

                <p className="truncate text-sm font-medium text-slate-900" title={fileName}>

                  {fileName}

                </p>

                <span className="inline-flex w-fit rounded-md bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-900">

                  {label}

                </span>

                {signedUrl ? (

                  <a

                    href={signedUrl}

                    target="_blank"

                    rel="noopener noreferrer"

                    download={fileName}

                    className="mt-auto text-sm font-semibold text-brand-700 hover:underline"

                  >

                    View / download

                  </a>

                ) : null}

              </div>

            </li>

          )

        })}

      </ul>

    </section>

  )

}


