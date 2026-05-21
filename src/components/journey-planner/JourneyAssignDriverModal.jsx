import { useEffect, useMemo, useState } from 'react'
import { assessJourneyDriverAssignReadiness } from '../../lib/journeyDriverAssign'
import { fetchActiveFleetDriversForDispatch } from '../../lib/journeyFleetDrivers'

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   journey: Record<string, unknown>,
 *   journeyId: string,
 *   quotes: Record<string, unknown>[],
 *   stops: import('../../lib/journeyPlannerModel.js').JourneyStop[],
 *   assigning: boolean,
 *   onConfirm: (driver: { id: string, name: string }, opts: { acknowledgeMarketplace: boolean }) => void | Promise<void>,
 * }} props
 */
export default function JourneyAssignDriverModal({
  open,
  onClose,
  journey,
  journeyId,
  quotes,
  stops,
  assigning,
  onConfirm,
}) {
  const [drivers, setDrivers] = useState(/** @type {import('../../lib/journeyFleetDrivers.js').DispatchDriverOption[]} */ ([]))
  const [driversLoading, setDriversLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [marketplaceAck, setMarketplaceAck] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open) return
    setSelectedId('')
    setSearch('')
    setMarketplaceAck(false)
    setErr('')
    setDriversLoading(true)
    void fetchActiveFleetDriversForDispatch()
      .then(setDrivers)
      .catch((e) => setErr(e?.message || 'Could not load drivers.'))
      .finally(() => setDriversLoading(false))
  }, [open])

  const readiness = useMemo(
    () =>
      assessJourneyDriverAssignReadiness({
        journey,
        journeyId,
        quotes,
        stops,
        activeDrivers: drivers.map((d) => ({ id: d.id, name: d.name })),
      }),
    [journey, journeyId, quotes, stops, drivers],
  )

  const filteredDrivers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return drivers
    return drivers.filter((d) => {
      const blob = [d.name, d.phone, d.vehicleType].join(' ').toLowerCase()
      return blob.includes(q)
    })
  }, [drivers, search])

  const selected = drivers.find((d) => d.id === selectedId)
  const needsMarketplaceAck = readiness.listedOnMarketplace
  const journeyRef = journey.journey_ref != null ? String(journey.journey_ref) : journeyId.slice(0, 8)

  if (!open) return null

  async function handleConfirm() {
    if (!selected) {
      setErr('Select a driver to dispatch.')
      return
    }
    if (needsMarketplaceAck && !marketplaceAck) {
      setErr('Confirm the marketplace warning to continue.')
      return
    }
    setErr('')
    await onConfirm(selected, { acknowledgeMarketplace: marketplaceAck })
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-900/60 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="journey-dispatch-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !assigning) onClose()
      }}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-4 text-white">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Dispatch</p>
          <h3 id="journey-dispatch-title" className="mt-0.5 text-lg font-bold">
            Assign internal driver
          </h3>
          <p className="mt-1 font-mono text-xs text-slate-300">{journeyRef}</p>
          <p className="mt-2 text-sm text-slate-200">
            {readiness.eligible.length} job{readiness.eligible.length === 1 ? '' : 's'} will be assigned to your
            fleet. Skipped jobs stay unchanged.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {needsMarketplaceAck ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-semibold">Marketplace visibility</p>
              <p className="mt-1 leading-relaxed">
                This journey is currently visible on Marketplace. Assigning an internal driver may remove it from
                partner availability.
              </p>
              <label className="mt-3 flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={marketplaceAck}
                  onChange={(e) => setMarketplaceAck(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-amber-400"
                />
                <span className="font-medium">I understand — assign our internal driver</span>
              </label>
            </div>
          ) : null}

          {readiness.ineligible.length > 0 ? (
            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">
                Will skip {readiness.ineligible.length} job{readiness.ineligible.length === 1 ? '' : 's'}
              </p>
              <ul className="mt-1.5 max-h-28 space-y-1 overflow-y-auto">
                {readiness.ineligible.map((row) => (
                  <li key={`${row.quoteId}-${row.reason}`}>
                    <span className="font-mono text-slate-700">{row.quoteRef}</span> — {row.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <label className="mt-4 block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Search drivers</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, phone, or vehicle…"
              disabled={assigning || driversLoading}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 shadow-sm"
            />
          </label>

          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active drivers</p>
            {driversLoading ? (
              <div className="mt-3 flex items-center gap-2 py-6 text-sm text-slate-500">
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600"
                  aria-hidden
                />
                Loading fleet…
              </div>
            ) : filteredDrivers.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-amber-800">
                {drivers.length === 0
                  ? 'No active drivers available. Add drivers under Admin → Drivers.'
                  : 'No drivers match your search.'}
              </p>
            ) : (
              <ul className="mt-2 max-h-52 space-y-2 overflow-y-auto sm:max-h-60">
                {filteredDrivers.map((d) => {
                  const on = selectedId === d.id
                  return (
                    <li key={d.id}>
                      <button
                        type="button"
                        disabled={assigning}
                        onClick={() => setSelectedId(d.id)}
                        className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                          on
                            ? 'border-brand-400 bg-brand-50 ring-2 ring-brand-200'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                            on ? 'border-brand-600 bg-brand-600' : 'border-slate-300 bg-white'
                          }`}
                          aria-hidden
                        >
                          {on ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-slate-900">{d.name}</span>
                          <span className="mt-0.5 block text-xs text-slate-600">
                            {[d.vehicleType || 'Vehicle TBC', d.phone].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {err ? <p className="mt-3 text-sm font-medium text-red-700">{err}</p> : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={assigning}
            onClick={onClose}
            className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={assigning || !selected || drivers.length === 0 || readiness.eligible.length === 0}
            onClick={() => void handleConfirm()}
            className="min-h-[44px] rounded-xl bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-brand-500 disabled:opacity-50"
          >
            {assigning ? 'Assigning…' : 'Confirm assignment'}
          </button>
        </div>
      </div>
    </div>
  )
}
