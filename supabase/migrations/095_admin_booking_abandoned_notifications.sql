-- Admin booking + abandoned-lead email notifications (Resend).
-- Idempotent via booking_notification_sent_at / abandoned_notification_sent_at.

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS booking_notification_sent_at timestamptz;

COMMENT ON COLUMN public.quotes.booking_notification_sent_at IS
  'When admin was emailed New Booking Confirmed (once).';

CREATE INDEX IF NOT EXISTS quotes_booking_notification_sent_at_idx
  ON public.quotes (booking_notification_sent_at DESC)
  WHERE booking_notification_sent_at IS NOT NULL;

-- Backfill from legacy Available Jobs admin notify column when present.
UPDATE public.quotes
SET booking_notification_sent_at = admin_notified_at
WHERE booking_notification_sent_at IS NULL
  AND admin_notified_at IS NOT NULL;

ALTER TABLE public.customer_leads
  ADD COLUMN IF NOT EXISTS abandoned_notification_sent_at timestamptz;

COMMENT ON COLUMN public.customer_leads.abandoned_notification_sent_at IS
  'When admin was emailed Abandoned Quote for this lead (once).';

CREATE INDEX IF NOT EXISTS customer_leads_abandoned_notification_due_idx
  ON public.customer_leads (last_activity_at)
  WHERE abandoned_notification_sent_at IS NULL
    AND converted_at IS NULL
    AND status IS DISTINCT FROM 'converted_to_booking';

-- Email history for customer leads (admin + recovery visibility).
CREATE TABLE IF NOT EXISTS public.customer_lead_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_lead_id uuid NOT NULL REFERENCES public.customer_leads(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  event_label text,
  channel text NOT NULL DEFAULT 'email',
  recipient_email text,
  provider_message_id text,
  delivery_status text NOT NULL DEFAULT 'sent',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_lead_notifications_event_unique UNIQUE (customer_lead_id, event_key)
);

CREATE INDEX IF NOT EXISTS customer_lead_notifications_lead_idx
  ON public.customer_lead_notifications (customer_lead_id, sent_at DESC);

ALTER TABLE public.customer_lead_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_lead_notifications_select_authenticated"
  ON public.customer_lead_notifications;
CREATE POLICY "customer_lead_notifications_select_authenticated"
  ON public.customer_lead_notifications
  FOR SELECT TO authenticated
  USING (true);

GRANT SELECT ON TABLE public.customer_lead_notifications TO authenticated;
GRANT ALL ON TABLE public.customer_lead_notifications TO service_role;

-- Candidates for admin abandoned email: started quote, inactive 30+ min, not converted/paid.
CREATE OR REPLACE FUNCTION public.list_admin_abandoned_notification_candidates(
  p_inactive_minutes int DEFAULT 30,
  p_limit int DEFAULT 40
)
RETURNS SETOF public.customer_leads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT cl.*
  FROM public.customer_leads cl
  LEFT JOIN public.quotes q ON q.id = cl.quote_id
  WHERE cl.abandoned_notification_sent_at IS NULL
    AND cl.converted_at IS NULL
    AND cl.status IS DISTINCT FROM 'converted_to_booking'
    AND cl.recovery_stopped_at IS NULL
    AND cl.last_activity_at < now() - make_interval(mins => GREATEST(1, COALESCE(p_inactive_minutes, 30)))
    AND (
      cl.wizard_step >= 2
      OR cl.status IN ('quote_started', 'quote_viewed', 'payment_started', 'abandoned', 'payment_failed')
    )
    AND COALESCE(lower(trim(q.payment_status)), '') NOT IN ('paid', 'deposit_paid')
  ORDER BY cl.last_activity_at ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 40), 100));
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_admin_abandoned_notification_candidates(int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_admin_abandoned_notification_candidates(int, int) TO authenticated;
