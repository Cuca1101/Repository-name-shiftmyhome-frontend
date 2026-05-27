import { Link } from 'react-router-dom'
import { formatMarketplaceStatusSummary } from '../../lib/marketplaceListingStatus'
import {
  buildAvailableJobInventoryDisplayRows,
  summarizeAvailableJobInventory,
} from '../../lib/availableJobInventoryDisplay'
import { liftReadable } from '../../lib/adminJobQuoteDetailsViewModel'
import AvailableJobInventorySection from './AvailableJobInventorySection'
import QuotePhotosAdminSection from './QuotePhotosAdminSection'
import JobDetailsOpsTimeline from './JobDetailsOpsTimeline'
import JobDetailsPayoutSection from './JobDetailsPayoutSection'
import { AdminField } from './AdminJobUiPrimitives'

const cardShell =
  'overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]'

function money(n) {
  if (n == null || n === '') return '—'
  return `£${Number(n).toFixed(2)}`
}

/**
 * @param {{ label: string, value: string, sub?: string, tone?: string }} props
 */
function StatCard({ label, value, sub, tone = 'slate' }) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50/80',
    emerald: 'border-emerald-200/80 bg-emerald-50/50',
    amber: 'border-amber-200/80 bg-amber-50/50',
    sky: 'border-sky-200/80 bg-sky-50/50',
    violet: 'border-violet-200/80 bg-violet-50/50',
  }
  return (
    <div className={`rounded-xl border p-4 ${tones[tone] || tones.slate}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-2xl">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-600">{sub}</p> : null}
    </div>
  )
}

/**
 * @param {{ ok: boolean, label: string, detail?: string }} props
 */
function ChecklistRow({ ok, label, detail }) {
  return (
    <li className="flex gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
          ok ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
        }`}
        aria-hidden
      >
        {ok ? '✓' : '!'}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        {detail ? <p className="mt-0.5 text-xs text-slate-600">{detail}</p> : null}
      </div>
    </li>
  )
}

/**
 * @param {{
 *   q: Record<string, unknown>,
 *   overrides: Record<string, unknown>,
 *   fin: { customerTotal: number|null, paid: number, remaining: number|null, baseQuoteTotal: number|null } | null,
 *   adjSum: number,
 *   vm: Record<string, unknown> | null,
 *   statusDraft: string,
 *   statusOptions: string[],
 *   statusSaving: boolean,
 *   statusMessage: { type: string|null, text: string },
 *   onStatusDraftChange: (v: string) => void,
 *   onSaveWorkflowStatus: () => void,
 *   notesDraft: string,
 *   photoQuoteRef: string,
 *   jobId: string | null,
 *   linkedJob?: Record<string, unknown> | null,
 *   legacyPhotoFileNames: string[],
 *   onOpenTab?: (tabId: string) => void,
 *   onReload?: () => void | Promise<void>,
 * }} props
 */
export default function JobDetailsOverviewOps({
  q,
  overrides,
  fin,
  adjSum,
  vm,
  statusDraft,
  statusOptions,
  statusSaving,
  statusMessage,
  onStatusDraftChange,
  onSaveWorkflowStatus,
  notesDraft,
  photoQuoteRef,
  jobId,
  linkedJob = null,
  legacyPhotoFileNames,
  onOpenTab,
  onReload,
}) {
  const driver = String(q.assigned_driver_name || overrides.assignedDriver || '').trim()
  const partner = String(q.assigned_partner_company || overrides.assignedPartnerCompany || '').trim()
  const invRows = buildAvailableJobInventoryDisplayRows(q)
  const invSummary = summarizeAvailableJobInventory(invRows)
  const paid = Number(fin?.paid) > 0
  const hasDriver = Boolean(driver || partner)
  const mv = String(overrides.marketplaceVisibility || q.marketplace_visibility || '')

  const paymentStatLabel = String(q.payment_status || 'unpaid').replace(/_/g, ' ')
  const paymentTone =
    String(q.payment_status) === 'paid'
      ? 'emerald'
      : String(q.payment_status) === 'deposit_paid'
        ? 'sky'
        : 'amber'

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Payment"
          value={fin?.customerTotal != null ? money(fin.customerTotal) : '—'}
          sub={`Paid ${money(fin?.paid)} · Bal ${fin?.remaining != null ? money(fin.remaining) : '—'}`}
          tone={paymentTone}
        />
        <StatCard
          label="Operational status"
          value={(overrides.operationalStatus || '').trim() || 'Not set'}
          sub={formatMarketplaceStatusSummary(q)}
          tone={hasDriver ? 'emerald' : 'amber'}
        />
        <StatCard
          label="Workflow"
          value={String(q.status || '—')}
          sub={`Adjustments ${money(adjSum)}`}
          tone="sky"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard label="Customer total" value={fin?.customerTotal != null ? money(fin.customerTotal) : '—'} />
        <StatCard
          label="Remaining balance"
          value={fin?.remaining != null ? money(fin.remaining) : '—'}
          tone={fin?.remaining != null && Number(fin.remaining) > 0 ? 'amber' : 'emerald'}
        />
      </div>

      <JobDetailsPayoutSection q={q} onSaved={onReload} />

      <section className={cardShell}>
        <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Workflow control</h3>
        </div>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:p-5">
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Workflow status
            </span>
            <select
              value={statusDraft}
              onChange={(e) => onStatusDraftChange(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={statusSaving || statusDraft === q.status}
            onClick={onSaveWorkflowStatus}
            className="min-h-[48px] shrink-0 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {statusSaving ? 'Saving…' : 'Save status'}
          </button>
        </div>
        {statusMessage.text ? (
          <p
            className={`border-t border-slate-100 px-4 pb-4 text-sm sm:px-5 ${
              statusMessage.type === 'success' ? 'text-emerald-800' : 'text-red-800'
            }`}
          >
            {statusMessage.text}
          </p>
        ) : null}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={cardShell}>
          <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3 sm:px-5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Assignment</h3>
          </div>
          <dl className="space-y-4 p-4 text-sm sm:p-5">
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Driver</dt>
              <dd className="mt-1 text-base font-semibold text-slate-900">{driver || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Partner</dt>
              <dd className="mt-1 font-medium text-slate-900">{partner || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Marketplace payout</dt>
              <dd className="mt-1 font-bold tabular-nums text-slate-900">
                {overrides.marketplacePayoutGbp != null && Number.isFinite(Number(overrides.marketplacePayoutGbp))
                  ? money(overrides.marketplacePayoutGbp)
                  : '—'}
              </dd>
            </div>
          </dl>
          <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:px-5">
            Use header actions or{' '}
            <button
              type="button"
              className="font-semibold text-brand-700 hover:underline"
              onClick={() => onOpenTab?.('assignment')}
            >
              Assignment tab
            </button>{' '}
            for full marketplace controls.
          </p>
        </section>

        <section className={cardShell}>
          <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3 sm:px-5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Customer contact</h3>
          </div>
          <div className="grid gap-4 p-4 sm:grid-cols-1 sm:p-5">
            <AdminField label="Name" value={q.full_name} />
            <AdminField label="Phone" value={q.phone} />
            <AdminField label="Email" value={q.email} mono />
          </div>
          {q.email ? (
            <div className="border-t border-slate-100 px-4 pb-4 sm:px-5">
              <a
                href={`mailto:${String(q.email).trim()}?subject=${encodeURIComponent(`Job ${q.quote_ref || ''}`)}`}
                className="inline-flex min-h-[40px] w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 sm:w-auto sm:px-5"
              >
                Email customer
              </a>
            </div>
          ) : null}
        </section>
      </div>

      {vm ? (
        <section className={cardShell}>
          <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Route summary</h3>
          </div>
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <div>
              <p className="text-[10px] font-bold uppercase text-violet-800">Pickup</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{vm.pickupCity}</p>
              <p className="mt-1 text-xs text-slate-600">{vm.pickupAddressShort}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-emerald-800">Delivery</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{vm.deliveryCity}</p>
              <p className="mt-1 text-xs text-slate-600">{vm.deliveryAddressShort}</p>
            </div>
            <div className="sm:col-span-2 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800">
                {vm.distanceDisplay}
              </span>
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800">
                {vm.arrivalLine}
              </span>
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800">
                {vm.serviceLabel}
              </span>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={cardShell}>
          <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Operational checklist</h3>
          </div>
          <ul className="space-y-2 p-4 sm:p-5">
            <ChecklistRow ok={paid} label="Payment recorded" detail={paymentStatLabel} />
            <ChecklistRow ok={hasDriver} label="Crew assigned" detail={driver || partner || 'Assign driver or partner'} />
            <ChecklistRow
              ok={mv === 'visible_in_marketplace' || mv === 'assigned'}
              label="Marketplace path"
              detail={formatMarketplaceStatusSummary(q)}
            />
            <ChecklistRow
              ok={invRows.length > 0}
              label="Inventory captured"
              detail={
                invRows.length > 0
                  ? `${invSummary.itemCount} items · ${invSummary.volumeLabel}`
                  : 'No parsed inventory'
              }
            />
            <ChecklistRow
              ok={liftReadable(vm?.pickupLiftRaw) === 'Yes' || liftReadable(vm?.deliveryLiftRaw) === 'Yes'}
              label="Lift access noted"
              detail={`P/U ${liftReadable(vm?.pickupLiftRaw)} · D/O ${liftReadable(vm?.deliveryLiftRaw)}`}
            />
          </ul>
        </section>

        <section className={cardShell}>
          <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Internal notes preview</h3>
          </div>
          <div className="p-4 sm:p-5">
            {(notesDraft || '').trim() ? (
              <p className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm text-slate-800">
                {notesDraft}
              </p>
            ) : (
              <p className="text-sm text-slate-500">No internal notes yet. Add them on the Notes tab.</p>
            )}
            <button
              type="button"
              onClick={() => onOpenTab?.('notes')}
              className="mt-3 text-sm font-semibold text-brand-700 hover:underline"
            >
              Open notes & history →
            </button>
          </div>
        </section>
      </div>

      <JobDetailsOpsTimeline q={q} overrides={overrides} />

      <AvailableJobInventorySection quote={q} />

      <QuotePhotosAdminSection
        quoteRef={photoQuoteRef}
        jobId={jobId}
        quoteRow={q}
        linkedJob={linkedJob}
        legacyPhotoFileNames={legacyPhotoFileNames}
      />
    </div>
  )
}
