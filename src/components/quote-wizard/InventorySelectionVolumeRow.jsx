const STEP = 0.05
const MIN = 0.01

function roundM3(n) {
  return Math.round(Math.max(MIN, n) * 100) / 100
}

/**
 * “Your selection” row: qty, per-unit m³ with − / + / input, line volume, reset.
 */
export default function InventorySelectionVolumeRow({
  name,
  isCustom,
  quantity,
  perUnitM3,
  defaultPerUnitM3,
  multiplier = 1,
  disabled = false,
  onPerUnitM3Change,
  onResetDefault,
}) {
  const mult = Number(multiplier) > 0 ? Number(multiplier) : 1
  const lineVol = quantity * perUnitM3 * mult
  const def = Math.max(MIN, Number(defaultPerUnitM3) || MIN)
  const canReset = Math.abs(perUnitM3 - def) > 0.001

  function bump(delta) {
    onPerUnitM3Change(roundM3(perUnitM3 + delta))
  }

  return (
    <li className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm ring-1 ring-slate-100">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-snug text-slate-900">{name}</p>
          {isCustom && (
            <span className="mt-0.5 inline-block text-xs font-normal text-slate-500">(custom)</span>
          )}
        </div>
        <p className="shrink-0 text-sm text-slate-600">
          Qty:{' '}
          <span className="font-semibold tabular-nums text-slate-900">{quantity}</span>
        </p>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <span className="text-xs font-medium text-slate-600">Volume each</span>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={disabled || perUnitM3 <= MIN + 1e-9}
              onClick={() => bump(-STEP)}
              className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-lg font-semibold text-slate-800 shadow-sm transition enabled:hover:border-brand-400 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Decrease volume per item"
            >
              −
            </button>
            <input
              type="number"
              min={MIN}
              step={0.01}
              disabled={disabled}
              value={Number.isFinite(perUnitM3) ? perUnitM3 : MIN}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                if (!Number.isFinite(v)) return
                onPerUnitM3Change(roundM3(v))
              }}
              className="min-h-[44px] w-[6.5rem] rounded-xl border-2 border-slate-200 px-2 py-2 text-center text-base font-semibold tabular-nums text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-100"
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => bump(STEP)}
              className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-lg font-semibold text-slate-800 shadow-sm transition hover:border-brand-400 active:scale-[0.98] disabled:opacity-50"
              aria-label="Increase volume per item"
            >
              +
            </button>
            <span className="text-sm font-medium text-slate-700">m³</span>
          </div>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <p className="text-xs font-medium text-slate-500">Line volume</p>
          <p className="text-lg font-bold tabular-nums text-brand-800">{lineVol.toFixed(2)} m³</p>
          <button
            type="button"
            disabled={disabled || !canReset}
            onClick={onResetDefault}
            className="text-xs font-semibold text-brand-700 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reset to default volume
          </button>
        </div>
      </div>
    </li>
  )
}
