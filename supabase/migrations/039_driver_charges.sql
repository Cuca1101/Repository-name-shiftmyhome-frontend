-- Internal driver payout deductions (admin accounting only — not customer billing).

CREATE TABLE IF NOT EXISTS public.driver_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL,
  quote_id uuid,
  job_id uuid,
  charge_type text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  reason text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  evidence_url text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  resolved_at timestamptz
);

COMMENT ON TABLE public.driver_charges IS 'Admin-only deductions from driver payout; does not affect customer payments.';
COMMENT ON COLUMN public.driver_charges.charge_type IS 'deallocation | cancellation | damage | no_show | late_arrival | customer_complaint | admin_adjustment | other';
COMMENT ON COLUMN public.driver_charges.status IS 'pending | applied | disputed | waived | cancelled';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'driver_charges_driver_id_fkey'
  ) THEN
    ALTER TABLE public.driver_charges
      ADD CONSTRAINT driver_charges_driver_id_fkey
      FOREIGN KEY (driver_id) REFERENCES public.drivers (id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'driver_charges_quote_id_fkey'
  ) THEN
    ALTER TABLE public.driver_charges
      ADD CONSTRAINT driver_charges_quote_id_fkey
      FOREIGN KEY (quote_id) REFERENCES public.quotes (id) ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS driver_charges_driver_id_idx ON public.driver_charges (driver_id);
CREATE INDEX IF NOT EXISTS driver_charges_quote_id_idx ON public.driver_charges (quote_id);
CREATE INDEX IF NOT EXISTS driver_charges_status_idx ON public.driver_charges (status);
CREATE INDEX IF NOT EXISTS driver_charges_created_at_idx ON public.driver_charges (created_at DESC);

ALTER TABLE public.driver_charges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read driver charges" ON public.driver_charges;
CREATE POLICY "Authenticated read driver charges"
  ON public.driver_charges FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated insert driver charges" ON public.driver_charges;
CREATE POLICY "Authenticated insert driver charges"
  ON public.driver_charges FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated update driver charges" ON public.driver_charges;
CREATE POLICY "Authenticated update driver charges"
  ON public.driver_charges FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Data API grants: payment ledger — authenticated only; no anon.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.driver_charges TO authenticated;
