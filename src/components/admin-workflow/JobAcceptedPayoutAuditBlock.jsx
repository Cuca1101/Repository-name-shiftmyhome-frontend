import { formatDateTimeUK } from '../../lib/formatDateDisplay'
import {
  formatJobAcceptedMoney,
  MANUAL_PAYOUT_CONFIRMED_LABEL,
} from '../../lib/jobAcceptedPaymentDisplay'

/**
 * @param {number | null | undefined} defaultPayout
 * @param {number | null | undefined} newPayout
 */
function formatDifference(defaultPayout, newPayout, stored) {
  if (stored != null && Number.isFinite(Number(stored))) {
    const d = Number(stored)
    const sign = d >= 0 ? '+' : '−'
    return `${sign}${formatJobAcceptedMoney(Math.abs(d))}`
  }
  if (
    defaultPayout != null &&
    newPayout != null &&
    Number.isFinite(Number(defaultPayout)) &&
    Number.isFinite(Number(newPayout))
  ) {
    const d = Math.round((Number(newPayout) - Number(defaultPayout)) * 100) / 100
    const sign = d >= 0 ? '+' : '−'
    return `${sign}${formatJobAcceptedMoney(Math.abs(d))}`
  }
  return '—'
}

/**
 * @param {{
 *   audit: {
 *     adminEmail?: string | null,
 *     createdAt?: string | null,
 *     defaultPayoutGbp?: number | null,
 *     newPayoutGbp?: number | null,
 *     differenceGbp?: number | null,
 *     reason?: string | null,
 *   } | null,
 *   fallback?: {
 *     defaultPayoutGbp?: number | null,
 *     newPayoutGbp?: number | null,
 *     reason?: string | null,
 *   } | null,
 *   loading?: boolean,
 *   compact?: boolean,
 * }} props
 */
export default function JobAcceptedPayoutAuditBlock({ audit, fallback = null, loading = false, compact = false }) {
  const row =
    audit && typeof audit === 'object'
      ? audit
      : fallback && typeof fallback === 'object'
        ? fallback
        : null
  if (loading) {
    return (
      <p className={`text-slate-500 ${compact ? 'text-[10px]' : 'text-xs'}`}>Loading payout audit…</p>
    )
  }
  if (!row) return null

  const admin = String(audit?.adminEmail || '').trim() || 'Admin (not recorded)'
  let changedAt = '—'
  try {
    changedAt = audit?.createdAt ? formatDateTimeUK(audit.createdAt) : '—'
  } catch {
    changedAt = '—'
  }
  const defaultPayout = row.defaultPayoutGbp
  const manualPayout = row.newPayoutGbp
  const diff = formatDifference(defaultPayout, manualPayout, audit?.differenceGbp)
  const diffNum =
    audit?.differenceGbp != null
      ? Number(audit.differenceGbp)
      : defaultPayout != null && manualPayout != null
        ? Number(manualPayout) - Number(defaultPayout)
        : null
  const reason = String(row.reason || '').trim()
  const shell = compact
    ? 'rounded-md border border-violet-100 bg-violet-50/50 px-2 py-1.5'
    : 'mt-3 rounded-lg border border-violet-200/80 bg-violet-50/60 p-3'

  return (
    <div className={shell}>
      <p className={`font-bold uppercase tracking-wide text-violet-900 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
        {MANUAL_PAYOUT_CONFIRMED_LABEL}
      </p>
      <dl className={`mt-1.5 space-y-1 ${compact ? 'text-[10px]' : 'text-xs'} text-slate-700`}>
        <div>
          <dt className="font-semibold text-slate-600">Changed by</dt>
          <dd>
            {audit?.adminEmail ? (
              <a href={`mailto:${audit.adminEmail}`} className="font-medium text-brand-700 hover:underline">
                {admin}
              </a>
            ) : (
              <span>{admin}</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-600">Changed at</dt>
          <dd>{changedAt}</dd>
        </div>
        <div className="grid gap-x-4 sm:grid-cols-3">
          <div>
            <dt className="font-semibold text-slate-600">Default payout</dt>
            <dd className="tabular-nums font-medium text-slate-900">{formatJobAcceptedMoney(defaultPayout)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-600">Manual payout</dt>
            <dd className="tabular-nums font-semibold text-violet-900">{formatJobAcceptedMoney(manualPayout)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-600">Difference</dt>
            <dd
              className={`tabular-nums font-semibold ${
                diffNum != null && diffNum < 0 ? 'text-rose-800' : diffNum != null && diffNum > 0 ? 'text-emerald-800' : 'text-slate-800'
              }`}
            >
              {diff}
            </dd>
          </div>
        </div>
        {reason ? (
          <div>
            <dt className="font-semibold text-slate-600">Reason</dt>
            <dd className="text-slate-800">{reason}</dd>
          </div>
        ) : null}
      </dl>
      {!audit && fallback ? (
        <p className={`mt-1 italic text-slate-500 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
          Audit record not found — showing current payout fields.
        </p>
      ) : null}
    </div>
  )
}
