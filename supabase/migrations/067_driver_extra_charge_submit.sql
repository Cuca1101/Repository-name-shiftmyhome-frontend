-- Driver app: submit/read extra_charge_requests for assigned bookings (quote_id primary).

begin;

ALTER TABLE public.extra_charge_requests
  ALTER COLUMN job_id DROP NOT NULL;

DROP POLICY IF EXISTS "Drivers insert assigned extra charges" ON public.extra_charge_requests;
CREATE POLICY "Drivers insert assigned extra charges"
  ON public.extra_charge_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.auth_is_driver_session()
    AND driver_id = public.auth_driver_id()
    AND quote_id IS NOT NULL
    AND public.driver_has_quote_assignment(quote_id)
  );

DROP POLICY IF EXISTS "Drivers read assigned extra charges" ON public.extra_charge_requests;
CREATE POLICY "Drivers read assigned extra charges"
  ON public.extra_charge_requests
  FOR SELECT
  TO authenticated
  USING (
    public.auth_is_admin_session()
    OR (
      public.auth_is_driver_session()
      AND quote_id IS NOT NULL
      AND public.driver_has_quote_assignment(quote_id)
    )
  );

DROP POLICY IF EXISTS "Drivers update own extra charge refusal" ON public.extra_charge_requests;
CREATE POLICY "Drivers update own extra charge refusal"
  ON public.extra_charge_requests
  FOR UPDATE
  TO authenticated
  USING (
    public.auth_is_driver_session()
    AND driver_id = public.auth_driver_id()
    AND quote_id IS NOT NULL
    AND public.driver_has_quote_assignment(quote_id)
  )
  WITH CHECK (
    public.auth_is_driver_session()
    AND driver_id = public.auth_driver_id()
  );

comment on table public.extra_charge_requests is
  'Driver extra-item charges. job_id optional (legacy jobs table); quote_id required for driver app.';

commit;
