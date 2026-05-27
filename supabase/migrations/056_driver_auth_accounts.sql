-- Driver mobile login: link auth.users.id → drivers.user_id, vehicle type, active flag, self-read RLS.

alter table public.drivers add column if not exists vehicle_type text;
alter table public.drivers add column if not exists user_id uuid;
alter table public.drivers add column if not exists active boolean not null default true;

create unique index if not exists drivers_user_id_unique_idx
  on public.drivers (user_id)
  where user_id is not null;

create index if not exists drivers_email_lower_idx
  on public.drivers (lower(trim(email)))
  where email is not null and trim(email) <> '';

comment on column public.drivers.user_id is 'Supabase Auth user id — set only via admin account creation.';
comment on column public.drivers.active is 'When false, mobile app blocks login even if Auth credentials are valid.';
comment on column public.drivers.vehicle_type is 'Primary vehicle type for dispatch / mobile profile.';

alter table public.drivers enable row level security;

drop policy if exists "Drivers read own profile" on public.drivers;
create policy "Drivers read own profile"
  on public.drivers
  for select
  to authenticated
  using (user_id is not null and user_id = auth.uid());

-- RLS policies: apply 058_driver_app_rls_production.sql (replaces unsafe authenticated ALL).

drop policy if exists "Authenticated manage drivers admin" on public.drivers;
drop policy if exists "Admin session manage drivers" on public.drivers;
