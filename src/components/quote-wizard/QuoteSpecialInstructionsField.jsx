import { applyWizardPatch } from '../../lib/wizardStateUpdate'
import { quoteMobileInput } from '../../lib/quoteMobileUiClasses'

/**
 * Step 3 special instructions, shown immediately after address confirmation.
 * @param {{
 *   data: Record<string, unknown>,
 *   onChange: (patch: Record<string, unknown>) => void,
 *   variant?: 'desktop' | 'mobile',
 * }} props
 */
export default function QuoteSpecialInstructionsField({ data, onChange, variant = 'desktop' }) {
  const isMobile = variant === 'mobile'
  const input = isMobile
    ? quoteMobileInput
    : 'w-full max-w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 sm:px-4 sm:py-3'

  return (
    <div
      className={
        isMobile
          ? 'box-border min-w-0 w-full rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm'
          : 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6'
      }
      data-quote-field="special-instructions"
    >
      <h3 className={`font-bold text-slate-900 ${isMobile ? 'text-xs' : 'text-sm'}`}>Special instructions</h3>
      <p className={`mt-1 text-slate-600 ${isMobile ? 'text-[11px] leading-snug' : 'text-sm'}`}>
        Fragile items, narrow access, parking, or anything the crew should know before they arrive.
      </p>
      <label className="mt-3 block">
        <span className="sr-only">Special instructions</span>
        <textarea
          rows={3}
          value={data.specialInstructions || ''}
          onChange={(e) => applyWizardPatch(onChange, { specialInstructions: e.target.value })}
          className={input}
          placeholder="e.g. fragile items, narrow access, parking restrictions..."
        />
      </label>
    </div>
  )
}
