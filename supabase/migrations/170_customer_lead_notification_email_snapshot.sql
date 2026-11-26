-- Allow one Email History row per send (not one per event kind), so View can show the
-- exact HTML that was emailed instead of rebuilding from the live lead.
ALTER TABLE public.customer_lead_notifications
  DROP CONSTRAINT IF EXISTS customer_lead_notifications_event_unique;

CREATE INDEX IF NOT EXISTS customer_lead_notifications_lead_event_idx
  ON public.customer_lead_notifications (customer_lead_id, event_key, sent_at DESC);

COMMENT ON COLUMN public.customer_lead_notifications.payload IS
  'Send snapshot. Recovery emails store subject + html of the message that was sent.';
