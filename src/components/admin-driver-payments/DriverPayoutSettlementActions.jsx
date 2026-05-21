import { useState } from 'react'
import MarkDriverPayoutModal from './MarkDriverPayoutModal'
import { recordDriverPayoutPayment } from '../../lib/driverPayoutSettlement'

const btn =
  'rounded-lg border px-2 py-1 text-[10px] font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-50'

/**
 * @param {{
 *   quoteId: string,
 *   quote: Record<string, unknown>,
 *   charges?: Array<Record<string, unknown>>,
 *   settlement: {
 *     driverPayoutNet?: number | null,
 *     payoutRemainingBalance?: number | null,
 *     payoutSettlementStatus?: string,
 *   },
 *   onUpdated?: () => void | Promise<void>,
 *   compact?: boolean,
 * }} props
 */
export default function DriverPayoutSettlementActions({
  quoteId,
  quote,
  charges = [],
  settlement,
  onUpdated,
  compact = false,
}) {
  const [modal, setModal] = useState(
    /** @type {{ open: boolean, mode: 'full' | 'partial' | 'note_only' }} */ ({
      open: false,
      mode: 'full',
    }),
  )

  const net = settlement.driverPayoutNet ?? 0
  const remaining = settlement.payoutRemainingBalance ?? net
  const st = String(settlement.payoutSettlementStatus || 'pending')
  const isPaid = st === 'paid'
  const canPay = remaining > 0.005 && st !== 'held' && st !== 'disputed'

  async function submit(payload) {
    await recordDriverPayoutPayment(quoteId, quote, charges, payload)
    await onUpdated?.()
  }

  return (
    <>
      <div className={`flex flex-wrap gap-1 ${compact ? '' : 'mt-1'}`}>
        {canPay ? (
          <>
            <button
              type="button"
              className={`${btn} border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100`}
              onClick={() => setModal({ open: true, mode: 'full' })}
            >
              Mark as paid
            </button>
            <button
              type="button"
              className={`${btn} border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100`}
              onClick={() => setModal({ open: true, mode: 'partial' })}
            >
              Partial payment
            </button>
          </>
        ) : null}
        <button
          type="button"
          className={`${btn} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
          onClick={() => setModal({ open: true, mode: 'note_only' })}
        >
          {isPaid ? 'Add note' : 'Payment note'}
        </button>
      </div>
      <MarkDriverPayoutModal
        open={modal.open}
        onClose={() => setModal({ open: false, mode: 'full' })}
        mode={modal.mode}
        netPayable={net}
        remainingBalance={remaining}
        subtitle={String(quote.quote_ref || quoteId)}
        onSubmit={submit}
      />
    </>
  )
}
