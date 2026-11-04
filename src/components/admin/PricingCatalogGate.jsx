import { useState } from 'react'
import { Lock } from 'lucide-react'
import { unlockFinancePin } from '../../lib/financeProfitApi'
import { isFinancePinComplete, normalizeFinancePin } from '../../lib/financeProfit'
import { lockFinanceAccess } from '../../lib/financeSession'
import { isPricingCatalogOpen, unlockPricingCatalog } from '../../lib/pricingCatalogAccess'

const fieldClass =
  'mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-base text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 sm:text-sm'

/**
 * Pricing engine and Items library stay behind the same PIN as Finance.
 * A correct PIN is checked on the server, then Finance is locked again.
 */
export default function PricingCatalogGate({ children }) {
  const [open, setOpen] = useState(() => isPricingCatalogOpen())
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  async function onUnlock(event) {
    event.preventDefault()
    if (checking) return
    if (!isFinancePinComplete(pin)) {
      setError('Enter the 8-digit PIN.')
      return
    }
    setChecking(true)
    setError('')
    try {
      await unlockFinancePin(pin)
      await lockFinanceAccess()
      unlockPricingCatalog()
      setPin('')
      setOpen(true)
    } catch (unlockError) {
      const message = String(unlockError?.message || '')
      setError(/incorrect pin/i.test(message) ? 'Incorrect PIN.' : message || 'Incorrect PIN.')
    } finally {
      setChecking(false)
    }
  }

  if (open) return children

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <Lock className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Pricing & catalog is locked</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Enter the PIN to open the pricing engine or the items library. Finance stays locked.
          </p>
        </div>
      </div>
      <form onSubmit={onUnlock} className="mt-5 space-y-3">
        <label className="block text-sm font-medium text-slate-700" htmlFor="pricing-catalog-pin">
          PIN
          <input
            id="pricing-catalog-pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={8}
            value={pin}
            onChange={(event) => {
              setPin(normalizeFinancePin(event.target.value))
              setError('')
            }}
            className={fieldClass}
          />
        </label>
        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={checking}
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {checking ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </div>
  )
}
