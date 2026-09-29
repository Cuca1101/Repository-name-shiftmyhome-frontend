function allowanceText(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null
  const name = snapshot.display_name || snapshot.service_package || 'Standard'
  return { name, snapshot }
}

/**
 * Package badge and included allowances for admin jobs and driver operations.
 * Extra items past the allowance go through the existing extra-charge flow.
 */
export default function ServicePackageAllowanceCard({ snapshot, className = '' }) {
  const parsed = allowanceText(snapshot)
  if (!parsed) return null
  const { name, snapshot: pack } = parsed
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 ${className}`.trim()}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-900">Service package</h3>
        <span className="inline-flex rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          {name}
        </span>
      </div>
      <ul className="mt-2 space-y-1">
        <li>
          Forgotten items: {pack.forgotten_item_allowance ?? 0} items · {pack.forgotten_volume_m3 ?? 0} m³
        </li>
        <li>
          Used: {pack.used_forgotten_items ?? 0} items · {pack.used_forgotten_volume_m3 ?? 0} m³
        </li>
        <li>Waiting time included: {pack.included_waiting_minutes ?? 0} minutes</li>
        <li>
          Wrapping: {pack.included_wrapping_items ?? 0} items · Dismantling/reassembly:{' '}
          {pack.included_dismantle_items ?? 0}
        </li>
        {pack.service_package_fee != null ? (
          <li>Package fee: £{Number(pack.service_package_fee).toFixed(2)}</li>
        ) : null}
      </ul>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">
        Items beyond this allowance must be added to the job and charged before loading. Drivers cannot exceed the
        allowance without an extra charge or admin approval.
      </p>
    </div>
  )
}
