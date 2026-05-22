import { useCallback, useEffect, useState } from 'react'
import {
  HALF_HOUR_SLOTS_TO_20,
  halfHourSlotsAfter,
  isFlexibleWindowValid,
  isValidHalfHourSlot,
} from '../../lib/arrivalTimeSlots'
import { formatCompactArrivalLine } from '../../lib/emailQuotePayload'

const MOBILE_FLEX_VALUE = 'flex_window'

const OPTIONS = [
  {
    value: MOBILE_FLEX_VALUE,
    title: 'Flexible collection window',
    sub: 'Choose when we can collect.',
  },
  {
    value: 'exact',
    title: 'Exact arrival time',
    sub: 'Choose a specific arrival time. Premium option.',
  },
]

const selectClass =
  'box-border min-h-[38px] w-full min-w-0 max-w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm leading-snug text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25'
const labelClass = 'mb-1 block text-xs font-medium leading-snug text-slate-700'
const optionBtn =
  'flex min-h-[46px] w-full min-w-0 items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2.5 text-left shadow-sm transition'
function mobileMode(data) {
  if (data.arrivalWindow === 'exact') return 'exact'
  if (data.arrivalWindow === MOBILE_FLEX_VALUE) return MOBILE_FLEX_VALUE
  return ''
}

function draftFromData(data) {
  return {
    mode: mobileMode(data),
    flexibleArrivalFrom: data.flexibleArrivalFrom || '',
    flexibleArrivalUntil: data.flexibleArrivalUntil || '',
    exactArrivalTime: data.exactArrivalTime || '',
  }
}

function closedFieldLabel(data) {
  return formatCompactArrivalLine(data) || 'Choose arrival time'
}

function RadioIndicator({ selected }) {
  return (
    <span
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
        selected ? 'border-brand-600 bg-brand-600' : 'border-slate-300 bg-white'
      }`}
      aria-hidden
    >
      {selected ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
    </span>
  )
}

/**
 * Mobile Step 1 preferred arrival — compact field + bottom sheet editor.
 * @param {{ data: object, onChange: (next: object) => void, error?: string }} props
 */
export default function MobileStep1ArrivalWindow({ data, onChange, error = '' }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => draftFromData(data))
  const [saveError, setSaveError] = useState('')

  const untilSlots = halfHourSlotsAfter(draft.flexibleArrivalFrom)

  const openSheet = useCallback(() => {
    setDraft(draftFromData(data))
    setSaveError('')
    setOpen(true)
  }, [data])

  const closeSheet = useCallback(() => {
    setOpen(false)
    setSaveError('')
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e) {
      if (e.key === 'Escape') closeSheet()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, closeSheet])

  function selectMode(next) {
    if (next === 'exact') {
      setDraft({
        mode: 'exact',
        flexibleArrivalFrom: '',
        flexibleArrivalUntil: '',
        exactArrivalTime: draft.exactArrivalTime,
      })
      return
    }
    setDraft({
      mode: MOBILE_FLEX_VALUE,
      flexibleArrivalFrom: draft.flexibleArrivalFrom,
      flexibleArrivalUntil: draft.flexibleArrivalUntil,
      exactArrivalTime: '',
    })
  }

  function onFlexibleFromChange(from) {
    setDraft((d) => {
      const next = { ...d, flexibleArrivalFrom: from }
      if (d.flexibleArrivalUntil && from && !halfHourSlotsAfter(from).includes(d.flexibleArrivalUntil)) {
        next.flexibleArrivalUntil = ''
      }
      return next
    })
  }

  function handleSave() {
    setSaveError('')
    if (draft.mode === MOBILE_FLEX_VALUE) {
      if (!isFlexibleWindowValid(draft.flexibleArrivalFrom, draft.flexibleArrivalUntil)) {
        setSaveError('Please select both flexible from and until times (from must be earlier than until).')
        return
      }
      onChange({
        ...data,
        arrivalWindow: MOBILE_FLEX_VALUE,
        exactArrivalTime: '',
        flexibleArrivalFrom: draft.flexibleArrivalFrom,
        flexibleArrivalUntil: draft.flexibleArrivalUntil,
      })
      closeSheet()
      return
    }
    if (draft.mode === 'exact') {
      const t = (draft.exactArrivalTime || '').trim()
      if (!isValidHalfHourSlot(t)) {
        setSaveError('Please select your exact arrival time.')
        return
      }
      onChange({
        ...data,
        arrivalWindow: 'exact',
        flexibleArrivalFrom: '',
        flexibleArrivalUntil: '',
        exactArrivalTime: t,
      })
      closeSheet()
      return
    }
    setSaveError('Please choose a preferred arrival option.')
  }

  const displayLabel = closedFieldLabel(data)
  const isPlaceholder = displayLabel === 'Choose arrival time'

  return (
    <div className="box-border min-w-0 w-full space-y-1">
      <span className={labelClass} id="mobile-arrival-window-label">
        Preferred arrival window
      </span>

      <button
        type="button"
        onClick={openSheet}
        aria-labelledby="mobile-arrival-window-label"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="box-border flex min-h-[38px] w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left text-sm shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"
      >
        <span
          className={`min-w-0 flex-1 truncate text-sm leading-snug ${
            isPlaceholder ? 'text-slate-500' : 'font-medium text-slate-900'
          }`}
        >
          {displayLabel}
        </span>
        <svg
          className="h-5 w-5 shrink-0 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      {error ? (
        <p className="text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50"
            aria-label="Close arrival time picker"
            onClick={closeSheet}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="arrival-sheet-title"
            className="relative flex max-h-[min(92vh,640px)] w-full flex-col rounded-t-2xl bg-white shadow-[0_-8px_30px_rgba(15,23,42,0.12)]"
          >
            <div className="flex shrink-0 justify-center pt-3 pb-1" aria-hidden>
              <span className="h-1 w-10 rounded-full bg-slate-200" />
            </div>

            <div className="shrink-0 border-b border-slate-100 px-4 pb-3">
              <h2 id="arrival-sheet-title" className="text-lg font-bold text-slate-900">
                Preferred arrival time
              </h2>
              <p className="mt-1 text-sm leading-snug text-slate-600">
                Choose a flexible collection window or an exact arrival time.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
              <div className="space-y-3" role="radiogroup" aria-label="Preferred arrival time">
                {OPTIONS.map((opt) => {
                  const selected = draft.mode === opt.value
                  return (
                    <div
                      key={opt.value}
                      className={`rounded-xl border transition ${
                        selected
                          ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-500/25'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => selectMode(opt.value)}
                        className={`${optionBtn} border-0 bg-transparent shadow-none ${
                          selected ? 'rounded-b-none' : ''
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-slate-900">{opt.title}</span>
                          <span className="mt-0.5 block text-xs text-slate-500">{opt.sub}</span>
                        </span>
                        <RadioIndicator selected={selected} />
                      </button>

                      {selected && opt.value === MOBILE_FLEX_VALUE ? (
                        <div className="space-y-3 border-t border-brand-100/80 px-3 pb-3 pt-2">
                          <label className="block min-w-0">
                            <span className={labelClass}>Flexible from</span>
                            <select
                              value={draft.flexibleArrivalFrom}
                              onChange={(e) => onFlexibleFromChange(e.target.value)}
                              className={selectClass}
                            >
                              <option value="">Select time</option>
                              {HALF_HOUR_SLOTS_TO_20.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block min-w-0">
                            <span className={labelClass}>Flexible until</span>
                            <select
                              value={draft.flexibleArrivalUntil}
                              onChange={(e) =>
                                setDraft((d) => ({ ...d, flexibleArrivalUntil: e.target.value }))
                              }
                              className={selectClass}
                              disabled={!draft.flexibleArrivalFrom}
                            >
                              <option value="">Select time</option>
                              {untilSlots.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      ) : null}

                      {selected && opt.value === 'exact' ? (
                        <div className="space-y-2 border-t border-brand-100/80 px-3 pb-3 pt-2">
                          <label className="block min-w-0">
                            <span className={labelClass}>Exact arrival time</span>
                            <select
                              value={draft.exactArrivalTime}
                              onChange={(e) =>
                                setDraft((d) => ({ ...d, exactArrivalTime: e.target.value }))
                              }
                              className={selectClass}
                            >
                              <option value="">Select time</option>
                              {HALF_HOUR_SLOTS_TO_20.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </label>
                          <p className="text-xs leading-relaxed text-amber-900/90">
                            Exact time requests are subject to route availability. A premium applies on your
                            estimate at step 4.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>

              {saveError ? (
                <p className="mt-3 text-sm font-medium text-red-700" role="alert">
                  {saveError}
                </p>
              ) : null}
            </div>

            <div className="shrink-0 space-y-2 border-t border-slate-100 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={handleSave}
                className="min-h-[48px] w-full rounded-xl bg-gradient-to-r from-brand-600 to-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:from-brand-700 hover:to-emerald-700"
              >
                Save arrival time
              </button>
              <button
                type="button"
                onClick={closeSheet}
                className="min-h-[44px] w-full rounded-xl text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
