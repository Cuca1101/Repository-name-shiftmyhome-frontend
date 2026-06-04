-- Admin may delete staged phone bookings (unpaid, no Stripe) while still on New phone booking.

DROP POLICY IF EXISTS "Authenticated delete pending phone bookings" ON public.quotes;

CREATE POLICY "Authenticated delete pending phone bookings"
  ON public.quotes
  FOR DELETE
  TO authenticated
  USING (
    public.auth_is_admin_session()
    AND source IN ('phone_booking', 'admin_phone_booking')
    AND operational_status = 'phone_booking_pending'
    AND coalesce(payment_status::text, 'unpaid') = 'unpaid'
    AND stripe_session_id IS NULL
    AND stripe_payment_intent_id IS NULL
    AND paid_at IS NULL
  );
