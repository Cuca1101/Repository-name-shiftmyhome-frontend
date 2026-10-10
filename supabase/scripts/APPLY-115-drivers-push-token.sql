-- Apply in Supabase SQL Editor (production) if migration 115 is not yet deployed.
-- Enables drivers.push_token for FCM background job alerts.

alter table public.drivers
  add column if not exists push_token text;

comment on column public.drivers.push_token is
  'FCM device token for driver push notifications (background new-job alerts).';

drop policy if exists drivers_update_own_push_token on public.drivers;
create policy drivers_update_own_push_token
  on public.drivers
  for update
  to authenticated
  using (user_id is not null and user_id = auth.uid())
  with check (user_id is not null and user_id = auth.uid());
