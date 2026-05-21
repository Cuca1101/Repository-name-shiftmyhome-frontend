import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { loadFleetDriversForAdmin } from '../../lib/adminFleetDrivers'
import { appendAdminNotesLog } from '../../lib/adminNotesLog'
import { findAdminPartnerByNormalizedCompany, loadAdminPartners } from '../../lib/adminFleetLocalStore'
import { findFleetDriverByName, getFleetDriversCached } from '../../lib/adminFleetDrivers'
import {
  removeJobAssignmentForQuote,
  syncJobAssignmentFromQuoteAssign,
} from '../../lib/data/driverAssignmentSync'
import {
  fetchAssignedByActor,
  updateQuoteWorkflowAssignment,
  updateQuoteWorkflowAssignmentSilent,
} from '../../lib/data/quotesAdminRepository'
import { mergedAdminWorkflowForQuote } from '../../lib/quoteAdminWorkflowMerge'
import { isSupabaseConfigured } from '../../lib/supabase'
import { loadAvailableJobAdminOverrides, saveAvailableJobAdminOverrides } from '../../lib/availableJobLocalStore'
import { findLinkedJobForQuote, quoteIsCancelled, quoteIsCompleted } from '../../lib/adminWorkflowFilters'

const OPS_MARKETPLACE = 'Available / Marketplace'

/**
 * @param {'default'|'compact'|'cardFooter'} layout
 * @param {'default'|'danger'} [tone]
 */
function btnClass(layout, tone = 'default') {
  const base =
    'inline-flex min-h-[36px] shrink-0 items-center justify-center rounded-lg px-3 text-xs font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-45'
  if (tone === 'danger') {
    return `${base} border border-red-300 bg-white text-red-800 hover:bg-red-50`
  }
  if (layout === 'cardFooter') {
    return `${base} border border-slate-200/90 bg-white text-slate-800 hover:bg-slate-50`
  }
  if (layout === 'compact') {
    return `${base} min-h-[34px] border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-800 hover:bg-slate-50`
  }
  return `${base} min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-800 hover:bg-slate-50`
}

/**
 * @typedef {{
 *   quote: Record<string, unknown>,
 *   jobs?: Record<string, unknown>[],
 *   compact?: boolean,
 *   layout?: 'default' | 'compact' | 'cardFooter',
 *   onApplied?: () => void | Promise<void>,
 *   showTriggerButtons?: boolean,
 * }} AdminJobOverrideActionsProps
 */

/**
 * Imperative entry points for embedding in job detail headers (no duplicate button rows).
 * @typedef {{
 *   openMarkComplete: () => void,
 *   openMarkCancelled: () => void,
 *   openReturnToMarketplace: () => void,
 *   openReassignDriver: () => void,
 *   openReassignPartner: () => void,
 *   openAddAdminNote: () => void,
 * }} AdminJobOverrideActionsHandle
 */

const AdminJobOverrideActions = forwardRef(function AdminJobOverrideActions(
  {
    quote,
    jobs = [],
    compact = false,
    layout: layoutProp,
    onApplied,
    showTriggerButtons = true,
  },
  ref,
) {
  const layout = layoutProp ?? (compact ? 'compact' : 'default')
  const id = String(quote?.id || '').trim()
  const job = useMemo(() => (jobs.length ? findLinkedJobForQuote(quote, jobs) : null), [quote, jobs])
  const merged = useMemo(() => mergedAdminWorkflowForQuote(quote), [quote])

  const [modal, setModal] = useState(null)
  const [draft, setDraft] = useState('')
  const [driverName, setDriverName] = useState('')
  const [partnerCompany, setPartnerCompany] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const isDone = quoteIsCompleted(quote, job)
  const isCancelled = quoteIsCancelled(quote, job)

  useImperativeHandle(
    ref,
    () => ({
      openMarkComplete: () => {
        const m = mergedAdminWorkflowForQuote(quote)
        setDraft(String(m.adminCompletionNote || ''))
        setErr('')
        setModal('complete')
      },
      openMarkCancelled: () => {
        const m = mergedAdminWorkflowForQuote(quote)
        setDraft(String(m.adminCancellationReason || m.cancellationReason || ''))
        setErr('')
        setModal('cancel')
      },
      openReturnToMarketplace: () => {
        setDraft('')
        setErr('')
        setModal('return')
      },
      openReassignDriver: () => {
        const m = mergedAdminWorkflowForQuote(quote)
        setDriverName(String(m.assignedDriver || ''))
        setErr('')
        setModal('driver')
      },
      openReassignPartner: () => {
        const m = mergedAdminWorkflowForQuote(quote)
        setPartnerCompany(String(m.assignedPartnerCompany || ''))
        setErr('')
        setModal('partner')
      },
      openAddAdminNote: () => {
        setDraft('')
        setErr('')
        setModal('note')
      },
    }),
    [quote],
  )

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

  const safeListId = id.replace(/[^a-z0-9-]+/gi, '-')

  useEffect(() => {
    void loadFleetDriversForAdmin()
  }, [])

  async function submitMarkCompleted() {
    if (!id) return
    setBusy(true)
    setErr('')
    try {
      const actor = await fetchAssignedByActor()
      const note = draft.trim()
      const m = mergedAdminWorkflowForQuote(quote)
      const log = appendAdminNotesLog(m.adminNotesLog, actor, `Marked completed. ${note || '(no note)'}`)
      const ts = new Date().toISOString()
      if (isSupabaseConfigured) {
        await updateQuoteWorkflowAssignment(id, {
          operational_status: 'Completed',
          completed_at: ts,
          admin_completion_note: note || null,
          admin_notes_log: log,
          assigned_at: ts,
          assigned_by: actor,
        })
        const driverId = quote?.assigned_driver_id != null ? String(quote.assigned_driver_id) : ''
        if (driverId) {
          await syncJobAssignmentFromQuoteAssign(id, driverId, quote, { assignmentStatus: 'Completed' })
        }
      } else {
        persistLocal({
          operationalStatus: 'Completed',
          workflowCompletedAt: ts,
          adminCompletionNote: note,
          adminNotesLog: log,
        })
      }
      setModal(null)
      setDraft('')
      await notify()
    } catch (e) {
      setErr(e?.message || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function submitMarkCancelled() {
    if (!id) return
    setBusy(true)
    setErr('')
    try {
      const actor = await fetchAssignedByActor()
      const reason = draft.trim() || 'No reason given'
      const m = mergedAdminWorkflowForQuote(quote)
      const log = appendAdminNotesLog(m.adminNotesLog, actor, `Marked cancelled: ${reason}`)
      const ts = new Date().toISOString()
      if (isSupabaseConfigured) {
        await updateQuoteWorkflowAssignment(id, {
          operational_status: 'Cancelled',
          cancelled_at: ts,
          admin_cancellation_reason: reason,
          marketplace_visibility: 'cancelled',
          admin_notes_log: log,
          assigned_at: ts,
          assigned_by: actor,
        })
        const driverId = quote?.assigned_driver_id != null ? String(quote.assigned_driver_id) : ''
        if (driverId) {
          await syncJobAssignmentFromQuoteAssign(id, driverId, quote, { assignmentStatus: 'Cancelled' })
        }
      } else {
        persistLocal({
          operationalStatus: 'Cancelled',
          workflowCancelledAt: ts,
          adminCancellationReason: reason,
          marketplaceVisibility: 'cancelled',
          cancellationReason: reason,
          adminNotesLog: log,
        })
      }
      setModal(null)
      setDraft('')
      await notify()
    } catch (e) {
      setErr(e?.message || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function submitReturnMarketplace() {
    if (!id) return
    const reason = draft.trim()
    if (!reason) {
      setErr('Enter why this job is being returned to the marketplace.')
      return
    }
    setBusy(true)
    setErr('')
    try {
      const actor = await fetchAssignedByActor()
      const m = mergedAdminWorkflowForQuote(quote)
      const log = appendAdminNotesLog(m.adminNotesLog, actor, `Returned to marketplace: ${reason}`)
      const ts = new Date().toISOString()
      if (isSupabaseConfigured) {
        await updateQuoteWorkflowAssignment(id, {
          assigned_driver_id: null,
          assigned_driver_name: null,
          assigned_partner_id: null,
          assigned_partner_company: null,
          marketplace_visibility: 'visible_in_marketplace',
          operational_status: OPS_MARKETPLACE,
          completed_at: null,
          cancelled_at: null,
          admin_notes_log: log,
          assigned_at: ts,
          assigned_by: actor,
        })
        await updateQuoteWorkflowAssignmentSilent(id, { partner_dashboard_hidden: false })
        await removeJobAssignmentForQuote(id)
      } else {
        persistLocal({
          assignedDriver: '',
          assignedPartnerCompany: '',
          marketplaceVisibility: 'visible_in_marketplace',
          operationalStatus: OPS_MARKETPLACE,
          workflowCompletedAt: '',
          workflowCancelledAt: '',
          partnerDashboardHidden: false,
          adminNotesLog: log,
        })
      }
      setModal(null)
      setDraft('')
      await notify()
    } catch (e) {
      setErr(e?.message || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function submitReassignDriver() {
    if (!id) return
    const name = driverName.trim()
    if (!name) {
      setErr('Enter a driver name.')
      return
    }
    setBusy(true)
    setErr('')
    try {
      const actor = await fetchAssignedByActor()
      const rec = findFleetDriverByName(name)
      const m = mergedAdminWorkflowForQuote(quote)
      if (isSupabaseConfigured && !rec?.id) {
        setErr('Driver not found in fleet registry. Add them under Drivers admin first (name must match).')
        setBusy(false)
        return
      }
      const log = appendAdminNotesLog(
        m.adminNotesLog,
        actor,
        `Reassigned driver to "${name}"${rec?.id ? ` (id ${rec.id})` : ''}`,
      )
      const ts = new Date().toISOString()
      if (isSupabaseConfigured) {
        await updateQuoteWorkflowAssignment(id, {
          assigned_driver_id: rec?.id ?? null,
          assigned_driver_name: name,
          assigned_partner_id: null,
          assigned_partner_company: null,
          marketplace_visibility: 'assigned',
          operational_status: 'Assigned',
          admin_notes_log: log,
          assigned_at: ts,
          assigned_by: actor,
        })
        if (rec?.id) {
          await syncJobAssignmentFromQuoteAssign(id, rec.id, quote, { assignmentStatus: 'Assigned' })
        }
      } else {
        persistLocal({
          assignedDriver: name,
          assignedPartnerCompany: '',
          marketplaceVisibility: 'assigned',
          operationalStatus: 'Assigned',
          adminNotesLog: log,
        })
      }
      setModal(null)
      setDriverName('')
      await notify()
    } catch (e) {
      setErr(e?.message || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function submitReassignPartner() {
    if (!id) return
    const company = partnerCompany.trim()
    if (!company) {
      setErr('Enter a partner company name.')
      return
    }
    setBusy(true)
    setErr('')
    try {
      const actor = await fetchAssignedByActor()
      const rec = findAdminPartnerByNormalizedCompany(company)
      const m = mergedAdminWorkflowForQuote(quote)
      const log = appendAdminNotesLog(
        m.adminNotesLog,
        actor,
        `Reassigned partner to "${company}"${rec?.id ? ` (id ${rec.id})` : ''}`,
      )
      const ts = new Date().toISOString()
      if (isSupabaseConfigured) {
        await updateQuoteWorkflowAssignment(id, {
          assigned_partner_id: rec?.id ?? null,
          assigned_partner_company: company,
          assigned_driver_id: null,
          assigned_driver_name: null,
          marketplace_visibility: 'assigned',
          operational_status: 'Assigned',
          admin_notes_log: log,
          assigned_at: ts,
          assigned_by: actor,
        })
        await removeJobAssignmentForQuote(id)
      } else {
        persistLocal({
          assignedPartnerCompany: company,
          assignedDriver: '',
          marketplaceVisibility: 'assigned',
          operationalStatus: 'Assigned',
          adminNotesLog: log,
        })
      }
      setModal(null)
      setPartnerCompany('')
      await notify()
    } catch (e) {
      setErr(e?.message || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function submitAddNote() {
    if (!id) return
    const text = draft.trim()
    if (!text) {
      setErr('Enter a note.')
      return
    }
    setBusy(true)
    setErr('')
    try {
      const actor = await fetchAssignedByActor()
      const m = mergedAdminWorkflowForQuote(quote)
      const log = appendAdminNotesLog(m.adminNotesLog, actor, text)
      if (isSupabaseConfigured) {
        await updateQuoteWorkflowAssignment(id, {
          admin_notes_log: log,
          assigned_at: new Date().toISOString(),
          assigned_by: actor,
        })
      } else {
        persistLocal({
          adminNotesLog: log,
          internalNotes: `${m.internalNotes ? `${m.internalNotes}\n\n` : ''}[admin] ${text}`,
        })
      }
      setModal(null)
      setDraft('')
      await notify()
    } catch (e) {
      setErr(e?.message || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  function openComplete() {
    setDraft(merged.adminCompletionNote || '')
    setErr('')
    setModal('complete')
  }
  function openCancel() {
    setDraft(merged.adminCancellationReason || merged.cancellationReason || '')
    setErr('')
    setModal('cancel')
  }
  function openReturn() {
    setDraft('')
    setErr('')
    setModal('return')
  }
  function openDriver() {
    setDriverName(merged.assignedDriver || '')
    setErr('')
    setModal('driver')
  }
  function openPartner() {
    setPartnerCompany(merged.assignedPartnerCompany || '')
    setErr('')
    setModal('partner')
  }
  function openNote() {
    setDraft('')
    setErr('')
    setModal('note')
  }

  if (!id) return null

  const wrap =
    layout === 'cardFooter'
      ? 'min-w-0 space-y-2'
      : layout === 'compact'
        ? 'mt-3 space-y-2 border-t border-slate-100 pt-3'
        : 'mt-4 space-y-3 border-t border-slate-200 pt-4'
  const grid =
    layout === 'cardFooter' ? 'flex flex-wrap gap-2' : layout === 'compact' ? 'grid grid-cols-2 gap-2' : 'flex flex-wrap gap-2'

  return (
    <div className={showTriggerButtons ? wrap : 'contents'}>
      {showTriggerButtons ? (
        <>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
            {layout === 'cardFooter' ? 'Dispatch actions' : 'Admin overrides'}
          </p>
          {err ? <p className="text-xs text-red-700">{err}</p> : null}
          <div className={grid}>
            {!isDone ? (
              <button type="button" disabled={busy} className={btnClass(layout)} onClick={openComplete}>
                Mark completed
              </button>
            ) : null}
            {!isCancelled ? (
              <button type="button" disabled={busy} className={btnClass(layout, 'danger')} onClick={openCancel}>
                Mark cancelled
              </button>
            ) : null}
            {!isDone && !isCancelled ? (
              <button type="button" disabled={busy} className={btnClass(layout)} onClick={openReturn}>
                Return to marketplace
              </button>
            ) : null}
            {!isDone && !isCancelled ? (
              <button type="button" disabled={busy} className={btnClass(layout)} onClick={openDriver}>
                Reassign driver
              </button>
            ) : null}
            {!isDone && !isCancelled ? (
              <button type="button" disabled={busy} className={btnClass(layout)} onClick={openPartner}>
                Reassign partner
              </button>
            ) : null}
            <button type="button" disabled={busy} className={btnClass(layout)} onClick={openNote}>
              Add admin note
            </button>
          </div>
        </>
      ) : !showTriggerButtons && err ? (
        <p
          role="alert"
          className="fixed bottom-4 left-4 right-4 z-[70] rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-center text-sm text-red-800 shadow-lg sm:left-auto sm:right-4 sm:max-w-md sm:text-left"
        >
          {err}
        </p>
      ) : null}

      {showTriggerButtons && layout !== 'cardFooter' && merged.adminNotesLog ? (
        <details className="mt-2 text-[10px] text-slate-600">
          <summary className="cursor-pointer font-semibold text-slate-700">Audit log</summary>
          <pre className="mt-1 max-h-36 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50/90 p-2 font-mono text-[10px] text-slate-700">
            {merged.adminNotesLog}
          </pre>
        </details>
      ) : null}

      {modal ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
          onClick={() => !busy && setModal(null)}
          role="presentation"
        >
          <div
            className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h4 className="text-base font-semibold text-slate-900">
              {modal === 'complete' && 'Mark as completed'}
              {modal === 'cancel' && 'Mark as cancelled'}
              {modal === 'return' && 'Return to marketplace'}
              {modal === 'driver' && (merged.assignedDriver?.trim() ? 'Reassign driver' : 'Assign driver')}
              {modal === 'partner' && (merged.assignedPartnerCompany?.trim() ? 'Reassign partner' : 'Assign partner')}
              {modal === 'note' && 'Add admin note'}
            </h4>
            {modal === 'complete' ? (
              <label className="mt-3 block text-sm">
                <span className="text-xs font-semibold uppercase text-slate-500">Completion note (optional)</span>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="e.g. Finished on site; POD emailed…"
                />
              </label>
            ) : null}
            {modal === 'cancel' ? (
              <label className="mt-3 block text-sm">
                <span className="text-xs font-semibold uppercase text-slate-500">Cancellation reason</span>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Why is this job being cancelled in ops?"
                />
              </label>
            ) : null}
            {modal === 'return' ? (
              <label className="mt-3 block text-sm">
                <span className="text-xs font-semibold uppercase text-slate-500">Reason (required)</span>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="e.g. Partner van broke down — relisting for another crew"
                />
              </label>
            ) : null}
            {modal === 'driver' ? (
              <>
                <datalist id={`smh-override-driver-${safeListId}`}>
                  {getFleetDriversCached().map((d) => (
                    <option key={d.id} value={d.name} />
                  ))}
                </datalist>
                <label className="mt-3 block text-sm">
                  <span className="text-xs font-semibold uppercase text-slate-500">Driver name</span>
                  <input
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    list={`smh-override-driver-${safeListId}`}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
              </>
            ) : null}
            {modal === 'partner' ? (
              <>
                <datalist id={`smh-override-partner-${safeListId}`}>
                  {loadAdminPartners().map((p) => (
                    <option key={p.id} value={p.companyName} />
                  ))}
                </datalist>
                <label className="mt-3 block text-sm">
                  <span className="text-xs font-semibold uppercase text-slate-500">Partner company</span>
                  <input
                    value={partnerCompany}
                    onChange={(e) => setPartnerCompany(e.target.value)}
                    list={`smh-override-partner-${safeListId}`}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
              </>
            ) : null}
            {modal === 'note' ? (
              <label className="mt-3 block text-sm">
                <span className="text-xs font-semibold uppercase text-slate-500">Note</span>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setModal(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    if (modal === 'complete') await submitMarkCompleted()
                    if (modal === 'cancel') await submitMarkCancelled()
                    if (modal === 'return') await submitReturnMarketplace()
                    if (modal === 'driver') await submitReassignDriver()
                    if (modal === 'partner') await submitReassignPartner()
                    if (modal === 'note') await submitAddNote()
                  })()
                }}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
})

AdminJobOverrideActions.displayName = 'AdminJobOverrideActions'

export default AdminJobOverrideActions
