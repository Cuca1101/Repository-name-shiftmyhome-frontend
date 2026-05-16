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
}) {
  const dec =
    'inline-flex min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-xl font-semibold leading-none text-slate-800 shadow-sm transition enabled:hover:border-brand-400 enabled:hover:bg-brand-50 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45'
  const inc =
    'inline-flex min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-xl font-semibold leading-none text-slate-800 shadow-sm transition enabled:hover:border-brand-400 enabled:hover:bg-brand-50 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45'
  const addBtn =
    'inline-flex min-h-[48px] min-w-[5.5rem] shrink-0 items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-bold text-white shadow-sm transition enabled:hover:bg-brand-700 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45'

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
      <span className="min-w-[2.75rem] text-center text-base font-bold tabular-nums text-slate-900">
        {quantity}
      </span>
      <button type="button" onClick={onIncrement} disabled={disabled} className={inc} aria-label="Increase quantity">
        +
      </button>
    </div>
  )
}
