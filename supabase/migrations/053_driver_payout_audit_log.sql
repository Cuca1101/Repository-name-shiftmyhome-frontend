-- Admin-only audit trail for manual driver payout overrides (evidence; not customer billing).

CREATE TABLE IF NOT EXISTS public.driver_payout_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid,
  quote_ref text NOT NULL DEFAULT '',
  driver_id uuid,
  driver_name text NOT NULL DEFAULT '',
  action text NOT NULL,
  default_payout_gbp numeric,
  new_payout_gbp numeric,
  difference_gbp numeric,
  reason text NOT NULL DEFAULT '',
  admin_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.driver_payout_audit_log IS 'Immutable-style admin log of driver payout manual overrides and resets.';
COMMENT ON COLUMN public.driver_payout_audit_log.action IS 'manual_override | reset_to_default';

CREATE INDEX IF NOT EXISTS driver_payout_audit_log_quote_id_idx ON public.driver_payout_audit_log (quote_id);
CREATE INDEX IF NOT EXISTS driver_payout_audit_log_driver_id_idx ON public.driver_payout_audit_log (driver_id);
CREATE INDEX IF NOT EXISTS driver_payout_audit_log_created_at_idx ON public.driver_payout_audit_log (created_at DESC);

ALTER TABLE public.driver_payout_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read driver payout audit" ON public.driver_payout_audit_log;
CREATE POLICY "Authenticated read driver payout audit"
  ON public.driver_payout_audit_log FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated insert driver payout audit" ON public.driver_payout_audit_log;
CREATE POLICY "Authenticated insert driver payout audit"
  ON public.driver_payout_audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- Data API grants: admin audit — authenticated only; no anon.
GRANT SELECT, INSERT ON TABLE public.driver_payout_audit_log TO authenticated;
