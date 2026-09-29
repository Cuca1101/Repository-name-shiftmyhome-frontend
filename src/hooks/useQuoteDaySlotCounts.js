import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { normalizeDailyJobSlots } from '../lib/calendarDayPricing'

/**
 * Paid / deposit bookings per move date. Used so the quote calendar can hide full days.
 * Returns {} when slots are not configured or the count function is unavailable.
 *
 * @param {string} fromIso
 * @param {string} toIso
 * @param {Record<string, unknown> | null | undefined} pricingSettings
 * @returns {{ counts: Record<string, number>, loaded: boolean }}
 */
export function useQuoteDaySlotCounts(fromIso, toIso, pricingSettings) {
  const [counts, setCounts] = useState(/** @type {Record<string, number>} */ ({}))
  const [loaded, setLoaded] = useState(false)
  const slotsConfigured = Object.keys(normalizeDailyJobSlots(pricingSettings?.dailyJobSlots)).length > 0

  useEffect(() => {
    if (!slotsConfigured || !supabase || !fromIso || !toIso) {
      setCounts({})
      setLoaded(false)
      return undefined
    }

    let cancelled = false
    setLoaded(false)
    supabase
      .rpc('public_quote_day_slot_counts', { p_from: fromIso, p_to: toIso })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setLoaded(false)
          return
        }
        /** @type {Record<string, number>} */
        const next = {}
        for (const row of data || []) {
          const iso = String(row.move_date || '').slice(0, 10)
          if (!iso) continue
          next[iso] = Math.max(0, Number(row.booked) || 0)
        }
        setCounts(next)
        setLoaded(true)
      })

    return () => {
      cancelled = true
    }
  }, [fromIso, toIso, slotsConfigured])

  return { counts, loaded }
}
