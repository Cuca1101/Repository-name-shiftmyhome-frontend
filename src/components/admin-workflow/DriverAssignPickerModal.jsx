import { useEffect, useMemo, useState } from 'react'
import { loadFleetDriversForAdmin } from '../../lib/adminFleetDrivers'
import { filterDriversForPicker } from '../../lib/adminDriverJobCounts'

/**
 * @param {{
 *   open: boolean,
 *   title?: string,
 *   onClose: () => void,
 *   onAssign: (driver: { id: string, name: string, phone?: string, email?: string, hasLogin?: boolean }) => void | Promise<void>,
 *   assigning?: boolean,
 *   jobCountsByDriverId?: Record<string, number>,
 *   requireConfirm?: boolean,
 * }} props
 */
export default function DriverAssignPickerModal({
  open,
  title = 'Assign driver',
  onClose,
  onAssign,
  assigning = false,
  jobCountsByDriverId = {},
  requireConfirm = false,
}) {
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [err, setErr] = useState('')
  const [pending, setPending] = useState(
    /** @type {{ id: string, name: string, phone?: string, email?: string, hasLogin?: boolean } | null} */ (null),
  )

  useEffect(() => {
    if (!open) return
    setSearch('')
    setErr('')
    setPending(null)
    setLoading(true)
    void loadFleetDriversForAdmin()
      .then((list) => setDrivers(Array.isArray(list) ? list : []))
      .catch((e) => setErr(e?.message || 'Could not load drivers.'))
      .finally(() => setLoading(false))
  }, [open])

  const filtered = useMemo(() => filterDriversForPicker(drivers, search), [drivers, search])

  if (!open) return null

  async function confirmAssign() {
    if (!pending) return
    await onAssign(pending)
    setPending(null)
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-900/60 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="driver-picker-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !assigning) onClose()
      }}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 id="driver-picker-title" className="text-lg font-bold text-slate-900">
            {pending && requireConfirm ? 'Confirm assignment' : title}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {pending && requireConfirm
              ? 'The job will appear in the driver mobile app (pickup & dropoff cards).'
              : 'Active fleet drivers only. Drivers need a mobile login account to see jobs in the app.'}
          </p>
          {!pending ? (
            <label className="mt-3 block">
              <span className="sr-only">Search drivers</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search drivers…"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
                autoComplete="off"
              />
            </label>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {err ? (
            <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>
          ) : null}

          {pending && requireConfirm ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
              <p className="text-sm font-semibold text-slate-900">{pending.name}</p>
              {pending.phone ? <p className="mt-1 text-xs text-slate-600">{pending.phone}</p> : null}
              {pending.email ? <p className="text-xs text-slate-600">{pending.email}</p> : null}
              {!pending.hasLogin ? (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  This driver has no mobile login yet — create an account under Admin → Drivers first, or they will
                  not see the job in the app.
                </p>
              ) : (
                <p className="mt-3 text-xs text-emerald-800">Mobile login linked — job will sync to the Driver App.</p>
              )}
            </div>
          ) : loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading drivers…</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-600">
              {drivers.length === 0
                ? 'No drivers in fleet registry yet. Create a driver under Admin → Drivers.'
                : 'No active drivers match this search.'}
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {filtered.map((d) => {
                const count = jobCountsByDriverId[String(d.id)] || 0
                return (
                  <li
                    key={d.id}
                    className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/50 p-3 shadow-sm"
                  >
                    <p className="font-semibold text-slate-900">{d.name || '—'}</p>
                    {d.phone ? <p className="mt-1 text-xs text-slate-600">{d.phone}</p> : null}
                    {d.email ? <p className="text-xs text-slate-600">{d.email}</p> : null}
                    {d.vehicleType ? (
                      <p className="mt-1 text-[10px] text-slate-500">{d.vehicleType}</p>
                    ) : null}
                    <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {d.hasLogin ? (
                        <span className="text-emerald-700">Mobile login</span>
                      ) : (
                        <span className="text-amber-700">No app login</span>
                      )}
                      {count > 0 ? (
                        <span className="ml-2 normal-case text-slate-600">
                          · {count} active job{count === 1 ? '' : 's'}
                        </span>
                      ) : null}
                    </p>
                    <button
                      type="button"
                      disabled={assigning}
                      onClick={() => {
                        const driver = {
                          id: String(d.id),
                          name: String(d.name),
                          phone: d.phone,
                          email: d.email,
                          hasLogin: Boolean(d.hasLogin),
                        }
                        if (requireConfirm) {
                          setPending(driver)
                        } else {
                          void onAssign(driver)
                        }
                      }}
                      className="mt-3 min-h-[40px] rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                      {requireConfirm ? 'Select' : assigning ? 'Assigning…' : 'Assign'}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">
          {pending && requireConfirm ? (
            <>
              <button
                type="button"
                disabled={assigning}
                onClick={() => setPending(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                disabled={assigning}
                onClick={() => void confirmAssign()}
                className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {assigning ? 'Assigning…' : 'Confirm assignment'}
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={assigning}
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
