-- Denormalised booking snapshot on tip rows for Admin Tips list (existing job_tips table).
ALTER TABLE public.job_tips
  ADD COLUMN IF NOT EXISTS quote_ref text,
  ADD COLUMN IF NOT EXISTS customer_name text;

COMMENT ON COLUMN public.job_tips.quote_ref IS 'Booking reference snapshot at tip checkout (quotes.quote_ref).';
COMMENT ON COLUMN public.job_tips.customer_name IS 'Customer name snapshot at tip checkout (quotes.full_name).';

CREATE INDEX IF NOT EXISTS job_tips_paid_at_idx
  ON public.job_tips (paid_at DESC NULLS LAST)
  WHERE status = 'paid';
