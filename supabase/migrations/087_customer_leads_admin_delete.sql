-- Allow authenticated admin users to delete customer lead rows (cleanup abandoned / converted).

DROP POLICY IF EXISTS "customer_leads_delete_authenticated" ON public.customer_leads;
CREATE POLICY "customer_leads_delete_authenticated"
  ON public.customer_leads
  FOR DELETE
  TO authenticated
  USING (true);

GRANT DELETE ON TABLE public.customer_leads TO authenticated;
