import { formatDateTimeUK, formatDateUK } from '../../lib/formatDateDisplay'
import {
  deriveCardStatusBadge,
  formatMoveArrivalSummary,
  formatVolumeAndCrew,
  parseDetailsKeyValues,
  resolveFinancials,
  shortAddressLine,
} from '../../lib/quoteJobAdminModel'
import { mergedAdminWorkflowForQuote } from '../../lib/quoteAdminWorkflowMerge'
import { getMarketplaceFinancePresentation } from '../../lib/marketplaceQuoteFinance'
import {
  partnerAcceptanceLabelForMarketplaceCard,
  partnerListingLabelForMarketplaceCard,
} from '../../lib/marketplaceListingStatus'
import { getAvailableJobWarningBadges, getMarketplaceJobWarningBadges } from '../../lib/adminJobWarningBadges'
import JobStatusBadge from './JobStatusBadge'
import JobActionsMenu from './JobActionsMenu'
import MarketplaceJobRemoveButton from './MarketplaceJobRemoveButton'

function money(n) {
  if (n == null || n === '') return '—'
  return `£${Number(n).toFixed(2)}`
}

/**
 * @param {{
 *   q: Record<string, unknown>,
 *   statusBadge?: { label: string, tone?: string } | null,
 *   workflowRows?: { label: string, value: string }[],
 *   showQuickActions?: boolean,
 *   adminSlot?: unknown,
 *   listVariant?: 'available' | 'marketplace' | null,
 *   onAssignDriver?: () => void,
 *   onMarketplace?: () => void,
 *   selectionCheckbox?: unknown,
 *   marketplaceOnApplied?: () => void | Promise<void>,
 * }} props
 */
export default function JobCard({
  q,
  statusBadge = null,
  workflowRows = [],
  showQuickActions = true,
  adminSlot = null,
  listVariant = null,
  onAssignDriver,
  onMarketplace,
  selectionCheckbox = null,
  marketplaceOnApplied,
}) {
  const id = String(q.id)
  const ref = q.quote_ref ? String(q.quote_ref) : id.slice(0, 8)
  const kv = parseDetailsKeyValues(q.details)
  const overrides = mergedAdminWorkflowForQuote(q)
  const adjSum = (overrides.adjustments || []).reduce((s, a) => s + Number(a.amountGbp) || 0, 0)
  const fin = resolveFinancials(q, adjSum)
  const badge = statusBadge ?? deriveCardStatusBadge(q)
  const moveWhen = q.move_date ? formatDateUK(q.move_date) : '—'
  const arrival = formatMoveArrivalSummary(q, kv)
  const service = String(q.service || q.service_type || kv['Selected service'] || '—')
  const volCrew = formatVolumeAndCrew(q)
  const warningBadges =
    listVariant === 'available'
      ? getAvailableJobWarningBadges(q)
      : listVariant === 'marketplace'
        ? getMarketplaceJobWarningBadges(q)
        : []

  const mpFin = listVariant === 'marketplace' ? getMarketplaceFinancePresentation(q) : null
  const partnerListingLabel = listVariant === 'marketplace' ? partnerListingLabelForMarketplaceCard(q) : null
  const partnerAcceptanceLabel = listVariant === 'marketplace' ? partnerAcceptanceLabelForMarketplaceCard(q) : null

  function fmtGbp(v) {
    if (v == null || !Number.isFinite(v)) return '—'
    return money(v)
  }

  return (
    <li className="flex flex-col rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/[0.04]">
      {selectionCheckbox ? <div className="mb-3">{selectionCheckbox}</div> : null}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold uppercase tracking-wide text-slate-500">Job ref</p>
          <p className="truncate font-mono text-sm font-bold text-slate-900">{ref}</p>
        </div>
        <JobStatusBadge label={badge.label} tone={badge.tone} />
      </div>

      <p className="mt-3 truncate text-base font-semibold text-slate-900">{q.full_name || '—'}</p>

      {warningBadges.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5" role="status" aria-label="Admin warnings">
          {warningBadges.map((b) => (
            <JobStatusBadge key={b.label} label={b.label} tone={b.tone} />
          ))}
        </div>
      ) : null}

      {workflowRows.length > 0 ? (
        <dl className="mt-3 space-y-1.5 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs">
          {workflowRows.map((row) => (
            <div key={row.label} className="flex justify-between gap-2 text-slate-700">
              <dt className="shrink-0 font-semibold text-slate-500">{row.label}</dt>
              <dd className="min-w-0 text-right font-medium text-slate-900">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <dl className="mt-3 space-y-2 text-xs text-slate-600">
        <div className="flex justify-between gap-2">
          <dt className="shrink-0 text-slate-500">Move</dt>
          <dd className="min-w-0 text-right font-medium text-slate-800">
            {moveWhen}
            <span className="block text-[11px] font-normal text-slate-500">{arrival}</span>
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="shrink-0 text-slate-500">Pickup</dt>
          <dd className="min-w-0 text-right text-slate-800">{shortAddressLine(q.pickup_address)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="shrink-0 text-slate-500">Dropoff</dt>
          <dd className="min-w-0 text-right text-slate-800">{shortAddressLine(q.delivery_address)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="shrink-0 text-slate-500">Service</dt>
          <dd className="min-w-0 truncate text-right font-medium text-slate-800">{service}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="shrink-0 text-slate-500">Volume · crew</dt>
          <dd className="min-w-0 text-right text-slate-800">{volCrew}</dd>
        </div>
      </dl>

      {listVariant === 'marketplace' && mpFin ? (
        <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-3 text-[11px] sm:text-xs">
          <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Customer total</p>
              <p className="mt-0.5 font-bold tabular-nums text-slate-900">{fmtGbp(mpFin.customerTotal)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Marketplace payout</p>
              <p className="mt-0.5 font-bold tabular-nums text-violet-950">{fmtGbp(mpFin.marketplacePayout)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Platform profit</p>
              <p className="mt-0.5 font-bold tabular-nums text-slate-900">{fmtGbp(mpFin.platformProfit)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Deduction used</p>
              <p className="mt-0.5 font-medium text-slate-800">{mpFin.deductionLabel}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Payment status</p>
              <p className="mt-0.5 font-medium capitalize text-slate-800">
                {mpFin.paymentStatus.replace(/_/g, ' ')}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Remaining balance</p>
              <p className="mt-0.5 font-bold tabular-nums text-amber-800">{fmtGbp(mpFin.remainingBalance)}</p>
            </div>
          </div>
          <p className="mt-2 border-t border-violet-100/80 pt-2 text-[10px] text-slate-500">
            Paid to date {fmtGbp(mpFin.paid)} · customer charge unchanged
          </p>
          {partnerListingLabel ? (
            <p className="mt-2 text-[10px] font-semibold text-violet-950/90">Partner listing: {partnerListingLabel}</p>
          ) : null}
          {partnerAcceptanceLabel ? (
            <p className="mt-1 text-[10px] font-semibold text-violet-950/90">
              Partner acceptance: {partnerAcceptanceLabel}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50/90 px-3 py-3 text-center">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Total</p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
              {fin.customerTotal != null ? money(fin.customerTotal) : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Paid</p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-emerald-700">{money(fin.paid)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Balance</p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-amber-800">
              {fin.remaining != null ? money(fin.remaining) : '—'}
            </p>
          </div>
        </div>
      )}

      {adminSlot}

      {listVariant === 'marketplace' && marketplaceOnApplied ? (
        <div className="mt-3">
          <MarketplaceJobRemoveButton quote={q} onApplied={marketplaceOnApplied} />
        </div>
      ) : null}

      <JobActionsMenu
        quoteId={id}
        showQuickActions={showQuickActions}
        onAssignDriver={onAssignDriver}
        onMarketplace={onMarketplace}
      />

      <p className="mt-3 text-[10px] text-slate-400">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">quotes</span>{' '}
        row · {formatDateTimeUK(q.created_at)}
      </p>
    </li>
  )
}

export { money }
