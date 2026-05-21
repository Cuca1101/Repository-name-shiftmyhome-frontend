import { isSupabaseConfigured, supabase } from '../supabase'

const QUOTES_TABLE = 'quotes'

const ANALYTICS_SELECT =
  'id, quote_ref, full_name, move_date, service, service_type, details, payment_status, payment_type, amount_paid, paid_at, created_at, updated_at, estimated_total, remaining_balance, status, operational_status, completed_at, cancelled_at, assigned_driver_id, assigned_driver_name, assigned_partner_company, assigned_at, marketplace_visibility, marketplace_payout_price, platform_profit_amount, platform_margin_percent, driver_payout_amount, partner_payout_amount, driver_payout_manual_override, partner_payout_manual_override, payout_status, payout_notes, payout_paid_amount, payout_paid_at, payout_payment_method, payout_reference, payout_updated_at, pickup_address, delivery_address, pricing'

/**
 * Lightweight quotes load for admin analytics (paid + deposit rows, last 18 months).
 * @returns {Promise<Record<string, unknown>[]>}
 */
export async function fetchQuotesForAdminAnalytics() {
  if (!isSupabaseConfigured || !supabase) return []

  const since = new Date()
  since.setMonth(since.getMonth() - 18)

  const { data, error } = await supabase
    .from(QUOTES_TABLE)
    .select(ANALYTICS_SELECT)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(2500)

  if (error) throw new Error(error.message || 'Failed to load analytics data.')
  return data ?? []
}
