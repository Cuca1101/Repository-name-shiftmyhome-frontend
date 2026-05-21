-- Platform margin % and profit column (internal admin accounting only).

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS platform_profit_amount numeric,
  ADD COLUMN IF NOT EXISTS platform_margin_percent numeric,
  ADD COLUMN IF NOT EXISTS driver_payout_manual_override boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS partner_payout_manual_override boolean DEFAULT false;

COMMENT ON COLUMN public.quotes.platform_profit_amount IS 'Admin-recorded platform profit (GBP). Internal only.';
COMMENT ON COLUMN public.quotes.platform_margin_percent IS 'Target platform margin % of customer total for auto payout split.';
COMMENT ON COLUMN public.quotes.driver_payout_manual_override IS 'True when driver payout was edited manually vs margin auto-calc.';
COMMENT ON COLUMN public.quotes.partner_payout_manual_override IS 'True when partner payout was edited manually vs margin auto-calc.';
