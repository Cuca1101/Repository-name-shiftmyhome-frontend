import {
  computeAbandonmentAnalytics,
  computeFunnelStats,
  exportAbandonedLeadsCsv,
  recoveryStatusForLead,
} from '../../lib/websiteLeadRecovery'

function money(n) {
  if (n == null || n === '') return '—'
  return `£${Number(n).toFixed(2)}`
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-slate-500">{sub}</p> : null}
    </div>
  )
}

export function RecoveryBadge({ row }) {
  const label = recoveryStatusForLead(row)
  const tone =
    label === 'Recovered'
      ? 'bg-emerald-50 text-emerald-900 ring-emerald-200'
      : label === 'Sent' || label === 'Opened' || label === 'Clicked'
        ? 'bg-indigo-50 text-indigo-900 ring-indigo-200'
        : label === 'Scheduled'
          ? 'bg-violet-50 text-violet-900 ring-violet-200'
          : 'bg-slate-50 text-slate-700 ring-slate-200'
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tone}`}>
      {label}
    </span>
  )
}

export const RECOVERY_CHIPS = [
  { id: '', label: 'All leads' },
  { id: 'recovery_sent', label: 'Recovery Email Sent' },
  { id: 'feedback', label: 'Feedback Received' },
  { id: 'recovered', label: 'Recovered' },
  { id: 'high_value', label: 'High Value Leads' },
]

export default function WebsiteLeadsRecoveryPanel({
  allRows,
  recoveryChip,
  onRecoveryChipChange,
  rows,
}) {
  const stats = computeFunnelStats(allRows)
  const analytics = computeAbandonmentAnalytics(allRows)

  function exportAbandoned() {
    const abandoned = rows.filter((r) => (r.effective_status || r.status) === 'quote_abandoned')
    const csv = exportAbandonedLeadsCsv(abandoned)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `abandoned-leads-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total visitors" value={stats.visitors} />
        <StatCard label="Started quotes" value={stats.started} />
        <StatCard label="Abandoned" value={stats.abandoned} />
        <StatCard label="Recovery emails" value={stats.recoverySent} />
        <StatCard label="Recovered" value={stats.recovered} />
        <StatCard label="Conversion" value={`${stats.conversionPct}%`} sub={`${stats.completed} paid`} />
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-900 p-4 text-white sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-300">Top abandon reason</p>
          <p className="mt-1 text-sm font-bold">{analytics.topReason?.label || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-300">Avg abandoned value</p>
          <p className="mt-1 text-sm font-bold">
            {analytics.avgAbandonedValue != null ? money(analytics.avgAbandonedValue) : '—'}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-300">Recovery conversion</p>
          <p className="mt-1 text-sm font-bold">{analytics.recoveryConversionPct}%</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-300">Top city</p>
          <p className="mt-1 text-sm font-bold">{analytics.topCity?.label || '—'}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {RECOVERY_CHIPS.map((c) => (
          <button
            key={c.id || 'all'}
            type="button"
            onClick={() => onRecoveryChipChange(c.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition ${
              recoveryChip === c.id
                ? 'bg-brand-700 text-white ring-brand-700'
                : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {c.label}
          </button>
        ))}
        <button
          type="button"
          onClick={exportAbandoned}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
        >
          Export abandoned leads
        </button>
      </div>
    </div>
  )
}
