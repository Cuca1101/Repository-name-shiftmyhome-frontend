const input =
  'min-h-[48px] w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25'
const labelCls = 'mb-1.5 block text-sm font-medium text-slate-700'

export default function CrewSizeField({
  id = 'quote-crew-size',
  value,
  onChange,
  crewSettings,
  descriptionId,
}) {
  const crewOptions = [
    { value: 1, label: '1 Man', enabled: Boolean(crewSettings?.crewSizeOneEnabled ?? true) },
    { value: 2, label: '2 Men', enabled: Boolean(crewSettings?.crewSizeTwoEnabled ?? true) },
    { value: 3, label: '3 Men', enabled: Boolean(crewSettings?.crewSizeThreeEnabled ?? true) },
    { value: 4, label: '4 Men', enabled: Boolean(crewSettings?.crewSizeFourEnabled) },
  ].filter((o) => o.enabled)
  const finalCrewOptions = crewOptions.length > 0 ? crewOptions : [{ value: 2, label: '2 Men', enabled: true }]

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <label className={labelCls} htmlFor={id}>
        Crew size (required for pricing)
      </label>
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
      <p id={descriptionId} className="mt-2 text-xs text-slate-600">
        Crew size affects loading time and your quote. Choose before continuing — you can change it
        here anytime on this step.
      </p>
    </div>
  )
}
