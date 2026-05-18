-- Recovery, feedback, and analytics fields for website_leads / quote funnel.
-- Apply after website_leads table and upsert_website_lead RPC exist in your project.

ALTER TABLE public.website_leads
  ADD COLUMN IF NOT EXISTS pickup_address text,
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS funnel_event text,
  ADD COLUMN IF NOT EXISTS lead_timeline jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS abandoned_at timestamptz,
  ADD COLUMN IF NOT EXISTS recovery_email_sent boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recovery_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS recovery_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS recovery_email_opened boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recovery_email_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS recovery_email_clicked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recovery_email_clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS recovered_booking boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recovered_booking_at timestamptz,
  ADD COLUMN IF NOT EXISTS feedback_reason text,
  ADD COLUMN IF NOT EXISTS feedback_notes text,
  ADD COLUMN IF NOT EXISTS feedback_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS website_leads_quote_ref_idx ON public.website_leads (quote_ref);
CREATE INDEX IF NOT EXISTS website_leads_last_activity_idx ON public.website_leads (last_activity_at DESC);
