import { useCallback, useEffect, useState } from 'react'
import { fetchLatestDriverPayoutAuditForQuote } from './data/driverPayoutAuditRepository'
import { resolveJobAcceptedPaymentBreakdown } from './jobAcceptedPaymentDisplay'

/**
 * @param {Record<string, unknown> | null | undefined} q
 * @param {boolean} enabled
 */
export function useLatestDriverPayoutAudit(q, enabled) {
  const [audit, setAudit] = useState(/** @type {import('./data/driverPayoutAuditRepository.js').mapAuditRow | null} */ (null))
  const [loading, setLoading] = useState(false)
  const quoteId = String(q?.id || '').trim()

  const reload = useCallback(async () => {
    if (!enabled || !quoteId) {
      setAudit(null)
      return
    }
    setLoading(true)
    try {
      setAudit(await fetchLatestDriverPayoutAuditForQuote(quoteId))
    } catch {
      setAudit(null)
    } finally {
      setLoading(false)
    }
  }, [enabled, quoteId])

  useEffect(() => {
    void reload()
  }, [reload])

  const payment = q ? resolveJobAcceptedPaymentBreakdown(q) : null
  const fallback =
    enabled && payment?.manualPayoutOverride
      ? {
          defaultPayoutGbp: payment.defaultDriverPayout,
          newPayoutGbp: payment.driverPayout,
          reason: payment.payoutOverrideNote || String(q?.payout_notes || ''),
        }
      : null

  return { audit, loading, reload, fallback }
}
