import { useEffect, useMemo, useState } from 'react'

import {

  computeJobAcceptedDefaultPayout,

  formatJobAcceptedMoney,

  resolveJobAcceptedPaymentBreakdown,

} from '../../lib/jobAcceptedPaymentDisplay'

import { computePlatformProfitFromPayout } from '../../lib/marketplacePayoutMath'

import { setManualJobAcceptedDriverPayout } from '../../lib/marketplacePayoutApply'



const PAYOUT_REAUDIT_CONFIRM =

  'Changing this payout will create a new audit record. Continue?'



const inputCls =

  'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums text-slate-900'



/**

 * @param {{

 *   open: boolean,

 *   q: Record<string, unknown>,

 *   onClose: () => void,

 *   onSaved?: () => void | Promise<void>,

 * }} props

 */

export default function JobDriverPayoutOverrideModal({ open, q, onClose, onSaved }) {

  const breakdown = useMemo(() => resolveJobAcceptedPaymentBreakdown(q), [q])

  const defaultPayout = useMemo(() => computeJobAcceptedDefaultPayout(q), [q])



  const [amount, setAmount] = useState('')

  const [reason, setReason] = useState('')

  const [busy, setBusy] = useState(false)

  const [err, setErr] = useState('')



  useEffect(() => {

    if (!open) return

    const current = breakdown.driverPayout

    setAmount(current != null && Number.isFinite(current) ? String(current) : '')

    setReason(breakdown.payoutOverrideNote || '')

    setErr('')

  }, [open, breakdown.driverPayout, breakdown.payoutOverrideNote])



  const preview = useMemo(() => {

    const n = parseFloat(String(amount).replace(/,/g, ''))

    const customerTotal = breakdown.customerTotal

    if (!Number.isFinite(n) || n < 0 || customerTotal == null) return null

    return {

      driverPayout: n,

      platformFee: computePlatformProfitFromPayout(customerTotal, n),

    }

  }, [amount, breakdown.customerTotal])



  if (!open) return null



  async function save() {

    const id = String(q.id || '').trim()

    const n = parseFloat(String(amount).replace(/,/g, ''))

    if (!id) return

    if (!Number.isFinite(n) || n < 0) {

      setErr('Enter a valid driver payout amount.')

      return

    }

    if (breakdown.customerTotal != null && n > breakdown.customerTotal) {

      setErr('Driver payout cannot exceed customer total.')

      return

    }

    if (breakdown.manualPayoutOverride) {

      if (!window.confirm(PAYOUT_REAUDIT_CONFIRM)) return

    }

    setBusy(true)

    setErr('')

    try {

      await setManualJobAcceptedDriverPayout(id, q, n, reason)

      await onSaved?.()

      onClose()

    } catch (e) {

      setErr(e?.message || 'Could not save payout.')

    } finally {

      setBusy(false)

    }

  }



  return (

    <div

      className="fixed inset-0 z-[85] flex items-end justify-center bg-slate-900/55 p-4 sm:items-center"

      role="dialog"

      aria-modal="true"

      aria-labelledby="driver-payout-override-title"

      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}

    >

      <div

        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"

        onClick={(e) => e.stopPropagation()}

      >

        <h2 id="driver-payout-override-title" className="text-lg font-bold text-slate-900">

          Edit payout

        </h2>

        <p className="mt-1 text-xs text-slate-600">

          Admin-only. Does not change customer total or Stripe payment.

          {breakdown.manualPayoutOverride

            ? ' Confirmed payouts cannot be reset to default — each save adds an audit entry.'

            : null}

        </p>



        <dl className="mt-4 grid gap-2 rounded-lg border border-slate-100 bg-slate-50/80 p-3 text-sm">

          <div className="flex justify-between gap-3">

            <dt className="text-slate-600">Customer total</dt>

            <dd className="font-semibold tabular-nums text-slate-900">

              {formatJobAcceptedMoney(breakdown.customerTotal)}

            </dd>

          </div>

          <div className="flex justify-between gap-3">

            <dt className="text-slate-600">Default payout</dt>

            <dd className="font-semibold tabular-nums text-violet-900">

              {formatJobAcceptedMoney(defaultPayout?.driverPayout)}

            </dd>

          </div>

          {defaultPayout?.deductionLabel ? (

            <div className="text-xs text-slate-500">Deduction rule: {defaultPayout.deductionLabel}</div>

          ) : null}

        </dl>



        <label className="mt-4 block text-sm font-medium text-slate-800">

          Driver payout amount (£)

          <input

            type="text"

            inputMode="decimal"

            className={inputCls}

            value={amount}

            onChange={(e) => setAmount(e.target.value)}

            placeholder={defaultPayout?.driverPayout != null ? String(defaultPayout.driverPayout) : '0.00'}

          />

        </label>



        <label className="mt-3 block text-sm font-medium text-slate-800">

          Reason / note <span className="font-normal text-slate-500">(optional)</span>

          <textarea

            rows={2}

            className={`${inputCls} resize-y`}

            value={reason}

            onChange={(e) => setReason(e.target.value)}

            placeholder="e.g. Extra distance, difficult access…"

          />

        </label>



        {preview ? (

          <dl className="mt-3 grid gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 text-sm">

            <div className="flex justify-between gap-3">

              <dt className="text-slate-600">Manual payout</dt>

              <dd className="font-semibold tabular-nums text-violet-900">

                {formatJobAcceptedMoney(preview.driverPayout)}

              </dd>

            </div>

            <div className="flex justify-between gap-3">

              <dt className="text-slate-600">Platform fee after override</dt>

              <dd className="font-semibold tabular-nums text-emerald-800">

                {formatJobAcceptedMoney(preview.platformFee)}

              </dd>

            </div>

          </dl>

        ) : null}



        {err ? <p className="mt-3 text-sm text-red-700">{err}</p> : null}



        <div className="mt-5 flex flex-wrap gap-2">

          <button

            type="button"

            disabled={busy}

            onClick={() => void save()}

            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-45"

          >

            {busy ? 'Saving…' : 'Save payout'}

          </button>

          <button

            type="button"

            disabled={busy}

            onClick={onClose}

            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"

          >

            Cancel

          </button>

        </div>

      </div>

    </div>

  )

}


