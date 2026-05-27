import { Link } from 'react-router-dom'
import { formatDateUK } from '../../lib/formatDateDisplay'
import { formatAdminJobBookedLine } from '../../lib/adminJobBookedAt'
import {
  deriveCardStatusBadge,
  formatMoveArrivalSummary,
  formatVolumeAndCrew,
  parseDetailsKeyValues,
  resolveFinancials,
} from '../../lib/quoteJobAdminModel'
import { mergedAdminWorkflowForQuote } from '../../lib/quoteAdminWorkflowMerge'
import { getAvailableJobWarningBadges, getMarketplaceJobWarningBadges } from '../../lib/adminJobWarningBadges'
import { getMarketplaceFinancePresentation } from '../../lib/marketplaceQuoteFinance'
import { PAYOUT_FIXED_FROM_AVAILABLE_LABEL } from '../../lib/marketplacePayoutDisplay'
import {
  partnerAcceptanceLabelForMarketplaceCard,
  partnerListingLabelForMarketplaceCard,
} from '../../lib/marketplaceListingStatus'
import JobStatusBadge from './JobStatusBadge'
import { isQuoteDemoOrTest } from '../../lib/demoTestRecordDetection'
import { showDemoAdminUi } from '../../lib/adminProductionMode'
import { getAutoMarketplaceCardBadge } from '../../lib/autoMarketplacePublish'
import { resolveQuoteCollectionAddress, resolveQuoteDeliveryAddress } from '../../lib/quoteAddressResolve'
import TruncatedAddressText from './TruncatedAddressText'

function money(n) {
  if (n == null || n === '') return '—'
  return `£${Number(n).toFixed(2)}`
}

/** @param {unknown} address */
function extractPostcode(address) {
  const s = String(address ?? '').trim()
  const pc = s.match(/([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\s*$/i)
  return pc ? pc[1].toUpperCase() : null
}

/** @param {unknown} address */
function cityFromAddress(address) {
  const s = String(address || '').trim()
  if (!s) return '—'
  const parts = s.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const candidate = parts[parts.length - 2]
    if (candidate && !/^[A-Z]{1,2}\d/i.test(candidate)) return candidate
  }
  return parts[0] || '—'
}

/** @param {unknown} address */
function routeLocationLabel(address) {
  const city = cityFromAddress(address)
  const pc = extractPostcode(address)
  if (city !== '—' && pc) return `${city} · ${pc}`
  if (pc) return pc
  return city
}

/**
 * @param {Record<string, unknown>} q
 * @param {ReturnType<typeof mergedAdminWorkflowForQuote>} overrides
 */
function assignmentBadge(q, overrides) {
  const driver = String(q.assigned_driver_name || overrides.assignedDriver || '').trim()
  const partner = String(q.assigned_partner_company || overrides.assignedPartnerCompany || '').trim()
  if (driver) {
    const label = driver.length > 22 ? `${driver.slice(0, 21)}…` : driver
    return { label, tone: 'emerald' }
  }
  if (partner) {
    const label = partner.length > 22 ? `${partner.slice(0, 21)}…` : partner
    return { label, tone: 'sky' }
  }
  return null
}

/**
 * @param {ReturnType<typeof resolveFinancials>} fin
 * @param {Record<string, unknown>} q
 */
function paymentBadge(fin, q) {
  const ps = String(q.payment_status || '').toLowerCase()
  const remaining = fin.remaining != null ? Number(fin.remaining) : null
  if (ps === 'paid' || (remaining != null && remaining <= 0 && fin.paid > 0)) {
    return { label: 'Paid', tone: 'emerald' }
  }
  if (ps === 'deposit_paid' || (fin.paid > 0 && remaining != null && remaining > 0)) {
    return { label: 'Deposit', tone: 'amber' }
  }
  if (fin.paid > 0) return { label: 'Partial', tone: 'amber' }
  return { label: 'Unpaid', tone: 'slate' }
}

function PickupPinIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function DeliveryHomeIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7A1 1 0 003 10v6a1 1 0 001 1h4a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h4a1 1 0 001-1v-6a1 1 0 00-.293-.707l-7-7z" />
    </svg>
  )
}

/**
 * @param {{ from: string, to: string, className?: string }} props
 */
/**
 * @param {{ q: Record<string, unknown>, className?: string }} props
 */
function JobAcceptedRouteSummary({ q, className = '' }) {
  const collection = resolveQuoteCollectionAddress(q)
  const delivery = resolveQuoteDeliveryAddress(q)
  return (
    <div className={`space-y-1.5 text-xs ${className}`.trim()}>
      <p className="min-w-0 leading-snug">
        <span className="font-semibold text-emerald-800">Collection: </span>
        <TruncatedAddressText address={collection} maxLen={64} className="inline" />
      </p>
      <p className="min-w-0 leading-snug">
        <span className="font-semibold text-sky-800">Delivery: </span>
        <TruncatedAddressText address={delivery} maxLen={64} className="inline" />
      </p>
    </div>
  )
}

function RouteLine({ from, to, className = '' }) {
  return (
    <p
      className={`flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-slate-800 ${className}`.trim()}
    >
      <span className="inline-flex min-w-0 max-w-full items-center gap-1 font-medium text-slate-900">
        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-emerald-700">
          <PickupPinIcon />
        </span>
        <span className="truncate">{from}</span>
      </span>
      <span className="shrink-0 text-slate-300" aria-hidden>
        →
      </span>
      <span className="inline-flex min-w-0 max-w-full items-center gap-1 font-medium text-slate-900">
        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-sky-700">
          <DeliveryHomeIcon />
        </span>
        <span className="truncate">{to}</span>
      </span>
    </p>
  )
}

/**
 * @param {{
 *   fin: ReturnType<typeof resolveFinancials>,
 *   compact?: boolean,
 * }} props
 */
function PaymentStrip({ fin, compact = false }) {
  const cell = compact
    ? 'text-right'
    : 'flex flex-col items-center justify-center rounded-lg bg-slate-50/90 px-2 py-1.5 text-center'
  const labelCls = 'text-[10px] font-semibold uppercase tracking-wide text-slate-500'
  const valueCls = compact
    ? 'text-sm font-bold tabular-nums text-slate-900'
    : 'mt-0.5 text-sm font-bold tabular-nums text-slate-900'

  const rows = [
    { label: 'Total', value: fin.customerTotal != null ? money(fin.customerTotal) : '—', tone: '' },
    { label: 'Paid', value: money(fin.paid), tone: 'text-emerald-700' },
    { label: 'Balance', value: fin.remaining != null ? money(fin.remaining) : '—', tone: 'text-amber-800' },
  ]

  if (compact) {
    return (
      <dl className="grid shrink-0 grid-cols-3 gap-x-4 gap-y-0 text-xs sm:gap-x-6">
        {rows.map((r) => (
          <div key={r.label} className={cell}>
            <dt className={labelCls}>{r.label}</dt>
            <dd className={`${valueCls} ${r.tone}`.trim()}>{r.value}</dd>
          </div>
        ))}
      </dl>
    )
  }

  return (
    <dl className="grid grid-cols-3 gap-2 border-t border-slate-100 bg-slate-50/60 px-3 py-2.5">
      {rows.map((r) => (
        <div key={r.label} className={cell}>
          <dt className={labelCls}>{r.label}</dt>
          <dd className={`${valueCls} ${r.tone}`.trim()}>{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * @param {{ mpFin: ReturnType<typeof getMarketplaceFinancePresentation>, compact?: boolean }} props
 */
function MarketplacePaymentStrip({ mpFin, compact = false }) {
  function fmt(v) {
    if (v == null || !Number.isFinite(v)) return '—'
    return money(v)
  }
  const rows = [
    { label: 'Customer', value: fmt(mpFin.customerTotal), tone: '' },
    { label: 'Payout', value: fmt(mpFin.marketplacePayout), tone: 'text-violet-900' },
    { label: 'Balance', value: fmt(mpFin.remainingBalance), tone: 'text-amber-800' },
  ]
  const cell = compact ? 'text-right' : 'flex flex-col items-center justify-center text-center'
  const labelCls = 'text-[10px] font-semibold uppercase tracking-wide text-slate-500'
  const valueCls = 'text-sm font-bold tabular-nums text-slate-900'

  if (compact) {
    return (
      <dl className="grid shrink-0 grid-cols-3 gap-x-4 text-xs sm:gap-x-6">
        {rows.map((r) => (
          <div key={r.label} className={cell}>
            <dt className={labelCls}>{r.label}</dt>
            <dd className={`${valueCls} ${r.tone}`.trim()}>{r.value}</dd>
          </div>
        ))}
      </dl>
    )
  }

  return (
    <dl className="grid grid-cols-3 gap-2 border-t border-violet-100/80 bg-violet-50/40 px-3 py-2.5">
      {rows.map((r) => (
        <div key={r.label} className={cell}>
          <dt className={labelCls}>{r.label}</dt>
          <dd className={`${valueCls} ${r.tone}`.trim()}>{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}

const viewDetailsClass =
  'inline-flex min-h-[36px] items-center justify-center rounded-lg bg-brand-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700'

/**
 * @param {{
 *   quoteId: string,
 *   q: Record<string, unknown>,
 *   className?: string,
 *   linkLabel?: string,
 * }} props
 */
function ViewDetailsWithBooked({ quoteId, q, className = '', linkLabel = 'View Details' }) {
  const bookedLine = formatAdminJobBookedLine(q)
  return (
    <div className={`flex min-w-0 flex-col items-stretch gap-1 sm:items-end ${className}`.trim()}>
      <Link
        to={`/admin/available-jobs/${quoteId}`}
        className={`${viewDetailsClass} w-full sm:w-auto sm:min-w-[7.5rem]`}
      >
        {linkLabel}
      </Link>
      {bookedLine ? (
        <p className="text-center text-[10px] font-medium text-slate-500 sm:text-right">{bookedLine}</p>
      ) : null}
    </div>
  )
}

/**
 * @param {{ moveWhen: string, arrival: string, emphasis?: boolean }} props
 */
function MoveSchedule({ moveWhen, arrival, emphasis = false }) {
  if (emphasis) {
    return (
      <div className="mt-2">
        <p className="text-sm font-semibold text-slate-900">{moveWhen}</p>
        {arrival && arrival !== '—' ? (
          <p className="mt-1 text-sm font-semibold leading-snug text-slate-800">{arrival}</p>
        ) : null}
      </div>
    )
  }
  return (
    <p className="mt-1.5 text-xs font-medium text-slate-800">
      {moveWhen}
      {arrival && arrival !== '—' ? (
        <span className="font-normal text-slate-500"> · {arrival}</span>
      ) : null}
    </p>
  )
}

/**
 * @param {{
 *   q: Record<string, unknown>,
 *   quoteRef: string,
 *   moveWhen: string,
 *   arrival: string,
 *   selectionCheckbox?: unknown,
 *   keyBadges: import('react').ReactNode,
 *   badgesDesktop?: boolean,
 * }} props
 */
function JobIdentityColumn({
  q,
  quoteRef,
  moveWhen,
  arrival,
  selectionCheckbox,
  keyBadges,
  badgesDesktop = true,
}) {
  const emphasis = badgesDesktop
  return (
    <div className="min-w-0 flex-1 lg:max-w-[15rem] lg:shrink-0">
      {selectionCheckbox ? <div className="mb-2">{selectionCheckbox}</div> : null}
      <p
        className={`truncate text-slate-900 ${emphasis ? 'text-base font-bold tracking-tight' : 'text-sm font-semibold'}`}
      >
        {q.full_name || '—'}
      </p>
      <p
        className={`font-mono ${emphasis ? 'text-xs font-bold text-slate-700' : 'text-[10px] font-medium text-slate-500'}`}
      >
        {quoteRef}
      </p>
      <MoveSchedule moveWhen={moveWhen} arrival={arrival} emphasis={emphasis} />
      <div className={badgesDesktop ? 'mt-2 lg:hidden' : 'mt-2'}>{keyBadges}</div>
    </div>
  )
}

/**
 * @param {{ rows: { label: string, value: string }[] }} props
 */
function WorkflowHint({ rows }) {
  const top = rows.slice(0, 2)
  if (!top.length) return null
  return (
    <div className="space-y-0.5 text-[11px] text-slate-600">
      {top.map((row) => (
        <p key={row.label} className="line-clamp-1">
          <span className="font-semibold text-slate-500">{row.label}:</span> {row.value}
        </p>
      ))}
    </div>
  )
}

/**
 * Premium compact operations card for admin job lists.
 * @param {{
 *   q: Record<string, unknown>,
 *   cardVariant?: 'available' | 'marketplace' | 'active' | 'completed' | 'cancelled' | 'default',
 *   statusBadge?: { label: string, tone?: string } | null,
 *   workflowRows?: { label: string, value: string }[],
 *   layoutMode?: 'grid' | 'list',
 *   selectionCheckbox?: unknown,
 *   secondarySlot?: unknown,
 *   highlight?: boolean,
 *   viewJobLabel?: string,
 * }} props
 */
export default function AdminJobOperationsCard({
  q,
  cardVariant = 'default',
  statusBadge = null,
  workflowRows = [],
  layoutMode = 'list',
  selectionCheckbox = null,
  secondarySlot = null,
  highlight = false,
  viewJobLabel,
}) {
  const id = String(q.id)
  const ref = q.quote_ref ? String(q.quote_ref) : id.slice(0, 8)
  const kv = parseDetailsKeyValues(q.details)
  const overrides = mergedAdminWorkflowForQuote(q)
  const adjSum = (overrides.adjustments || []).reduce((s, a) => s + (Number(a.amountGbp) || 0), 0)
  const fin = resolveFinancials(q, adjSum)
  const workflowBadge = statusBadge ?? deriveCardStatusBadge(q)
  const payBadge = paymentBadge(fin, q)
  const assign = assignmentBadge(q, overrides)
  const moveWhen = q.move_date ? formatDateUK(q.move_date) : '—'
  const arrival = formatMoveArrivalSummary(q, kv)
  const service = String(q.service || q.service_type || kv['Selected service'] || '—')
  const volCrew = formatVolumeAndCrew(q)
  const warningBadges =
    cardVariant === 'available'
      ? getAvailableJobWarningBadges(q)
      : cardVariant === 'marketplace'
        ? getMarketplaceJobWarningBadges(q)
        : []
  const autoMpBadge = cardVariant === 'available' ? getAutoMarketplaceCardBadge(q) : null
  const pickupLabel = routeLocationLabel(q.pickup_address)
  const deliveryLabel = routeLocationLabel(q.delivery_address)
  const mpFin = cardVariant === 'marketplace' ? getMarketplaceFinancePresentation(q) : null
  const partnerListingLabel =
    cardVariant === 'marketplace' ? partnerListingLabelForMarketplaceCard(q) : null
  const partnerAcceptanceLabel =
    cardVariant === 'marketplace' ? partnerAcceptanceLabelForMarketplaceCard(q) : null

  const keyBadges = (
    <div className="flex flex-wrap gap-1" role="status" aria-label="Job status">
      <JobStatusBadge label={workflowBadge.label} tone={workflowBadge.tone} />
      {payBadge.label !== workflowBadge.label ? (
        <JobStatusBadge label={payBadge.label} tone={payBadge.tone} />
      ) : null}
      {assign ? <JobStatusBadge label={assign.label} tone={assign.tone} /> : null}
      {cardVariant === 'available' && !assign ? (
        <JobStatusBadge label="Unassigned" tone="amber" />
      ) : null}
      {showDemoAdminUi() && isQuoteDemoOrTest(q) ? (
        <JobStatusBadge label="Test record" tone="slate" />
      ) : null}
      {autoMpBadge ? <JobStatusBadge label={autoMpBadge.label} tone={autoMpBadge.tone} /> : null}
      {warningBadges.slice(0, 2).map((b) => (
        <JobStatusBadge key={b.label} label={b.label} tone={b.tone} />
      ))}
    </div>
  )

  const metaChips = (
    <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-600">
      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-800">{service}</span>
      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">{volCrew}</span>
    </div>
  )

  const highlightClass = highlight
    ? 'ring-2 ring-emerald-400/90 bg-emerald-50/40 animate-[available-job-highlight_2s_ease-out_1]'
    : ''

  const financeBlock =
    cardVariant === 'marketplace' && mpFin ? (
      <MarketplacePaymentStrip mpFin={mpFin} compact={layoutMode === 'list'} />
    ) : (
      <PaymentStrip fin={fin} compact={layoutMode === 'list'} />
    )

  const marketplaceHints =
    cardVariant === 'marketplace' && (partnerListingLabel || partnerAcceptanceLabel) ? (
      <p className="line-clamp-2 text-[10px] text-violet-900/90">
        {partnerListingLabel ? `Listing: ${partnerListingLabel}` : ''}
        {partnerListingLabel && partnerAcceptanceLabel ? ' · ' : ''}
        {partnerAcceptanceLabel ? `Acceptance: ${partnerAcceptanceLabel}` : ''}
      </p>
    ) : null

  const marketplacePayoutMeta =
    cardVariant === 'marketplace' && mpFin ? (
      <div className="flex flex-wrap gap-1">
        {mpFin.payoutFixedFromAvailableJobs ? (
          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-900 ring-1 ring-emerald-200/90">
            {PAYOUT_FIXED_FROM_AVAILABLE_LABEL}
          </span>
        ) : null}
        {mpFin.payoutIsEstimated && mpFin.payoutWarning ? (
          <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold text-amber-950 ring-1 ring-amber-200/90">
            {mpFin.payoutWarning}
          </span>
        ) : null}
      </div>
    ) : null

  const isActiveWithActions = cardVariant === 'active' && Boolean(secondarySlot)
  const useFullRoute =
    !isActiveWithActions &&
    (cardVariant === 'active' ||
      cardVariant === 'available' ||
      cardVariant === 'marketplace' ||
      layoutMode === 'list')

  const routeColumn = (
    <div className="min-w-0 flex-[1.4] space-y-1.5">
      {isActiveWithActions ? null : useFullRoute ? (
        <JobAcceptedRouteSummary q={q} />
      ) : (
        <RouteLine from={pickupLabel} to={deliveryLabel} />
      )}
      {metaChips}
      {workflowRows.length > 0 ? <WorkflowHint rows={workflowRows} /> : null}
      {marketplaceHints}
      {marketplacePayoutMeta}
      <div className="hidden lg:block">{keyBadges}</div>
    </div>
  )

  if (isActiveWithActions && layoutMode === 'list') {
    return (
      <li
        className={`overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)] ${highlightClass}`.trim()}
      >
        <div className="p-3 sm:p-3.5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-4">
            <JobIdentityColumn
              q={q}
              quoteRef={ref}
              moveWhen={moveWhen}
              arrival={arrival}
              selectionCheckbox={selectionCheckbox}
              keyBadges={keyBadges}
            />
            {routeColumn}
            <div className="shrink-0 lg:pt-0.5">{financeBlock}</div>
          </div>
          <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <div className="min-w-0 flex-1">{secondarySlot}</div>
            <ViewDetailsWithBooked quoteId={id} q={q} className="w-full shrink-0 sm:w-auto" linkLabel={viewJobLabel} />
          </div>
        </div>
      </li>
    )
  }

  if (isActiveWithActions && layoutMode === 'grid') {
    return (
      <li
        className={`flex flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)] ${highlightClass}`.trim()}
      >
        <div className="flex flex-1 flex-col p-3.5">
          {selectionCheckbox ? <div className="mb-2">{selectionCheckbox}</div> : null}
          <p className="truncate text-base font-bold tracking-tight text-slate-900">{q.full_name || '—'}</p>
          <p className="font-mono text-xs font-bold text-slate-700">{ref}</p>
          <MoveSchedule moveWhen={moveWhen} arrival={arrival} emphasis />
          <div className="mt-2">{keyBadges}</div>
          <div className="mt-2.5 space-y-1.5">
            {isActiveWithActions ? null : <JobAcceptedRouteSummary q={q} />}
            {metaChips}
            {workflowRows.length > 0 ? <WorkflowHint rows={workflowRows} /> : null}
          </div>
        </div>
        <PaymentStrip fin={fin} />
        <div className="space-y-3 border-t border-slate-100 px-3.5 py-3">
          <div className="min-w-0">{secondarySlot}</div>
          <ViewDetailsWithBooked quoteId={id} q={q} className="w-full" linkLabel={viewJobLabel} />
        </div>
      </li>
    )
  }

  if (layoutMode === 'list') {
    return (
      <li
        className={`overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)] ${highlightClass}`.trim()}
      >
        <div className="flex flex-col gap-3 p-3 sm:p-3.5 lg:flex-row lg:items-center lg:gap-4">
          <JobIdentityColumn
            q={q}
            quoteRef={ref}
            moveWhen={moveWhen}
            arrival={arrival}
            selectionCheckbox={selectionCheckbox}
            keyBadges={keyBadges}
            badgesDesktop={false}
          />
          {routeColumn}
          <div className="flex min-w-0 flex-col gap-2 lg:shrink-0 lg:gap-3">
            {financeBlock}
            {secondarySlot ? <div className="min-w-0">{secondarySlot}</div> : null}
            <ViewDetailsWithBooked quoteId={id} q={q} className="w-full" linkLabel={viewJobLabel} />
          </div>
        </div>
      </li>
    )
  }

  return (
    <li
      className={`flex flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)] ${highlightClass}`.trim()}
    >
      <div className="flex flex-1 flex-col p-3.5">
        {selectionCheckbox ? <div className="mb-2">{selectionCheckbox}</div> : null}
        <p className="truncate text-sm font-semibold text-slate-900">{q.full_name || '—'}</p>
        <p className="font-mono text-[10px] font-medium text-slate-500">{ref}</p>
        <p className="mt-1.5 text-xs font-medium text-slate-800">
          {moveWhen}
          {arrival && arrival !== '—' ? (
            <span className="font-normal text-slate-500"> · {arrival}</span>
          ) : null}
        </p>
        <div className="mt-2">{keyBadges}</div>
        <div className="mt-2.5 space-y-1.5">
          <RouteLine from={pickupLabel} to={deliveryLabel} />
          {metaChips}
          {workflowRows.length > 0 ? <WorkflowHint rows={workflowRows} /> : null}
          {marketplaceHints}
        </div>
      </div>
      {cardVariant === 'marketplace' && mpFin ? (
        <MarketplacePaymentStrip mpFin={mpFin} />
      ) : (
        <PaymentStrip fin={fin} />
      )}
      {secondarySlot ? <div className="border-t border-slate-100 px-3 pb-2 pt-2">{secondarySlot}</div> : null}
      <div className="border-t border-slate-100 p-3 pt-2">
        <ViewDetailsWithBooked quoteId={id} q={q} className="w-full" linkLabel={viewJobLabel} />
      </div>
    </li>
  )
}
