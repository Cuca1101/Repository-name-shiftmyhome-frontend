import {
  formatJobAcceptedMoney,
  resolveJobAcceptedPaymentBreakdown,
} from '../../lib/jobAcceptedPaymentDisplay'

/**
 * Full payment breakdown for job detail (not used on list rows).
 * @param {{
 *   q: Record<string, unknown>,
 *   compact?: boolean,
 *   className?: string,
 * }} props
 */
export default function JobAcceptedPaymentBreakdown({ q, compact = false, className = '' }) {
  const b = resolveJobAcceptedPaymentBreakdown(q)
  const lineCls = compact
    ? 'text-[10px] leading-snug text-slate-700'
    : 'text-sm text-slate-800'
  const labelCls = compact ? 'text-slate-500' : 'text-slate-600'
  const valCls = 'tabular-nums font-semibold text-slate-900'
  const driverCls = 'tabular-nums font-semibold text-violet-900'
  const feeCls = 'tabular-nums font-semibold text-emerald-800'
  const balCls = 'tabular-nums font-semibold text-amber-800'
  const mutedCls = 'tabular-nums text-slate-500 line-through decoration-slate-400'

  function Line({ label, value, valueClassName = valCls }) {
    return (
      <p className={lineCls}>
        <span className={labelCls}>{label}:</span> <span className={valueClassName}>{value}</span>
      </p>
    )
  }

  const showDefaultCompare =
    b.manualPayoutOverride &&
    b.defaultDriverPayout != null &&
    b.driverPayout != null &&
    Math.abs(b.defaultDriverPayout - b.driverPayout) > 0.009

  return (
    <div className={`space-y-0.5 ${compact ? 'text-right' : 'text-left'} ${className}`.trim()}>
      <Line label="Customer total" value={formatJobAcceptedMoney(b.customerTotal)} />
      {showDefaultCompare ? (
        <Line label="Default payout" value={formatJobAcceptedMoney(b.defaultDriverPayout)} valueClassName={mutedCls} />
      ) : null}
      <Line
        label={b.manualPayoutOverride ? 'Manual payout' : 'Driver payout'}
        value={formatJobAcceptedMoney(b.driverPayout)}
        valueClassName={driverCls}
      />
      {showDefaultCompare && b.defaultPlatformFee != null ? (
        <Line
          label="Default platform fee"
          value={formatJobAcceptedMoney(b.defaultPlatformFee)}
          valueClassName={mutedCls}
        />
      ) : null}
      <Line label="Platform fee" value={formatJobAcceptedMoney(b.platformFee)} valueClassName={feeCls} />
      <Line label="Balance" value={formatJobAcceptedMoney(b.remaining)} valueClassName={balCls} />
      {b.paid != null ? <Line label="Paid" value={formatJobAcceptedMoney(b.paid)} /> : null}
      <p className={`${lineCls} mt-1`}>
        <span className={labelCls}>Deduction rule:</span>{' '}
        <span className="font-medium text-slate-900">{b.deductionLabel}</span>
        {b.marketplaceSettingsApplied ? (
          <span className="block text-[11px] font-normal text-slate-500">{b.deductionSourceCaption}</span>
        ) : null}
      </p>
      {b.payoutOverrideNote ? (
        <p className={`${lineCls} mt-1 italic text-slate-600`}>Override note: {b.payoutOverrideNote}</p>
      ) : null}
      {b.warning ? (
        <p className="mt-1 text-xs font-medium leading-snug text-amber-800">{b.warning}</p>
      ) : null}
    </div>
  )
}
