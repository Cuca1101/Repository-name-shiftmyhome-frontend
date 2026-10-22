import { useEffect, useState } from 'react'
import { formatDateTimeUK } from '../../lib/formatDateDisplay'
import { resolveJobPhotoDisplayMeta } from '../../lib/jobPhotoDisplayMeta'

function photoSrc(photo) {
  return String(photo?.signedUrl || photo?.signed_url || '').trim()
}

function photoTime(photo, meta) {
  const raw = photo?.metadata && typeof photo.metadata === 'object' ? photo.metadata : {}
  const iso = raw.captured_at || raw.signedAt || raw.waiverSignedAt || photo?.created_at || ''
  const formatted = iso ? formatDateTimeUK(iso) : ''
  if (formatted && formatted !== '—') return formatted
  return meta?.capturedAtDisplay || ''
}

/**
 * Small job photos with the capture time. A click opens the full image.
 * @param {{ photos?: Array<Record<string, unknown>> }} props
 */
export default function JobPhotoThumbGrid({ photos = [] }) {
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    if (!preview) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') setPreview(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [preview])

  if (!photos.length) return null

  return (
    <>
      <ul className="flex flex-wrap gap-3">
        {photos.map((photo) => {
          const meta = resolveJobPhotoDisplayMeta(photo.metadata, photo)
          const src = photoSrc(photo)
          const fileName = photo.file_name != null ? String(photo.file_name) : 'Photo'
          const title = meta.displayTitle || fileName
          const time = photoTime(photo, meta)
          const key = String(photo.id || photo.storage_path || fileName)
          return (
            <li key={key} className="w-[92px]">
              <button
                type="button"
                className="relative block h-[92px] w-[92px] overflow-hidden rounded-lg border border-slate-200 bg-slate-100 text-left"
                onClick={() => src && setPreview({ src, title, time, signerName: meta.signerName })}
                disabled={!src}
                aria-label={src ? `Open ${title}${time ? `, ${time}` : ''}` : `Preview unavailable: ${title}`}
              >
                {src ? (
                  <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <span className="flex h-full items-center justify-center px-1 text-center text-[10px] text-slate-500">
                    No preview
                  </span>
                )}
                {time ? (
                  <span className="absolute inset-x-0 bottom-0 bg-slate-950/70 px-1 py-0.5 text-[9px] font-semibold leading-tight text-white">
                    {time}
                  </span>
                ) : null}
              </button>
              <p className="mt-1 truncate text-[10px] font-semibold text-slate-800" title={title}>
                {title}
              </p>
              {meta.signerName ? (
                <p className="truncate text-[10px] font-semibold text-slate-700" title={`Signed by ${meta.signerName}`}>
                  Signed by {meta.signerName}
                </p>
              ) : null}
            </li>
          )
        })}
      </ul>

      {preview ? (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={preview.title || 'Photo'}
          onClick={() => setPreview(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/20"
            onClick={() => setPreview(null)}
          >
            Close
          </button>
          <figure className="flex max-h-[90vh] max-w-full flex-col items-center gap-2" onClick={(event) => event.stopPropagation()}>
            <img src={preview.src} alt={preview.title} className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl" />
            <figcaption className="max-w-lg text-center text-sm text-white">
              <span className="font-semibold">{preview.title}</span>
              {preview.time ? <span> · {preview.time}</span> : null}
              {preview.signerName ? <span className="block">Signed by {preview.signerName}</span> : null}
            </figcaption>
          </figure>
        </div>
      ) : null}
    </>
  )
}
