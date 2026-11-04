-- Drivers record arrived_pickup and arrived_delivery. The quote update policy
-- from 062 only allowed a generic "arrived", so the app's quote write was
-- rejected even when the history row was valid. History remains the audit log.
-- A later GPS confirmation uses status "gps" and does not replace that row.

drop policy if exists "Drivers update assigned quote workflow" on public.quotes;
create policy "Drivers update assigned quote workflow"
  on public.quotes
  for update
  to authenticated
  using (
    public.auth_is_driver_session()
    and (
      assigned_driver_id = public.auth_driver_id()
      or public.driver_has_quote_assignment(id)
    )
  )
  with check (
    public.auth_is_driver_session()
    and (
      assigned_driver_id = public.auth_driver_id()
      or public.driver_has_quote_assignment(id)
    )
    and lower(trim(coalesce(status, ''))) in (
      'on_way',
      'in_progress',
      'arrived',
      'arrived_pickup',
      'arrived_delivery',
      'loading',
      'loading_started',
      'unloading',
      'unloading_started',
      'pickup_completed',
      'loaded',
      'in_transit',
      'completed',
      'cancelled',
      ''
    )
  );
