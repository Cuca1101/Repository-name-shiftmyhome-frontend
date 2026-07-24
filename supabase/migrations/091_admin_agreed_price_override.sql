-- Admin manual price override for customer leads + quotes (per-booking only).
-- Does not change global pricing_settings / Pricing Engine.

ALTER TABLE public.customer_leads
  ADD COLUMN IF NOT EXISTS calculated_total numeric,
  ADD COLUMN IF NOT EXISTS agreed_price numeric,
  ADD COLUMN IF NOT EXISTS price_override_reason text,
  ADD COLUMN IF NOT EXISTS price_override_by text,
  ADD COLUMN IF NOT EXISTS price_override_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_link_url text,
  ADD COLUMN IF NOT EXISTS stripe_payment_link_amount numeric;

COMMENT ON COLUMN public.customer_leads.calculated_total IS
  'Original Pricing Engine total preserved for audit when admin sets agreed_price.';
COMMENT ON COLUMN public.customer_leads.agreed_price IS
  'Admin-agreed final charge; overrides calculated_total for Stripe/checkout only for this lead.';

-- Preserve existing engine quotes as calculated totals.
UPDATE public.customer_leads
SET calculated_total = estimated_total
WHERE calculated_total IS NULL
  AND estimated_total IS NOT NULL;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS calculated_total numeric,
  ADD COLUMN IF NOT EXISTS agreed_price numeric,
  ADD COLUMN IF NOT EXISTS price_override_reason text,
  ADD COLUMN IF NOT EXISTS price_override_by text,
  ADD COLUMN IF NOT EXISTS price_override_at timestamptz;

COMMENT ON COLUMN public.quotes.agreed_price IS
  'Admin-agreed final charge for this booking; Stripe and invoices should use this when set.';

UPDATE public.quotes
SET calculated_total = estimated_total
WHERE calculated_total IS NULL
  AND estimated_total IS NOT NULL;

-- When phone booking already stored final in remaining_balance with a different estimated_total.
UPDATE public.quotes
SET agreed_price = remaining_balance,
    price_override_reason = COALESCE(price_override_reason, 'Migrated from remaining_balance override')
WHERE agreed_price IS NULL
  AND remaining_balance IS NOT NULL
  AND estimated_total IS NOT NULL
  AND abs(remaining_balance - estimated_total) > 0.009;
