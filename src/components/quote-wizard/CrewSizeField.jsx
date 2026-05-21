import { User, Users } from 'lucide-react'

const labelCls = 'mb-1.5 block text-sm font-medium text-slate-700'

const MOBILE_CREW_META = {
  1: { hint: 'Small items' },
  2: { hint: 'Standard move' },
  3: { hint: 'Large/heavy' },
}

const DESKTOP_CREW_META = {
  1: { hint: 'Small moves & few items' },
  2: { hint: 'Standard home move' },
  3: { hint: 'Larger or heavier loads' },
  4: { hint: 'Maximum capacity' },
}

function buildCrewOptions(crewSettings) {
  return [
    { value: 1, label: '1 Man', enabled: Boolean(crewSettings?.crewSizeOneEnabled ?? true) },
    { value: 2, label: '2 Men', enabled: Boolean(crewSettings?.crewSizeTwoEnabled ?? true) },
    { value: 3, label: '3 Men', enabled: Boolean(crewSettings?.crewSizeThreeEnabled ?? true) },
    { value: 4, label: '4 Men', enabled: Boolean(crewSettings?.crewSizeFourEnabled) },
  ].filter((o) => o.enabled)
}

/**
 * @param {{ count: number, selected: boolean }} props
 */
function CrewPeopleIcon({ count, selected }) {
  const tone = selected ? 'text-brand-600' : 'text-slate-500'
  if (count === 1) {
    return <User className={`h-7 w-7 ${tone}`} strokeWidth={2} aria-hidden />
  }
  if (count === 2) {
    return <Users className={`h-7 w-7 ${tone}`} strokeWidth={2} aria-hidden />
  }
  const n = Math.min(4, Math.max(3, count))
  return (
    <span className={`inline-flex items-end justify-center ${tone}`} aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <User
          key={i}
          className={`h-5 w-5 ${i > 0 ? '-ml-2.5' : ''}`}
          strokeWidth={2}
        />
      ))}
    </span>
  )
}

function CrewOptionCard({ option, selected, onSelect, variant }) {
  const isDesktop = variant === 'desktop'
  const meta = isDesktop ? DESKTOP_CREW_META[option.value] : MOBILE_CREW_META[option.value]

  if (isDesktop) {
    return (
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={() => onSelect(option.value)}
        className={`relative flex min-h-[112px] flex-col items-center justify-center rounded-xl border px-4 py-4 text-center shadow-sm transition-all duration-200 ${
          selected
            ? 'border-brand-500 bg-brand-50/90 ring-2 ring-brand-500/30 shadow-md shadow-brand-500/10'
            : 'border-slate-200 bg-white hover:border-brand-200 hover:bg-slate-50/80'
        }`}
      >
        {selected ? (
          <span
            className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white shadow-sm"
            aria-hidden
          >
            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        ) : null}
        <span
          className={`mb-3 flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${
            selected ? 'bg-white ring-1 ring-brand-200/80' : 'bg-slate-50 ring-1 ring-slate-100'
          }`}
        >
          <CrewPeopleIcon count={option.value} selected={selected} />
        </span>
        <span className="text-sm font-bold leading-tight text-slate-900">{option.label}</span>
        {meta?.hint ? (
          <span className="mt-1 max-w-[9rem] text-xs leading-snug text-slate-500">{meta.hint}</span>
        ) : null}
      </button>
    )
  }

  const Icon = option.value === 1 ? User : Users
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(option.value)}
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
      <span className="mt-1.5 text-xs font-bold leading-tight text-slate-900">{option.label}</span>
      <span className="mt-0.5 text-[10px] leading-tight text-slate-500">{meta?.hint}</span>
    </button>
  )
}

export default function CrewSizeField({
  id = 'quote-crew-size',
  value,
  onChange,
  crewSettings,
  descriptionId,
  invalid = false,
}) {
  const crewOptions = buildCrewOptions(crewSettings)
  const finalCrewOptions = crewOptions.length > 0 ? crewOptions : [{ value: 2, label: '2 Men', enabled: true }]
  const mobileCrewOptions = finalCrewOptions.filter((o) => o.value >= 1 && o.value <= 3)
  const labelId = `${id}-label`
  const desktopGridCols =
    finalCrewOptions.length >= 4
      ? 'sm:grid-cols-2 lg:grid-cols-4'
      : finalCrewOptions.length === 2
        ? 'grid-cols-2'
        : 'grid-cols-3'

  return (
    <div
      data-quote-field="crew-size"
      aria-invalid={invalid || undefined}
      className={`rounded-2xl border bg-white p-4 sm:p-5 ${
        invalid ? 'border-red-300 ring-1 ring-red-200/80' : 'border-slate-200'
      }`}
    >
      <span className={`${labelCls} md:hidden`} id={labelId}>
        Crew size (required for pricing)
      </span>
      <span className={`${labelCls} hidden md:block`} id={labelId}>
        Crew size (required for pricing)
      </span>

      <div
        className="md:hidden"
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
      >
        <div className="grid grid-cols-3 gap-2">
          {mobileCrewOptions.map((o) => (
            <CrewOptionCard
              key={o.value}
              option={o}
              selected={Number(value) === o.value}
              onSelect={onChange}
              variant="mobile"
            />
          ))}
        </div>
      </div>

      <div
        className="hidden md:block"
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
      >
        <div className={`mt-1 grid gap-3 ${desktopGridCols}`}>
          {finalCrewOptions.map((o) => (
            <CrewOptionCard
              key={o.value}
              option={o}
              selected={Number(value) === o.value}
              onSelect={onChange}
              variant="desktop"
            />
          ))}
        </div>
      </div>

      <p id={descriptionId} className="mt-2 text-xs text-slate-600">
        Crew size affects loading time and your quote. Choose before continuing — you can change it
        here anytime on this step.
      </p>
    </div>
  )
}
