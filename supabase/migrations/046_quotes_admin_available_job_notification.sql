-- Admin email when a quote first appears in Available Jobs (paid/deposit, unassigned).
-- Idempotent: admin_notified_at set only after a successful Resend send.

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS admin_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_notification_intent_id text;

COMMENT ON COLUMN public.quotes.admin_notified_at IS
  'When admin was emailed about this quote in Available Jobs inbox.';
COMMENT ON COLUMN public.quotes.admin_notification_intent_id IS
  'Stripe PaymentIntent id used for idempotent admin available-job notification.';

CREATE INDEX IF NOT EXISTS quotes_admin_notified_at_idx
  ON public.quotes (admin_notified_at)
  WHERE admin_notified_at IS NULL;
