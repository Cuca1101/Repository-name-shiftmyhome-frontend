-- Extra charge requests: driver app submits add-item charge requests;
-- admin reviews, approves, and creates Stripe payment links for customers.

CREATE TABLE IF NOT EXISTS public.extra_charge_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  quote_id uuid,
  customer_id uuid,
  driver_id uuid,
  added_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  added_volume_m3 numeric NOT NULL DEFAULT 0,
  estimated_amount numeric NOT NULL DEFAULT 0 CHECK (estimated_amount >= 0),
  approved_amount numeric CHECK (approved_amount IS NULL OR approved_amount >= 0),
  currency text NOT NULL DEFAULT 'GBP',
  status text NOT NULL DEFAULT 'pending_review',
  stripe_payment_intent_id text,
  stripe_payment_link text,
  notes text,
  customer_email text,
  customer_name text,
  booking_reference text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.extra_charge_requests IS 'Driver app extra item charge requests — admin approves and creates Stripe payment for customer.';
COMMENT ON COLUMN public.extra_charge_requests.status IS 'pending_review | pending_customer_payment | paid | declined | cancelled';
COMMENT ON COLUMN public.extra_charge_requests.added_items IS 'JSON array of {name, quantity, volume_m3, notes} objects from driver app.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'extra_charge_requests_job_id_fkey'
  ) THEN
    ALTER TABLE public.extra_charge_requests
      ADD CONSTRAINT extra_charge_requests_job_id_fkey
      FOREIGN KEY (job_id) REFERENCES public.jobs (id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'extra_charge_requests_quote_id_fkey'
  ) THEN
    ALTER TABLE public.extra_charge_requests
      ADD CONSTRAINT extra_charge_requests_quote_id_fkey
      FOREIGN KEY (quote_id) REFERENCES public.quotes (id) ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'extra_charge_requests_driver_id_fkey'
  ) THEN
    ALTER TABLE public.extra_charge_requests
      ADD CONSTRAINT extra_charge_requests_driver_id_fkey
      FOREIGN KEY (driver_id) REFERENCES public.drivers (id) ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS extra_charge_requests_job_id_idx ON public.extra_charge_requests (job_id);
CREATE INDEX IF NOT EXISTS extra_charge_requests_quote_id_idx ON public.extra_charge_requests (quote_id);
CREATE INDEX IF NOT EXISTS extra_charge_requests_driver_id_idx ON public.extra_charge_requests (driver_id);
CREATE INDEX IF NOT EXISTS extra_charge_requests_status_idx ON public.extra_charge_requests (status);
CREATE INDEX IF NOT EXISTS extra_charge_requests_created_at_idx ON public.extra_charge_requests (created_at DESC);

ALTER TABLE public.extra_charge_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read extra charge requests" ON public.extra_charge_requests;
CREATE POLICY "Authenticated read extra charge requests"
  ON public.extra_charge_requests FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated insert extra charge requests" ON public.extra_charge_requests;
CREATE POLICY "Authenticated insert extra charge requests"
  ON public.extra_charge_requests FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated update extra charge requests" ON public.extra_charge_requests;
CREATE POLICY "Authenticated update extra charge requests"
  ON public.extra_charge_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Allow anon inserts from driver app (authenticated via API key)
DROP POLICY IF EXISTS "Anon insert extra charge requests" ON public.extra_charge_requests;
CREATE POLICY "Anon insert extra charge requests"
  ON public.extra_charge_requests FOR INSERT TO anon WITH CHECK (true);

-- Allow anon reads so driver app can poll status
DROP POLICY IF EXISTS "Anon read extra charge requests" ON public.extra_charge_requests;
CREATE POLICY "Anon read extra charge requests"
  ON public.extra_charge_requests FOR SELECT TO anon USING (true);
