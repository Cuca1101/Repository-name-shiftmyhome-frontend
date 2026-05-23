import { User, Users } from 'lucide-react'

const labelCls =
  'mb-1 block text-xs font-medium leading-snug text-slate-700 md:mb-1.5 md:text-sm'

const MOBILE_CREW_META = {
  1: { hint: 'Budget — labour discount' },
  2: { hint: 'Recommended standard' },
  3: { hint: 'Premium — faster service' },
}

const DESKTOP_CREW_META = {
  1: { hint: '20% off labour (where allowed)' },
  2: { hint: 'Recommended — includes 2nd mover' },
  3: { hint: 'Premium — includes 3rd mover' },
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
      className={`relative flex min-h-[66px] flex-col items-center justify-center rounded-lg border px-1 py-1.5 text-center shadow-sm transition duration-200 active:scale-[0.97] md:min-h-[88px] md:rounded-xl md:px-1.5 md:py-2.5 ${
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
  oneManAllowed = true,
  oneManDisabledReason = '',
}) {
  const crewOptions = buildCrewOptions(crewSettings).map((o) =>
    o.value === 1 && !oneManAllowed ? { ...o, enabled: false } : o,
  )
  const finalCrewOptions = crewOptions.filter((o) => o.enabled)
  const fallbackOptions = [{ value: 2, label: '2 Men', enabled: true }]
  const displayOptions = finalCrewOptions.length > 0 ? finalCrewOptions : fallbackOptions
  const mobileCrewOptions = displayOptions.filter((o) => o.value >= 1 && o.value <= 3)
  const labelId = `${id}-label`
  const desktopGridCols =
    displayOptions.length >= 4
      ? 'sm:grid-cols-2 lg:grid-cols-4'
      : displayOptions.length === 2
        ? 'grid-cols-2'
        : 'grid-cols-3'

  return (
    <div
      data-quote-field="crew-size"
      aria-invalid={invalid || undefined}
      className={`box-border w-full min-w-0 rounded-xl border bg-white p-2 md:rounded-2xl md:p-5 ${
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
          {displayOptions.map((o) => (
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

      {!oneManAllowed && oneManDisabledReason ? (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-snug text-amber-900 md:text-xs">
          {oneManDisabledReason} 1 Man is not available for this move — please choose 2 Men or more.
        </p>
      ) : null}

      <p id={descriptionId} className="mt-1.5 text-[11px] leading-snug text-slate-600 md:mt-2 md:text-xs">
        Crew size updates your quote instantly. 1 Man is the budget option where allowed. 2 Men adds second-crew
        labour; 3 Men adds third-crew labour (based on distance and travel time). House removals and heavy items require
        at least 2 men.
      </p>
    </div>
  )
}
