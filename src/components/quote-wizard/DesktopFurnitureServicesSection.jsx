import { Minus, Plus } from 'lucide-react'
import { reassemblySameAsDismantlingPatch } from '../../lib/quoteWizardReassembly'

const optionBtn =
  'flex min-h-[44px] w-full items-center rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-45'
const optionSelected = 'border-brand-500 bg-brand-50 text-brand-900 ring-1 ring-brand-500/20'
const optionIdle = 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'

function DesktopQtyStepper({ value, onChange, disabled }) {
  const n = Math.max(0, Number(value) || 0)
  const btn =
    'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-800 shadow-sm transition hover:border-brand-400 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40'
  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={disabled || n <= 0}
        onClick={() => onChange(n - 1)}
        className={btn}
        aria-label="Decrease quantity"
      >
        <Minus className="h-4 w-4" strokeWidth={2.5} />
      </button>
      <span className="min-w-[2rem] text-center text-base font-bold tabular-nums text-slate-900">{n}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(n + 1)}
        className={btn}
        aria-label="Increase quantity"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
      </button>
    </div>
  )
}

function YesNoChoice({ value, onChange }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      {[
        { v: false, label: 'No' },
        { v: true, label: 'Yes' },
      ].map((opt) => (
        <button
          key={opt.label}
          type="button"
          role="radio"
          aria-checked={value === opt.v}
          onClick={() => onChange(opt.v)}
          className={`${optionBtn} justify-center ${
            value === opt.v ? optionSelected : optionIdle
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Desktop Step 3 dismantling / reassembly UI (md+ only).
 * Mirrors mobile behaviour and state; desktop styling only.
 */
export default function DesktopFurnitureServicesSection({ data, onChange, input, label }) {
  const assemblyMode = !data.reassembly ? 'none' : data.reassemblySameAsDismantling ? 'same' : 'different'

  function set(patch) {
    onChange({ ...data, ...patch })
  }

  function setAssemblyMode(mode) {
    if (mode === 'none') {
      set({ reassembly: false, reassemblySameAsDismantling: false, reassemblyItemCount: 0 })
      return
    }
    if (mode === 'same') {
      set({
        reassembly: true,
        reassemblySameAsDismantling: true,
        ...reassemblySameAsDismantlingPatch({
          ...data,
          reassembly: true,
          reassemblySameAsDismantling: true,
        }),
      })
      return
    }
    set({ reassembly: true, reassemblySameAsDismantling: false })
  }

  function setDismantlingYes(yes) {
    if (!yes) {
      set({
        dismantling: false,
        dismantlingItemCount: 0,
        dismantlingWhat: '',
        ...(data.reassemblySameAsDismantling
          ? { reassembly: false, reassemblySameAsDismantling: false }
          : {}),
      })
      return
    }
    set({ dismantling: true })
  }

  const subPanel = 'mt-3 space-y-3 rounded-xl border border-brand-100 bg-brand-50/30 p-4 sm:p-5'

  return (
    <>
      <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
        <p className="text-sm font-bold text-slate-900">Do you need help dismantling furniture?</p>
        <YesNoChoice value={Boolean(data.dismantling)} onChange={setDismantlingYes} />
        {data.dismantling ? (
          <div className={subPanel}>
            <div>
              <p className={label}>How many items need dismantling?</p>
              <div className="mt-2">
                <DesktopQtyStepper
                  value={data.dismantlingItemCount ?? 0}
                  onChange={(n) => {
                    const patch = { dismantlingItemCount: n }
                    if (data.reassemblySameAsDismantling) {
                      Object.assign(
                        patch,
                        reassemblySameAsDismantlingPatch({
                          ...data,
                          dismantlingItemCount: n,
                        }),
                      )
                    }
                    set(patch)
                  }}
                />
              </div>
            </div>
            <label className="block">
              <span className={label}>Which items need dismantling? (optional)</span>
              <input
                type="text"
                value={data.dismantlingWhat ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  const patch = { dismantlingWhat: v }
                  if (data.reassemblySameAsDismantling) {
                    Object.assign(
                      patch,
                      reassemblySameAsDismantlingPatch({ ...data, dismantlingWhat: v }),
                    )
                  }
                  set(patch)
                }}
                className={input}
                placeholder="e.g. wardrobe, bed frame, dining table"
              />
            </label>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
        <p className="text-sm font-bold text-slate-900">Do you need help assembling furniture?</p>
        <div className="mt-3 space-y-2">
          {[
            { id: 'none', label: 'No' },
            { id: 'same', label: 'Yes, same items as dismantling', disabled: !data.dismantling },
            { id: 'different', label: 'Yes, different items' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={opt.disabled}
              onClick={() => setAssemblyMode(opt.id)}
              className={`${optionBtn} ${
                assemblyMode === opt.id ? optionSelected : optionIdle
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {assemblyMode === 'different' ? (
          <div className={subPanel}>
            <div>
              <p className={label}>How many items need assembling?</p>
              <div className="mt-2">
                <DesktopQtyStepper
                  value={data.reassemblyItemCount ?? 0}
                  onChange={(n) => set({ reassemblyItemCount: n })}
                />
              </div>
            </div>
            <label className="block">
              <span className={label}>Which items need assembling?</span>
              <input
                type="text"
                value={data.reassemblyWhat ?? ''}
                onChange={(e) => set({ reassemblyWhat: e.target.value })}
                className={input}
                placeholder="e.g. wardrobe, bed frame, shelving unit"
              />
            </label>
          </div>
        ) : null}
      </div>
    </>
  )
}
