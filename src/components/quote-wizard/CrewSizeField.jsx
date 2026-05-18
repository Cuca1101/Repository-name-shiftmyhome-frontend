import { User, Users } from 'lucide-react'

const input =
  'min-h-[48px] w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25'
const labelCls = 'mb-1.5 block text-sm font-medium text-slate-700'

const MOBILE_CREW_META = {
  1: { hint: 'Small items', Icon: User },
  2: { hint: 'Standard move', Icon: Users },
  3: { hint: 'Large/heavy', Icon: Users },
}

function buildCrewOptions(crewSettings) {
  return [
    { value: 1, label: '1 Man', enabled: Boolean(crewSettings?.crewSizeOneEnabled ?? true) },
    { value: 2, label: '2 Men', enabled: Boolean(crewSettings?.crewSizeTwoEnabled ?? true) },
    { value: 3, label: '3 Men', enabled: Boolean(crewSettings?.crewSizeThreeEnabled ?? true) },
    { value: 4, label: '4 Men', enabled: Boolean(crewSettings?.crewSizeFourEnabled) },
  ].filter((o) => o.enabled)
}

export default function CrewSizeField({
  id = 'quote-crew-size',
  value,
  onChange,
  crewSettings,
  descriptionId,
}) {
  const crewOptions = buildCrewOptions(crewSettings)
  const finalCrewOptions = crewOptions.length > 0 ? crewOptions : [{ value: 2, label: '2 Men', enabled: true }]
  const mobileCrewOptions = finalCrewOptions.filter((o) => o.value >= 1 && o.value <= 3)
  const labelId = `${id}-label`

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <span className={`${labelCls} md:hidden`} id={labelId}>
        Crew size (required for pricing)
      </span>
      <label className={`${labelCls} hidden md:block`} htmlFor={id}>
        Crew size (required for pricing)
      </label>

      <div
        className="md:hidden"
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
      >
        <div className="grid grid-cols-3 gap-2">
          {mobileCrewOptions.map((o) => {
            const selected = Number(value) === o.value
            const meta = MOBILE_CREW_META[o.value]
            const Icon = meta?.Icon ?? Users
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange(o.value)}
                className={`relative flex min-h-[88px] flex-col items-center justify-center rounded-xl border px-1.5 py-2.5 text-center shadow-sm transition duration-200 active:scale-[0.97] ${
                  selected
                    ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/25'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                {selected ? (
                  <span
                    className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-white"
                    aria-hidden
                  >
                    <svg className="h-2.5 w-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                ) : null}
                <Icon
                  className={`h-5 w-5 ${selected ? 'text-brand-600' : 'text-slate-500'}`}
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="mt-1.5 text-xs font-bold leading-tight text-slate-900">{o.label}</span>
                <span className="mt-0.5 text-[10px] leading-tight text-slate-500">{meta?.hint}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="hidden md:block">
        <select
          id={id}
          aria-describedby={descriptionId}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          className={input}
          required
        >
          <option value="">Select crew size</option>
          {finalCrewOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <p id={descriptionId} className="mt-2 text-xs text-slate-600">
        Crew size affects loading time and your quote. Choose before continuing — you can change it
        here anytime on this step.
      </p>
    </div>
  )
}
