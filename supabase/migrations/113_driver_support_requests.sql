-- Driver → office support requests (Support screen + job Office Help).

CREATE TABLE IF NOT EXISTS public.driver_support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers (id) ON DELETE CASCADE,
  driver_name text,
  driver_phone text,
  driver_email text,
  driver_photo_url text,
  topic text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  urgent boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'in_progress', 'resolved')),
  scope text NOT NULL DEFAULT 'general'
    CHECK (scope IN ('general', 'job')),
  quote_id uuid REFERENCES public.quotes (id) ON DELETE SET NULL,
  quote_ref text,
  assignment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by text,
  admin_notes text
);

COMMENT ON TABLE public.driver_support_requests IS
  'Support messages from the driver app Support / Office Help screens.';

CREATE INDEX IF NOT EXISTS driver_support_requests_created_at_idx
  ON public.driver_support_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS driver_support_requests_status_idx
  ON public.driver_support_requests (status);
CREATE INDEX IF NOT EXISTS driver_support_requests_urgent_idx
  ON public.driver_support_requests (urgent)
  WHERE urgent = true AND status <> 'resolved';
CREATE INDEX IF NOT EXISTS driver_support_requests_driver_id_idx
  ON public.driver_support_requests (driver_id);

ALTER TABLE public.driver_support_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Drivers insert own support requests" ON public.driver_support_requests;
CREATE POLICY "Drivers insert own support requests"
  ON public.driver_support_requests FOR INSERT TO authenticated
  WITH CHECK (driver_id = public.auth_driver_id());

DROP POLICY IF EXISTS "Drivers read own support requests" ON public.driver_support_requests;
CREATE POLICY "Drivers read own support requests"
  ON public.driver_support_requests FOR SELECT TO authenticated
  USING (driver_id = public.auth_driver_id() OR public.auth_is_admin_session());

DROP POLICY IF EXISTS "Admin manage support requests" ON public.driver_support_requests;
CREATE POLICY "Admin manage support requests"
  ON public.driver_support_requests FOR ALL TO authenticated
  USING (public.auth_is_admin_session())
  WITH CHECK (public.auth_is_admin_session());

GRANT SELECT, INSERT, UPDATE ON public.driver_support_requests TO authenticated;
GRANT ALL ON public.driver_support_requests TO service_role;

CREATE OR REPLACE FUNCTION public.touch_driver_support_requests_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS driver_support_requests_set_updated_at ON public.driver_support_requests;
CREATE TRIGGER driver_support_requests_set_updated_at
  BEFORE UPDATE ON public.driver_support_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_driver_support_requests_updated_at();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_support_requests;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
