import { useState } from 'react'
import { generateJobSheetPdf, JOB_SHEET_PDF_ERROR } from '../../utils/generateJobSheetPdf'
import { mergedAdminWorkflowForQuote } from '../../lib/quoteAdminWorkflowMerge'

/**
 * @param {{
 *   quote: Record<string, unknown> | null,
 *   internalNotes?: string,
 *   variant?: 'primary' | 'secondary' | 'menu',
 *   className?: string,
 *   onSuccess?: (message: string) => void,
 *   onError?: (message: string) => void,
 * }} props
 */
export default function GenerateJobSheetButton({
  quote,
  internalNotes = '',
  variant = 'primary',
  className = '',
  onSuccess,
  onError,
}) {
  const [busy, setBusy] = useState(false)

  if (!quote || !quote.id) return null

  async function handleClick() {
    setBusy(true)
    try {
      const overrides = mergedAdminWorkflowForQuote(quote)
      const adjSum = (overrides.adjustments || []).reduce((s, a) => s + (Number(a.amountGbp) || 0), 0)
      await generateJobSheetPdf(quote, {
        internalNotes: internalNotes || overrides.internalNotes || '',
        adjustmentsSumGbp: adjSum,
      })
      onSuccess?.('Job sheet PDF downloaded.')
    } catch (e) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('[GenerateJobSheetButton]', e)
      }
      onError?.(e?.message || JOB_SHEET_PDF_ERROR)
    } finally {
      setBusy(false)
    }
  }

  const base =
    variant === 'menu'
      ? 'block w-full px-4 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50'
      : variant === 'secondary'
        ? 'inline-flex min-h-[40px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
        : 'inline-flex min-h-[40px] items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void handleClick()}
      className={`${base} ${className}`.trim()}
      title="Download printable job sheet from quote data"
    >
      {busy ? 'Generating PDF…' : 'Generate Job Sheet PDF'}
    </button>
  )
}
