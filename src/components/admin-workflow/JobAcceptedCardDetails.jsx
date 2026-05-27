import { formatDateTimeUK } from '../../lib/formatDateDisplay'
import {
  jobAcceptedTimestamps,
  quoteJobIsStarted,
  resolveAssignedDriverDisplay,
} from '../../lib/adminJobAcceptedStatus'
import { resolveQuoteCollectionAddress, resolveQuoteDeliveryAddress } from '../../lib/quoteAddressResolve'
import TruncatedAddressText from './TruncatedAddressText'

/**
 * @param {{
 *   q: Record<string, unknown>,
 *   job?: Record<string, unknown> | null,
 *   assignment?: { status?: string, updated_at?: string } | null,
 *   compact?: boolean,
 * }} props
 */
export default function JobAcceptedCardDetails({ q, job = null, assignment = null, compact = false }) {
  const ref = String(q.quote_ref || q.id || '—')
  const customer = String(q.full_name || '—')
  const collection = resolveQuoteCollectionAddress(q, job)
  const delivery = resolveQuoteDeliveryAddress(q, job)
  const { acceptedAt, startedAt } = jobAcceptedTimestamps(q, job, assignment)
  const display = resolveAssignedDriverDisplay(q, null)
  const started = quoteJobIsStarted(q, job, assignment)

  if (compact) {
    const collectionShort = collection.length > 48 ? `${collection.slice(0, 47)}…` : collection
    const deliveryShort = delivery.length > 48 ? `${delivery.slice(0, 47)}…` : delivery
    return (
      <div className="min-w-0 flex-1 text-[11px] text-slate-600">
        <span className="font-semibold text-emerald-800">From:</span> {collectionShort}
        <span className="mx-1 text-slate-300">→</span>
        <span className="font-semibold text-sky-800">To:</span> {deliveryShort}
        {display.name ? (
          <span className="ml-2 text-slate-500">
            · {display.name}
            {acceptedAt ? ` · ${formatDateTimeUK(acceptedAt)}` : ''}
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <dl className="grid gap-2 text-xs sm:grid-cols-2">
      {started ? (
        <div className="sm:col-span-2 text-[10px] text-slate-500">In progress on site or en route</div>
      ) : (
        <div className="sm:col-span-2 text-[10px] text-slate-500">Accepted — not started yet</div>
      )}
      <div>
        <dt className="font-semibold uppercase tracking-wide text-slate-500">Reference</dt>
        <dd className="font-mono font-medium text-slate-900">{ref}</dd>
      </div>
      <div>
        <dt className="font-semibold uppercase tracking-wide text-slate-500">Customer</dt>
        <dd className="font-medium text-slate-900">{customer}</dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="font-semibold uppercase tracking-wide text-slate-500">Collection</dt>
        <dd className="mt-0.5">
          <TruncatedAddressText address={collection} maxLen={88} />
        </dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="font-semibold uppercase tracking-wide text-slate-500">Delivery</dt>
        <dd className="mt-0.5">
          <TruncatedAddressText address={delivery} maxLen={88} />
        </dd>
      </div>
      <div>
        <dt className="font-semibold uppercase tracking-wide text-slate-500">Accepted</dt>
        <dd className="text-slate-800">{acceptedAt ? formatDateTimeUK(acceptedAt) : '—'}</dd>
      </div>
      {startedAt ? (
        <div>
          <dt className="font-semibold uppercase tracking-wide text-slate-500">Started</dt>
          <dd className="text-slate-800">{formatDateTimeUK(startedAt)}</dd>
        </div>
      ) : null}
      {display.marketplaceAccepted && display.partner ? (
        <div className="sm:col-span-2">
          <dt className="font-semibold uppercase tracking-wide text-slate-500">Marketplace</dt>
          <dd className="text-violet-900">Accepted by {display.partner}</dd>
        </div>
      ) : null}
    </dl>
  )
}
