-- Public homepage quote request form: source column + safe anon INSERT (no read/update/delete).
-- Apply in Supabase SQL Editor if production shows RLS errors on ContactSection submit.
-- Frontend: quotesRepository.insertHomePageQuoteLead (source = home_page_quote_form).

-- 1) Column used by admin Quote Requests (legacy: 005_quotes_source_column.sql)
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS source text;

COMMENT ON COLUMN public.quotes.source IS
  'Lead origin: home_page_quote_form (homepage contact), wizard, etc.';

CREATE INDEX IF NOT EXISTS quotes_source_idx ON public.quotes (source);

-- 2) RLS: anon may INSERT public leads only (no SELECT — frontend insert does not use RETURNING)
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can create quote requests" ON public.quotes;
DROP POLICY IF EXISTS "Public can create home page quote requests" ON public.quotes;
DROP POLICY IF EXISTS "Anon insert public quote leads" ON public.quotes;

CREATE POLICY "Anon insert public quote leads"
  ON public.quotes
  FOR INSERT
  TO anon
  WITH CHECK (
    source IN (
      'home_page_quote_form',
      'website',
      'public_quote_request',
      'quote_request'
    )
    AND trim(coalesce(status, '')) IN ('New', 'new')
    AND length(trim(coalesce(full_name, ''))) > 0
    AND length(trim(coalesce(email, ''))) > 0
    AND length(trim(coalesce(phone, ''))) > 0
    AND length(trim(coalesce(pickup_address, ''))) > 0
    AND length(trim(coalesce(delivery_address, ''))) > 0
    AND length(trim(coalesce(quote_ref, ''))) > 0
    AND stripe_session_id IS NULL
    AND stripe_payment_intent_id IS NULL
    AND paid_at IS NULL
    AND amount_paid IS NULL
    AND assigned_driver_id IS NULL
    AND assigned_partner_id IS NULL
    AND bundled_journey_id IS NULL
  );

GRANT INSERT ON public.quotes TO anon;
