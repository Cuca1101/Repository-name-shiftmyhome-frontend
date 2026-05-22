-- Authenticated admin may DELETE public quote-request leads only (unpaid, no Stripe).

DROP POLICY IF EXISTS "Authenticated delete public quote leads" ON public.quotes;

CREATE POLICY "Authenticated delete public quote leads"
  ON public.quotes
  FOR DELETE
  TO authenticated
  USING (
    source IN (
      'home_page_quote_form',
      'website',
      'public_quote_request',
      'quote_request'
    )
    AND coalesce(payment_status::text, 'unpaid') = 'unpaid'
    AND stripe_session_id IS NULL
    AND stripe_payment_intent_id IS NULL
    AND paid_at IS NULL
    AND amount_paid IS NULL
  );
