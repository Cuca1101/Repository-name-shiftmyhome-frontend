-- Admin audit trail for journey driver payout splits and job changes.

CREATE TABLE IF NOT EXISTS public.journey_payout_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid,
  journey_ref text NOT NULL DEFAULT '',
  action text NOT NULL,
  old_journey_payout_gbp numeric,
  new_journey_payout_gbp numeric,
  old_per_job_payouts jsonb,
  new_per_job_payouts jsonb,
  job_change text NOT NULL DEFAULT '',
  reason text NOT NULL DEFAULT '',
  admin_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.journey_payout_audit_log IS 'Admin log of journey total driver payout and per-job split changes.';
COMMENT ON COLUMN public.journey_payout_audit_log.old_per_job_payouts IS 'Map quote_id -> payout GBP before change.';
COMMENT ON COLUMN public.journey_payout_audit_log.new_per_job_payouts IS 'Map quote_id -> payout GBP after change.';

CREATE INDEX IF NOT EXISTS journey_payout_audit_log_journey_id_idx ON public.journey_payout_audit_log (journey_id);
CREATE INDEX IF NOT EXISTS journey_payout_audit_log_created_at_idx ON public.journey_payout_audit_log (created_at DESC);

ALTER TABLE public.journey_payout_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read journey payout audit" ON public.journey_payout_audit_log;
CREATE POLICY "Authenticated read journey payout audit"
  ON public.journey_payout_audit_log FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated insert journey payout audit" ON public.journey_payout_audit_log;
CREATE POLICY "Authenticated insert journey payout audit"
  ON public.journey_payout_audit_log FOR INSERT TO authenticated WITH CHECK (true);
