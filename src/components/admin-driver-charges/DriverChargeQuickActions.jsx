import { useCallback, useEffect, useState } from 'react'
import DriverChargeModal from './DriverChargeModal'
import {
  fetchDriverChargesByQuoteIds,
  removeDriverCharge,
} from '../../lib/data/driverChargesRepository'
import { normalizeDriverChargeStatus } from '../../lib/driverChargeStatus'
import { driverChargeTypeLabel } from '../../lib/driverChargeConstants'

const btn =
  'rounded border border-rose-200/90 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-950 hover:bg-rose-100'

/**
 * @param {{
 *   driverId?: string,
 *   quoteId?: string | null,
 *   jobId?: string | null,
 *   quoteRef?: string,
 *   onUpdated?: () => void | Promise<void>,
 *   layout?: 'row' | 'menu',
 * }} props
 */
export default function DriverChargeQuickActions({
  driverId = '',
  quoteId = null,
  jobId = null,
  quoteRef = '',
  onUpdated,
  layout = 'row',
}) {
  const [modal, setModal] = useState(
    /** @type {{ open: boolean, chargeType: string }} */ ({ open: false, chargeType: 'admin_adjustment' }),
  )
  const [quoteCharges, setQuoteCharges] = useState([])

  const loadQuoteCharges = useCallback(async () => {
    const qid = quoteId != null ? String(quoteId).trim() : ''
    if (!qid) {
      setQuoteCharges([])
      return
    }
    try {
      const rows = await fetchDriverChargesByQuoteIds([qid])
      setQuoteCharges(rows)
    } catch {
      setQuoteCharges([])
    }
  }, [quoteId])

  useEffect(() => {
    void loadQuoteCharges()
  }, [loadQuoteCharges])

  async function waiveCharge(charge) {
    const reason = window.prompt('Why are you removing this charge?', 'Waived from job assignment')
    if (!reason?.trim()) return
    await removeDriverCharge(charge, reason.trim())
    await loadQuoteCharges()
    await onUpdated?.()
  }

  function openType(chargeType) {
    setModal({ open: true, chargeType })
  }

  const wrap = layout === 'row' ? 'flex flex-wrap gap-1' : 'flex flex-col gap-1'
  const waiveBtn =
    'rounded border border-emerald-200/90 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-950 hover:bg-emerald-100'

  const waivable = quoteCharges.filter((c) => normalizeDriverChargeStatus(c.status) !== 'removed')

  return (
    <>
      <div className={wrap}>
        <button type="button" className={btn} onClick={() => openType('admin_adjustment')}>
          Add charge
        </button>
        <button type="button" className={btn} onClick={() => openType('damage')}>
          Damage
        </button>
        <button type="button" className={btn} onClick={() => openType('cancellation')}>
          Cancellation
        </button>
        <button type="button" className={btn} onClick={() => openType('deallocation')}>
          Deallocation
        </button>
        {waivable.map((c) => (
          <button
            key={String(c.id)}
            type="button"
            className={waiveBtn}
            title={`Waive ${driverChargeTypeLabel(c.chargeType)} £${Number(c.amount).toFixed(2)}`}
            onClick={() => void waiveCharge(c)}
          >
            Waive {driverChargeTypeLabel(c.chargeType).split(' ')[0]}
          </button>
        ))}
      </div>
      <DriverChargeModal
        open={modal.open}
        onClose={() => setModal({ open: false, chargeType: 'admin_adjustment' })}
        onSaved={async () => {
          await loadQuoteCharges()
          await onUpdated?.()
        }}
        initialDriverId={driverId}
        initialQuoteId={quoteId}
        initialJobId={jobId}
        initialQuoteRef={quoteRef}
        initialChargeType={modal.chargeType}
      />
    </>
  )
}
