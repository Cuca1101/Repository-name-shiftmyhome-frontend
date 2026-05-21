/**
 * Mobile-friendly inline quantity: Add when 0, otherwise [−] qty [+].
 */
export default function InlineInventoryQtyControl({
  quantity,
  onAdd,
  onDecrement,
  onIncrement,
  addLabel = 'Add',
  disabled = false,
  /** Smaller controls for mobile catalog rows (desktop sidebar uses default). */
  compact = false,
}) {
  const dec = compact
    ? 'inline-flex min-h-[36px] min-w-[36px] shrink-0 items-center justify-center rounded-lg border-2 border-slate-200 bg-white text-sm font-semibold leading-none text-slate-800 shadow-sm transition enabled:hover:border-brand-400 enabled:hover:bg-brand-50 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45'
    : 'inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-base font-semibold leading-none text-slate-800 shadow-sm transition enabled:hover:border-brand-400 enabled:hover:bg-brand-50 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-[48px] sm:min-w-[48px] sm:text-xl'
  const inc = compact
    ? dec
    : 'inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-base font-semibold leading-none text-slate-800 shadow-sm transition enabled:hover:border-brand-400 enabled:hover:bg-brand-50 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-[48px] sm:min-w-[48px] sm:text-xl'
  const addBtn = compact
    ? 'inline-flex min-h-[36px] min-w-[4rem] shrink-0 items-center justify-center rounded-lg bg-brand-600 px-2.5 text-xs font-bold text-white shadow-sm transition enabled:hover:bg-brand-700 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45'
    : 'inline-flex min-h-[44px] min-w-[4.5rem] shrink-0 items-center justify-center rounded-xl bg-brand-600 px-3 text-sm font-bold text-white shadow-sm transition enabled:hover:bg-brand-700 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-[48px] sm:min-w-[5.5rem] sm:px-4'

  if (!quantity || quantity <= 0) {
    return (
      <button type="button" onClick={onAdd} disabled={disabled} className={addBtn}>
        {addLabel}
      </button>
    )
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
      <button type="button" onClick={onDecrement} disabled={disabled} className={dec} aria-label="Decrease quantity">
        −
      </button>
      <span
        className={
          compact
            ? 'min-w-[1.75rem] text-center text-sm font-bold tabular-nums text-slate-900'
            : 'min-w-[2.75rem] text-center text-base font-bold tabular-nums text-slate-900'
        }
      >
        {quantity}
      </span>
      <button type="button" onClick={onIncrement} disabled={disabled} className={inc} aria-label="Increase quantity">
        +
      </button>
    </div>
  )
}
