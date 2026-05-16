import { dispatchStatusLabel } from '../../lib/operationsMapDispatchStatus'

const STATUS_COLORS = {
  idle: 'border-amber-200 bg-amber-50',
  assigned: 'border-blue-200 bg-blue-50',
  on_route: 'border-sky-300 bg-sky-50',
  arrived_pickup: 'border-violet-200 bg-violet-50',
  loading: 'border-violet-300 bg-violet-50',
  in_transit: 'border-sky-400 bg-sky-50',
  arrived_delivery: 'border-emerald-200 bg-emerald-50',
  completed: 'border-slate-200 bg-slate-50',
  offline: 'border-slate-200 bg-slate-100 opacity-70',
}

/**
 * @param {{
 *   drivers: {
 *     driverId: string,
 *     name: string,
 *     status: string,
 *     dispatchStatus?: string,
 *     activeJobRef?: string,
 *     etaLabel?: string,
 *     online?: boolean,
 *     speedMph?: number,
 *     lastGpsAt?: string | null,
 *   }[],
 *   focusedDriverId: string,
 *   onPickDriver: (id: string) => void,
 * }} props
 */
export default function OperationsMapDriverCards({ drivers, focusedDriverId, onPickDriver }) {
  if (!drivers.length) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        No drivers with map positions. Register drivers and connect live GPS (
        <code className="text-xs">driver_live_positions</code>).
      </p>
    )
  }

  return (
    <div className="flex max-h-[min(52vh,420px)] flex-col gap-2 overflow-y-auto pr-1">
      {drivers.map((d) => {
        const st = d.dispatchStatus || 'idle'
        const shell = STATUS_COLORS[st] || STATUS_COLORS.idle
        const focused = String(focusedDriverId) === String(d.driverId)
        return (
          <button
            key={d.driverId}
            type="button"
            onClick={() => onPickDriver(d.driverId)}
            className={`w-full rounded-xl border p-3 text-left shadow-sm transition hover:shadow-md ${shell} ${
              focused ? 'ring-2 ring-brand-500 ring-offset-1' : ''
            }`}
          >
            <CardHeader name={d.name} online={d.online} statusLabel={dispatchStatusLabel(st)} />
            <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
              <div>
                <dt className="text-slate-500">Active job</dt>
                <dd className="font-mono font-bold text-slate-900">{d.activeJobRef || '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">ETA</dt>
                <dd className="font-bold text-slate-900">{d.etaLabel || '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Speed</dt>
                <dd className="tabular-nums font-medium text-slate-800">
                  {d.speedMph != null && d.speedMph > 1 ? `${Math.round(d.speedMph)} mph` : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Last GPS</dt>
                <dd className="truncate font-medium text-slate-800">{d.lastGpsAt || '—'}</dd>
              </div>
            </dl>
          </button>
        )
      })}
    </div>
  )
}

function CardHeader({ name, online, statusLabel }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <p className="text-sm font-bold text-slate-900">{name}</p>
      <span
        className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
          online ? 'bg-emerald-600 text-white' : 'bg-slate-400 text-white'
        }`}
      >
        {online ? 'Online' : 'Offline'}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-600">{statusLabel}</span>
    </div>
  )
}
