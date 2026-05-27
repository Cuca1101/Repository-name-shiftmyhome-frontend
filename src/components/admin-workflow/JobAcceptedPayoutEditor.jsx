import { useState } from 'react'

import JobDriverPayoutOverrideModal from './JobDriverPayoutOverrideModal'

import JobAcceptedPaymentBreakdown from './JobAcceptedPaymentBreakdown'

import JobAcceptedPayoutAuditBlock from './JobAcceptedPayoutAuditBlock'

import {

  MANUAL_PAYOUT_CONFIRMED_LABEL,

  resolveJobAcceptedPaymentBreakdown,

} from '../../lib/jobAcceptedPaymentDisplay'

import { useLatestDriverPayoutAudit } from '../../lib/useLatestDriverPayoutAudit'



/**

 * Full payout controls for job detail (breakdown, edit; confirmed overrides cannot be reset).

 * @param {{

 *   q: Record<string, unknown>,

 *   onUpdated?: () => void | Promise<void>,

 *   breakdownClassName?: string,

 * }} props

 */

export default function JobAcceptedPayoutEditor({ q, onUpdated, breakdownClassName = '' }) {

  const [modalOpen, setModalOpen] = useState(false)

  const payment = resolveJobAcceptedPaymentBreakdown(q)

  const { audit, loading: auditLoading, reload: reloadAudit, fallback: auditFallback } =

    useLatestDriverPayoutAudit(q, payment.manualPayoutOverride)



  async function handleReload() {

    await onUpdated?.()

    await reloadAudit()

  }



  return (

    <>

      <div className="space-y-2">

        {payment.manualPayoutOverride ? (

          <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-900 ring-1 ring-violet-200/90">

            {MANUAL_PAYOUT_CONFIRMED_LABEL}

          </span>

        ) : null}

        <JobAcceptedPaymentBreakdown q={q} compact={false} className={breakdownClassName} />

        {payment.manualPayoutOverride ? (

          <JobAcceptedPayoutAuditBlock

            audit={audit}

            fallback={auditFallback}

            loading={auditLoading}

          />

        ) : null}

        <div className="flex flex-wrap gap-2">

          <button

            type="button"

            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50"

            onClick={() => setModalOpen(true)}

          >

            Edit payout

          </button>

        </div>

      </div>

      <JobDriverPayoutOverrideModal

        open={modalOpen}

        q={q}

        onClose={() => setModalOpen(false)}

        onSaved={handleReload}

      />

    </>

  )

}


