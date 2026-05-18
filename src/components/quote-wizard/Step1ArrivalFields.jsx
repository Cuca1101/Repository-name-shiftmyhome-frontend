import {
  HALF_HOUR_SLOTS_TO_20,
  halfHourSlotsAfter,
} from '../../lib/arrivalTimeSlots'

const FLEX_VALUE = 'flex_window'

const OPTIONS = [
  {
    value: FLEX_VALUE,
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
  'min-h-[48px] w-full max-w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 sm:text-sm'
const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700'
const optionBtn =
  'flex w-full items-center gap-3 rounded-xl border-0 bg-transparent px-3 py-3 text-left shadow-none'

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

function currentMode(data) {
  if (data.arrivalWindow === 'exact') return 'exact'
  if (data.arrivalWindow === FLEX_VALUE) return FLEX_VALUE
  return ''
}

/**
 * Inline preferred arrival fields (desktop Step 1).
 * @param {{ data: object, onChange: (next: object) => void, error?: string }} props
 */
export default function Step1ArrivalFields({ data, onChange, error = '' }) {
  const mode = currentMode(data)
  const untilSlots = halfHourSlotsAfter(data.flexibleArrivalFrom)

  function selectMode(next) {
    if (next === 'exact') {
      onChange({
        ...data,
        arrivalWindow: 'exact',
        flexibleArrivalFrom: '',
        flexibleArrivalUntil: '',
      })
      return
    }
    onChange({
      ...data,
      arrivalWindow: FLEX_VALUE,
      exactArrivalTime: '',
    })
  }

  function onFlexibleFromChange(from) {
    const patch = { ...data, flexibleArrivalFrom: from }
    if (
      data.flexibleArrivalUntil &&
      from &&
      !halfHourSlotsAfter(from).includes(data.flexibleArrivalUntil)
    ) {
      patch.flexibleArrivalUntil = ''
    }
    onChange(patch)
  }

  return (
    <div className="min-w-0 space-y-3">
      <div>
        <span className={labelClass}>Preferred arrival window</span>
        <p className="text-xs leading-relaxed text-slate-600">
          Choose a flexible collection window or an exact arrival time (30-minute slots, 08:00–20:00).
        </p>
      </div>

      <div className="space-y-3" role="radiogroup" aria-label="Preferred arrival time">
        {OPTIONS.map((opt) => {
          const selected = mode === opt.value
          return (
            <div
              key={opt.value}
              className={`rounded-xl border transition ${
                selected
                  ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-500/25'
                  : 'border-slate-200 bg-white shadow-sm'
              }`}
            >
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => selectMode(opt.value)}
                className={optionBtn}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900">{opt.title}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{opt.sub}</span>
                </span>
                <RadioIndicator selected={selected} />
              </button>

              {selected && opt.value === FLEX_VALUE ? (
                <div className="grid gap-3 border-t border-brand-100/80 px-3 pb-3 pt-2 sm:grid-cols-2">
                  <label className="block min-w-0">
                    <span className={labelClass}>Flexible from</span>
                    <select
                      value={data.flexibleArrivalFrom || ''}
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
                      value={data.flexibleArrivalUntil || ''}
                      onChange={(e) =>
                        onChange({ ...data, flexibleArrivalUntil: e.target.value })
                      }
                      className={selectClass}
                      disabled={!data.flexibleArrivalFrom}
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
                  <label className="block min-w-0 sm:max-w-xs">
                    <span className={labelClass}>Exact arrival time</span>
                    <select
                      value={data.exactArrivalTime || ''}
                      onChange={(e) => onChange({ ...data, exactArrivalTime: e.target.value })}
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

      {error ? (
        <p className="text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

