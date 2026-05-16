import { useEffect } from 'react'
import { useCoverageModal } from '../../context/CoverageModalContext'
import NetworkCoverageMap from './NetworkCoverageMap'

export default function CoverageModal() {
  const { open, closeModal } = useCoverageModal()

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') closeModal()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, closeModal])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-stretch justify-center sm:items-center sm:p-4 sm:py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="coverage-modal-title"
    >
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]"
        aria-hidden
        onClick={closeModal}
      />

      <div
        className="relative z-[201] flex h-[100dvh] max-h-[100dvh] min-h-0 w-full max-w-full flex-col bg-white shadow-2xl sm:h-auto sm:max-h-[90vh] sm:max-w-4xl sm:rounded-2xl sm:ring-1 sm:ring-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-5">
          <div className="min-w-0 flex-1 pr-2">
            <h2 id="coverage-modal-title" className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Our UK Network Coverage
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">
              From Glasgow and central Scotland to hubs across the UK — pins show where we run removals regularly.
              Search your town or postcode to explore the area; request a quote and we&apos;ll confirm availability.
            </p>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-4 sm:px-6 sm:pb-6">
          <NetworkCoverageMap
            variant="modal"
            searchInputId="modal-coverage-search"
            statusLine="Live status · active service areas"
            isActive={open}
          />
        </div>
      </div>
    </div>
  )
}
