-- Internal payout / profit accounting on quotes (admin only — does not affect Stripe or customer totals).

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS driver_payout_amount numeric,
  ADD COLUMN IF NOT EXISTS partner_payout_amount numeric,
  ADD COLUMN IF NOT EXISTS payout_status text,
  ADD COLUMN IF NOT EXISTS payout_notes text,
  ADD COLUMN IF NOT EXISTS payout_updated_at timestamptz;

COMMENT ON COLUMN public.quotes.driver_payout_amount IS 'Admin-recorded driver payout (GBP). Internal accounting only.';
COMMENT ON COLUMN public.quotes.partner_payout_amount IS 'Admin-recorded partner payout (GBP). Internal accounting only.';
COMMENT ON COLUMN public.quotes.payout_status IS 'not_set | pending | paid | partially_paid | held | disputed';
COMMENT ON COLUMN public.quotes.payout_notes IS 'Internal payout notes for finance/admin.';
COMMENT ON COLUMN public.quotes.payout_updated_at IS 'When payout fields were last updated by admin.';

CREATE INDEX IF NOT EXISTS quotes_payout_status_idx ON public.quotes (payout_status);
CREATE INDEX IF NOT EXISTS quotes_payout_updated_idx ON public.quotes (payout_updated_at DESC);
