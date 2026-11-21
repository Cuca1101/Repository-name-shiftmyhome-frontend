import { useState } from 'react'
import { generateJobSheetPdf, previewJobSheetPdf, JOB_SHEET_PDF_ERROR } from '../../utils/generateJobSheetPdf'
import { mergedAdminWorkflowForQuote } from '../../lib/quoteAdminWorkflowMerge'

/**
 * @param {{
 *   quote: Record<string, unknown> | null,
 *   internalNotes?: string,
 *   className?: string,
 *   onSuccess?: (message: string) => void,
 *   onError?: (message: string) => void,
 * }} props
 */
export default function GenerateJobSheetButton({
  quote,
  internalNotes = '',
  className = '',
  onSuccess,
  onError,
}) {
  const [busy, setBusy] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')

  if (!quote || !quote.id) return null

  function sheetOptions() {
    const overrides = mergedAdminWorkflowForQuote(quote)
    const adjSum = (overrides.adjustments || []).reduce((sum, row) => sum + (Number(row.amountGbp) || 0), 0)
    return {
      internalNotes: internalNotes || overrides.internalNotes || '',
      adjustmentsSumGbp: adjSum,
    }
  }

  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl('')
  }

  async function run(action) {
    setBusy(action)
    try {
      if (action === 'preview') {
        const url = await previewJobSheetPdf(quote, sheetOptions())
        setPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current)
          return url
        })
      } else {
        await generateJobSheetPdf(quote, sheetOptions())
        onSuccess?.('Job sheet PDF downloaded.')
      }
    } catch (e) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('[GenerateJobSheetButton]', e)
      }
      onError?.(e?.message || JOB_SHEET_PDF_ERROR)
    } finally {
      setBusy('')
    }
  }

  const buttonClass =
    className ||
    'inline-flex min-h-[28px] items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <>
      <span className="inline-flex flex-wrap items-center justify-end gap-1">
        <button type="button" disabled={Boolean(busy)} onClick={() => void run('preview')} className={buttonClass}>
          {busy === 'preview' ? 'Opening…' : 'Preview job sheet'}
        </button>
        <button type="button" disabled={Boolean(busy)} onClick={() => void run('download')} className={buttonClass}>
          {busy === 'download' ? 'Downloading…' : 'Download job sheet'}
        </button>
      </span>
      {previewUrl ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-3 sm:p-6">
          <div className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2">
              <p className="text-sm font-semibold text-slate-900">Job sheet</p>
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                  onClick={() => void run('download')}
                >
                  Download
                </button>
                <button
                  type="button"
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  onClick={closePreview}
                >
                  Close
                </button>
              </span>
            </div>
            <iframe title="Job sheet preview" src={previewUrl} className="h-full w-full bg-slate-100" />
          </div>
        </div>
      ) : null}
    </>
  )
}
