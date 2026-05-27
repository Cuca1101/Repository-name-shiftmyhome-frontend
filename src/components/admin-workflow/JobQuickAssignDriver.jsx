import { useState } from 'react'
import { assignDriverToQuote } from '../../lib/data/driverAssignmentSync'
import {
  fetchAssignedByActor,
  updateQuoteWorkflowAssignment,
} from '../../lib/data/quotesAdminRepository'
import { appendAdminNotesLog } from '../../lib/adminNotesLog'
import { mergedAdminWorkflowForQuote } from '../../lib/quoteAdminWorkflowMerge'
import { isSupabaseConfigured } from '../../lib/supabase'
import { loadAvailableJobAdminOverrides, saveAvailableJobAdminOverrides } from '../../lib/availableJobLocalStore'
import DriverAssignPickerModal from './DriverAssignPickerModal'

/**
 * Compact assign-driver control for job list cards (Available Jobs, etc.).
 *
 * @param {{
 *   quote: Record<string, unknown>,
 *   jobCountsByDriverId?: Record<string, number>,
 *   onApplied?: () => void | Promise<void>,
 *   compact?: boolean,
 * }} props
 */
export default function JobQuickAssignDriver({ quote, jobCountsByDriverId = {}, onApplied, compact = true }) {
  const id = String(quote?.id || '').trim()
  const hasDriver = Boolean(
    String(quote?.assigned_driver_id || '').trim() || String(quote?.assigned_driver_name || '').trim(),
  )
  const [pickerOpen, setPickerOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [okMsg, setOkMsg] = useState('')

  const btnClass = compact
    ? 'inline-flex min-h-[34px] w-full items-center justify-center rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-900 hover:bg-brand-100 disabled:opacity-50'
    : 'inline-flex min-h-[40px] items-center justify-center rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50'

  async function handleAssign(driver) {
    if (!id || !driver?.id || !driver?.name) return
    setBusy(true)
    setErr('')
    setOkMsg('')
    try {
      const actor = await fetchAssignedByActor()
      const m = mergedAdminWorkflowForQuote(quote)
      const log = appendAdminNotesLog(
        m.adminNotesLog,
        actor,
        `${hasDriver ? 'Changed' : 'Assigned'} driver to "${driver.name}" (id ${driver.id}) — mobile app`,
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
        saveAvailableJobAdminOverrides(id, {
          ...loadAvailableJobAdminOverrides(id),
          assignedDriver: driver.name,
          operationalStatus: 'Assigned',
          marketplaceVisibility: 'assigned',
          adminNotesLog: log,
        })
      }
      setPickerOpen(false)
      setOkMsg(`Assigned to ${driver.name}`)
      if (onApplied) await onApplied()
    } catch (e) {
      setErr(e?.message || 'Assign failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full">
      {err ? <p className="mb-1 text-[11px] text-red-700">{err}</p> : null}
      {okMsg ? <p className="mb-1 text-[11px] font-medium text-emerald-800">{okMsg}</p> : null}
      <button
        type="button"
        disabled={busy || !id}
        className={btnClass}
        onClick={() => setPickerOpen(true)}
      >
        {busy ? 'Assigning…' : hasDriver ? 'Change driver' : 'Assign driver'}
      </button>
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
