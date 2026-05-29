-- Driver app: read Items Library for Add Item picker (names + m³).

ALTER TABLE public.items_library ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Drivers read items library" ON public.items_library;
CREATE POLICY "Drivers read items library"
  ON public.items_library
  FOR SELECT
  TO authenticated
  USING (public.auth_is_driver_session() OR public.auth_is_admin_session());

GRANT SELECT ON TABLE public.items_library TO authenticated;
