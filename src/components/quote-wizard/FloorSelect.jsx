import { useEffect, useId, useRef, useState } from 'react'

export const FLOOR_OPTIONS = [
  { value: -1, label: 'Basement' },
  { value: 0, label: 'Ground floor' },
  { value: 1, label: '1st' },
  { value: 2, label: '2nd' },
  { value: 3, label: '3rd' },
  { value: 4, label: '4th' },
  { value: 5, label: '5th+' },
]

const PLACEHOLDER = 'Choose floor'

/**
 * @param {number | null | undefined} n
 */
export function formatFloorLabel(n) {
  if (n == null) return '—'
  const o = FLOOR_OPTIONS.find((x) => x.value === n)
  return o ? o.label : String(n)
}

/** Lift question only when floor is above ground (1st+). */
export function floorNeedsLiftQuestion(floor) {
  return floor != null && Number(floor) > 0
}

const labelClass =
  'mb-1 block text-xs font-medium leading-snug text-slate-700 sm:mb-1.5 sm:text-sm'

const triggerBase =
  'box-border flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-sm shadow-sm outline-none transition sm:h-12 sm:rounded-xl sm:px-4 sm:text-base'

const triggerInteractive =
  'hover:border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25'

export default function FloorSelect({ label: labelText, value, onChange }) {
  const id = useId()
  const listboxId = `${id}-listbox`
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  const selected = FLOOR_OPTIONS.find((o) => o.value === value)
  const display = selected ? selected.label : PLACEHOLDER

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (v) => {
    onChange(v)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative box-border min-w-0 w-full">
      <label className={labelClass} htmlFor={id} id={`${id}-label`}>
        {labelText}
      </label>
      <button
        type="button"
        id={id}
        className={`${triggerBase} ${triggerInteractive} ${selected ? 'text-slate-900' : 'text-slate-500'}`}
        aria-haspopup="listbox"
        aria-expanded={open}
          aria-controls={listboxId}
          aria-labelledby={`${id}-label`}
          onClick={() => setOpen((o) => !o)}
      >
        <span className="min-w-0 truncate">{display}</span>
        <svg
          className={`h-5 w-5 shrink-0 text-slate-500 transition ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-labelledby={`${id}-label`}
          className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {FLOOR_OPTIONS.map((o) => {
            const isSelected = value === o.value
            return (
              <li key={o.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`flex w-full cursor-pointer items-center px-3 py-2 text-left text-sm text-slate-800 transition hover:bg-slate-50 sm:px-4 sm:py-2.5 ${
                    isSelected ? 'bg-brand-50 font-medium text-brand-900' : ''
                  }`}
                  onClick={() => pick(o.value)}
                >
                  {o.label}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
