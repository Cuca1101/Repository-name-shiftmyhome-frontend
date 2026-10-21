-- Record what happened to an admin locate request:
-- the push result, when the phone confirmed it, and the GPS sample that followed.

alter table public.driver_locate_sessions
  add column if not exists push_status text,
  add column if not exists push_error text,
  add column if not exists device_received_at timestamptz,
  add column if not exists location_sampled_at timestamptz;

comment on column public.driver_locate_sessions.push_status is
  'sent, rejected, or not_sent. Independent of whether the phone later returned GPS.';
comment on column public.driver_locate_sessions.device_received_at is
  'When the driver app confirmed it saw this request.';
comment on column public.driver_locate_sessions.location_sampled_at is
  'Capture time of the GPS fix uploaded for this request.';

drop policy if exists driver_ack_own_locate_sessions on public.driver_locate_sessions;
create policy driver_ack_own_locate_sessions
  on public.driver_locate_sessions
  for update
  to authenticated
  using (driver_id = public.auth_driver_id())
  with check (driver_id = public.auth_driver_id());

grant update (
  status,
  device_received_at,
  location_sampled_at
) on table public.driver_locate_sessions to authenticated;
