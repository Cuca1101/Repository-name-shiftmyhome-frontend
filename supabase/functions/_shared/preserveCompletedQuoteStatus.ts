import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

type QuoteCompletionRow = {
  status?: unknown
  operational_status?: unknown
  completed_at?: unknown
}

/** True when the quote is already finished and must not be moved back to Booked. */
export function quoteLooksCompleted(row: QuoteCompletionRow | null | undefined): boolean {
  if (!row) return false
  const status = String(row.status ?? '').trim().toLowerCase()
  const operational = String(row.operational_status ?? '').trim().toLowerCase()
  if (status === 'completed' || operational === 'completed') return true
  return row.completed_at != null && String(row.completed_at).trim() !== ''
}

/**
 * Stripe retries payment events for days. Those updates set quotes.status back
 * to Booked. Drop that field when the booking is already completed so a late
 * webhook cannot put the job back into Accepted Jobs.
 */
export async function omitStatusIfQuoteCompleted(
  supabase: SupabaseClient,
  ids: { quoteId?: string | null; quoteRef?: string | null },
  patch: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!Object.prototype.hasOwnProperty.call(patch, 'status')) return patch

  const quoteId = String(ids.quoteId || '').trim()
  const quoteRef = String(ids.quoteRef || '').trim()
  if (!quoteId && !quoteRef) return patch

  try {
    let query = supabase
      .from('quotes')
      .select('status, operational_status, completed_at')
    query = quoteId ? query.eq('id', quoteId) : query.eq('quote_ref', quoteRef)
    const { data, error } = await query.maybeSingle()
    if (error || !quoteLooksCompleted(data)) return patch
    const next = { ...patch }
    delete next.status
    return next
  } catch {
    return patch
  }
}
