-- Driver payout settlement tracking (admin internal — not customer/Stripe billing).

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS payout_paid_amount numeric,
  ADD COLUMN IF NOT EXISTS payout_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_payment_method text,
  ADD COLUMN IF NOT EXISTS payout_reference text;

COMMENT ON COLUMN public.quotes.payout_paid_amount IS 'Cumulative amount paid to driver (GBP). Internal accounting only.';
COMMENT ON COLUMN public.quotes.payout_paid_at IS 'When driver payout was last marked paid (admin).';
COMMENT ON COLUMN public.quotes.payout_payment_method IS 'bank_transfer | cash | card | other';
COMMENT ON COLUMN public.quotes.payout_reference IS 'Optional payment reference (e.g. bank ref).';

CREATE INDEX IF NOT EXISTS quotes_payout_paid_at_idx ON public.quotes (payout_paid_at DESC);
