import { useCallback, useEffect, useMemo, useState } from 'react'
import { getFleetDriversCached, loadFleetDriversForAdmin } from '../../lib/adminFleetDrivers'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { appendAdminNotesLog } from '../../lib/adminNotesLog'
import { quoteMarketplaceJobAccepted } from '../../lib/adminJobListRules'
import { resolveAssignedDriverDisplay } from '../../lib/adminJobAcceptedStatus'
import { assignDriverToQuote, clearDriverFromQuote } from '../../lib/data/driverAssignmentSync'
import {
  fetchAssignedByActor,
  updateQuoteWorkflowAssignment,
} from '../../lib/data/quotesAdminRepository'
import { mergedAdminWorkflowForQuote } from '../../lib/quoteAdminWorkflowMerge'
import { loadAvailableJobAdminOverrides, saveAvailableJobAdminOverrides } from '../../lib/availableJobLocalStore'
import DriverAssignPickerModal from './DriverAssignPickerModal'
import DriverChargeModal from '../admin-driver-charges/DriverChargeModal'

/**
 * @param {{
 *   quote: Record<string, unknown>,
 *   jobCountsByDriverId?: Record<string, number>,
 *   onApplied?: () => void | Promise<void>,
 *   compact?: boolean,
 *   layout?: 'default' | 'dispatch',
 *   disabled?: boolean,
 *   linkedJob?: Record<string, unknown> | null,
 * }} props
 */
export default function JobDriverAssignmentPanel({
  quote,
  jobCountsByDriverId = {},
  onApplied,
  compact = false,
  layout = 'default',
  disabled = false,
  linkedJob = null,
}) {
  const id = String(quote?.id || '').trim()
  const merged = useMemo(() => mergedAdminWorkflowForQuote(quote), [quote])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [deallocChargeOpen, setDeallocChargeOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [vehicleLabel, setVehicleLabel] = useState('')
  const driverId = quote?.assigned_driver_id != null ? String(quote.assigned_driver_id) : ''

  useEffect(() => {
    void loadFleetDriversForAdmin()
  }, [])

  useEffect(() => {
    if (layout !== 'dispatch' || !driverId || !isSupabaseConfigured || !supabase) {
      setVehicleLabel('')
      return
    }
    let cancelled = false
    void supabase
      .from('drivers')
      .select('vehicle_type')
      .eq('id', driverId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setVehicleLabel(String(data?.vehicle_type || '').trim())
      })
    return () => {
      cancelled = true
    }
  }, [layout, driverId])

  const driverRec = useMemo(() => {
    if (!driverId) return null
    return getFleetDriversCached().find((d) => String(d.id) === driverId) ?? null
  }, [driverId, quote?.assigned_driver_id, quote?.assigned_driver_name])

  const display = useMemo(() => resolveAssignedDriverDisplay(quote, driverRec), [quote, driverRec])
  const marketplaceOnly = quoteMarketplaceJobAccepted(quote) && !display.name && !driverId
  const hasDriver = Boolean(display.name || driverId)

  const notify = useCallback(async () => {
    if (onApplied) await onApplied()
  }, [onApplied])

  const persistLocal = useCallback(
    (patch) => {
      if (!id) return
      saveAvailableJobAdminOverrides(id, { ...loadAvailableJobAdminOverrides(id), ...patch })
    },
    [id],
  )

  async function handleAssign(driver) {
    if (!id || !driver?.id || !driver?.name) return
    setBusy(true)
    setErr('')
    try {
      const actor = await fetchAssignedByActor()
      const m = mergedAdminWorkflowForQuote(quote)
      const log = appendAdminNotesLog(
        m.adminNotesLog,
        actor,
        `${hasDriver ? 'Changed' : 'Assigned'} driver to "${driver.name}" (id ${driver.id})`,
      )
      const ts = new Date().toISOString()
      if (isSupabaseConfigured) {
        await assignDriverToQuote(
          id,
          driver.id,
          driver.name,
          quote,
          {
            admin_notes_log: log,
            assigned_at: ts,
            assigned_by: actor,
          },
          (qid, patch) => updateQuoteWorkflowAssignment(qid, patch),
        )
      } else {
        persistLocal({
          assignedDriver: driver.name,
          assignedPartnerCompany: '',
          marketplaceVisibility: 'assigned',
          operationalStatus: 'Assigned',
          adminNotesLog: log,
        })
      }
      setPickerOpen(false)
      setErr('')
      await notify()
    } catch (e) {
      setErr(e?.message || 'Assign failed')
    } finally {
      setBusy(false)
    }
  }

  async function performUnassign(noteSuffix = '') {
    if (!id) return
    const actor = await fetchAssignedByActor()
    const m = mergedAdminWorkflowForQuote(quote)
    const log = appendAdminNotesLog(
      m.adminNotesLog,
      actor,
      `Unassigned driver (admin)${noteSuffix}`,
    )
    const ts = new Date().toISOString()
    if (isSupabaseConfigured) {
      await clearDriverFromQuote(
        id,
        {
          operational_status: null,
          marketplace_visibility: 'hidden_from_partners',
          assigned_partner_id: null,
          assigned_partner_company: null,
          admin_notes_log: log,
          assigned_at: ts,
          assigned_by: actor,
        },
        (qid, patch) => updateQuoteWorkflowAssignment(qid, patch),
      )
    } else {
      persistLocal({
        assignedDriver: '',
        assignedPartnerCompany: '',
        marketplaceVisibility: 'hidden_from_partners',
        operationalStatus: '',
        adminNotesLog: log,
      })
    }
    await notify()
  }

  async function handleUnassign() {
    if (!id) return
    if (!window.confirm('Unassign this driver? The job will return to Available Jobs if still unclaimed.')) return
    setBusy(true)
    setErr('')
    try {
      await performUnassign()
    } catch (e) {
      setErr(e?.message || 'Unassign failed')
    } finally {
      setBusy(false)
    }
  }

  function openDeallocateWithCharge() {
    if (!hasDriver || !driverId) return
    if (
      !window.confirm(
        'Record a deallocation charge and remove this driver from the job? You will enter the charge amount next.',
      )
    ) {
      return
    }
    setDeallocChargeOpen(true)
  }

  async function handleDeallocateChargeSaved() {
    setDeallocChargeOpen(false)
    setBusy(true)
    setErr('')
    try {
      await performUnassign(' — deallocation charge recorded')
    } catch (e) {
      setErr(e?.message || 'Deallocate failed')
    } finally {
      setBusy(false)
    }
  }

  const btn =
    'inline-flex min-h-[36px] items-center justify-center rounded-lg px-3 text-xs font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-45'
  const primary = `${btn} bg-brand-600 text-white hover:bg-brand-700`
  const secondary = `${btn} border border-slate-200 bg-white text-slate-800 hover:bg-slate-50`
  const controlsDisabled = disabled || busy

  if (layout === 'dispatch') {
    const mini = 'rounded border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-45'
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs">
        {err ? <p className="w-full text-[11px] text-red-700">{err}</p> : null}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Vehicle</span>
          <span className="font-medium text-slate-900">{vehicleLabel || (hasDriver ? 'Not recorded' : '—')}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Driver</span>
          {hasDriver ? (
            <>
              <span className="font-semibold text-slate-900">{display.name}</span>
              {display.phone ? (
                <a href={`tel:${display.phone.replace(/\s/g, '')}`} className="text-brand-700 hover:underline">
                  {display.phone}
                </a>
              ) : null}
              {display.email ? <span className="text-slate-600">{display.email}</span> : null}
            </>
          ) : marketplaceOnly && display.partner ? (
            <span className="text-violet-900">Marketplace · {display.partner}</span>
          ) : (
            <span className="text-slate-500">Unassigned</span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {!hasDriver && !marketplaceOnly ? (
            <button type="button" disabled={controlsDisabled} className={mini} onClick={() => setPickerOpen(true)}>
              Assign driver
            </button>
          ) : (
            <>
              <button type="button" disabled={controlsDisabled} className={mini} onClick={() => setPickerOpen(true)}>
                Change driver
              </button>
              {hasDriver ? (
                <>
                  <button
                    type="button"
                    disabled={controlsDisabled}
                    className={`${mini} border-red-200 text-red-800`}
                    onClick={() => void handleUnassign()}
                  >
                    Unassign
                  </button>
                  <button
                    type="button"
                    disabled={controlsDisabled}
                    className={`${mini} border-rose-300 bg-rose-50 text-rose-950`}
                    onClick={openDeallocateWithCharge}
                  >
                    Deallocate with charge
                  </button>
                </>
              ) : null}
            </>
          )}
        </div>
        <DriverChargeModal
          open={deallocChargeOpen}
          onClose={() => !busy && setDeallocChargeOpen(false)}
          onSaved={handleDeallocateChargeSaved}
          initialDriverId={driverId}
          initialQuoteId={id}
          initialJobId={linkedJob?.id != null ? String(linkedJob.id) : null}
          initialQuoteRef={String(quote?.quote_ref || '')}
          initialChargeType="deallocation"
        />
        <DriverAssignPickerModal
          open={pickerOpen}
          title={hasDriver ? 'Change driver' : 'Assign driver'}
          onClose={() => !busy && setPickerOpen(false)}
          onAssign={handleAssign}
          assigning={busy}
          jobCountsByDriverId={jobCountsByDriverId}
          requireConfirm
        />
      </div>
    )
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {err ? <p className="text-xs text-red-700">{err}</p> : null}

      {marketplaceOnly && display.partner ? (
        <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-950">
          Marketplace accepted by <span className="font-semibold">{display.partner}</span>
        </p>
      ) : null}

      {hasDriver ? (
        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-900/80">Assigned driver</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{display.name}</p>
          {display.phone ? <p className="text-xs text-slate-600">{display.phone}</p> : null}
          {display.email ? <p className="text-xs text-slate-600">{display.email}</p> : null}
          {marketplaceOnly && display.name ? (
            <p className="mt-2 text-[11px] text-violet-900">Also accepted on marketplace</p>
          ) : null}
        </div>
      ) : marketplaceOnly ? null : (
        <p className="text-xs text-slate-600">
          No driver assigned yet. Assignment creates a <code className="rounded bg-slate-100 px-1">job_assignments</code>{' '}
          row for the Driver Mobile App.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {!hasDriver && !marketplaceOnly ? (
          <button type="button" disabled={controlsDisabled} className={primary} onClick={() => setPickerOpen(true)}>
            Assign driver
          </button>
        ) : null}
        {hasDriver || marketplaceOnly ? (
          <>
            <button type="button" disabled={controlsDisabled} className={secondary} onClick={() => setPickerOpen(true)}>
              Change driver
            </button>
            {hasDriver ? (
              <>
                <button
                  type="button"
                  disabled={controlsDisabled}
                  className={`${secondary} text-red-800`}
                  onClick={() => void handleUnassign()}
                >
                  Unassign driver
                </button>
                <button
                  type="button"
                  disabled={controlsDisabled}
                  className={`${secondary} border-rose-200 bg-rose-50 text-rose-950`}
                  onClick={openDeallocateWithCharge}
                >
                  Deallocate job with charge
                </button>
              </>
            ) : null}
          </>
        ) : null}
      </div>

      <DriverChargeModal
        open={deallocChargeOpen}
        onClose={() => !busy && setDeallocChargeOpen(false)}
        onSaved={handleDeallocateChargeSaved}
        initialDriverId={driverId}
        initialQuoteId={id}
        initialJobId={linkedJob?.id != null ? String(linkedJob.id) : null}
        initialQuoteRef={String(quote?.quote_ref || '')}
        initialChargeType="deallocation"
      />

      <DriverAssignPickerModal
        open={pickerOpen}
        title={hasDriver ? 'Change driver' : 'Assign driver'}
        onClose={() => !busy && setPickerOpen(false)}
        onAssign={handleAssign}
        assigning={busy}
        jobCountsByDriverId={jobCountsByDriverId}
        requireConfirm
      />
    </div>
  )
}
