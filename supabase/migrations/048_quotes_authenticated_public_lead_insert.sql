-- Allow logged-in users (e.g. admin testing the homepage form) to submit public leads too.
-- Primary path uses anon via supabasePublicClient; this avoids RLS failures when a session exists.

DROP POLICY IF EXISTS "Authenticated insert public quote leads" ON public.quotes;

CREATE POLICY "Authenticated insert public quote leads"
  ON public.quotes
  FOR INSERT
  TO authenticated
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
