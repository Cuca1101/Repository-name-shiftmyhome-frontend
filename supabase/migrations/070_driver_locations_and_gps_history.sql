-- Live driver GPS (admin Operations Map) + per-job location history (trail, stops, deviation).

begin;

-- ── driver_locations (one row per driver, upsert from mobile) ─────────────

create table if not exists public.driver_locations (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers (id) on delete cascade,
  assignment_id uuid references public.job_assignments (id) on delete set null,
  quote_id uuid references public.quotes (id) on delete set null,
  latitude numeric not null,
  longitude numeric not null,
  heading numeric,
  speed numeric,
  accuracy numeric,
  battery_level numeric,
  status text,
  updated_at timestamptz not null default now(),
  constraint driver_locations_driver_id_key unique (driver_id)
);

create index if not exists driver_locations_updated_at_idx
  on public.driver_locations (updated_at desc);

create index if not exists driver_locations_quote_id_idx
  on public.driver_locations (quote_id)
  where quote_id is not null;

-- ── driver_location_history (GPS trail per job) ───────────────────────────

create table if not exists public.driver_location_history (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers (id) on delete cascade,
  quote_id uuid references public.quotes (id) on delete set null,
  assignment_id uuid references public.job_assignments (id) on delete set null,
  latitude numeric not null,
  longitude numeric not null,
  heading numeric,
  speed numeric,
  accuracy numeric,
  status text,
  recorded_at timestamptz not null default now()
);

create index if not exists driver_location_history_quote_recorded_idx
  on public.driver_location_history (quote_id, recorded_at asc)
  where quote_id is not null;

create index if not exists driver_location_history_driver_recorded_idx
  on public.driver_location_history (driver_id, recorded_at desc);

comment on table public.driver_location_history is
  'GPS breadcrumbs while on job — admin trail, stops, deviation analysis.';

-- ── updated_at trigger ───────────────────────────────────────────────────

create or replace function public.set_driver_locations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists driver_locations_set_updated_at on public.driver_locations;
create trigger driver_locations_set_updated_at
  before update on public.driver_locations
  for each row
  execute function public.set_driver_locations_updated_at();

alter table public.driver_locations enable row level security;
alter table public.driver_location_history enable row level security;

-- ── RLS driver_locations ─────────────────────────────────────────────────

drop policy if exists drivers_insert_own_driver_location on public.driver_locations;
drop policy if exists drivers_update_own_driver_location on public.driver_locations;
drop policy if exists drivers_select_own_driver_location on public.driver_locations;
drop policy if exists admin_select_all_driver_locations on public.driver_locations;
drop policy if exists "Drivers insert own driver location" on public.driver_locations;
drop policy if exists "Drivers update own driver location" on public.driver_locations;
drop policy if exists "Drivers read own driver location" on public.driver_locations;
drop policy if exists "Admin read all driver locations" on public.driver_locations;

create policy "Drivers insert own driver location"
  on public.driver_locations
  for insert
  to authenticated
  with check (
    driver_id = public.auth_driver_id()
    and (
      assignment_id is null
      or exists (
        select 1 from public.job_assignments ja
        where ja.id = assignment_id and ja.driver_id = public.auth_driver_id()
      )
    )
    and (
      quote_id is null
      or public.driver_has_quote_assignment(quote_id)
    )
  );

create policy "Drivers update own driver location"
  on public.driver_locations
  for update
  to authenticated
  using (driver_id = public.auth_driver_id())
  with check (
    driver_id = public.auth_driver_id()
    and (
      assignment_id is null
      or exists (
        select 1 from public.job_assignments ja
        where ja.id = assignment_id and ja.driver_id = public.auth_driver_id()
      )
    )
    and (
      quote_id is null
      or public.driver_has_quote_assignment(quote_id)
    )
  );

create policy "Drivers read own driver location"
  on public.driver_locations
  for select
  to authenticated
  using (driver_id = public.auth_driver_id());

create policy "Admin read all driver locations"
  on public.driver_locations
  for select
  to authenticated
  using (public.auth_is_admin_session());

-- ── RLS driver_location_history ──────────────────────────────────────────

drop policy if exists "Drivers insert own location history" on public.driver_location_history;
drop policy if exists "Drivers read own location history" on public.driver_location_history;
drop policy if exists "Admin read all location history" on public.driver_location_history;

create policy "Drivers insert own location history"
  on public.driver_location_history
  for insert
  to authenticated
  with check (
    driver_id = public.auth_driver_id()
    and (
      quote_id is null
      or public.driver_has_quote_assignment(quote_id)
    )
  );

create policy "Drivers read own location history"
  on public.driver_location_history
  for select
  to authenticated
  using (driver_id = public.auth_driver_id());

create policy "Admin read all location history"
  on public.driver_location_history
  for select
  to authenticated
  using (public.auth_is_admin_session());

grant select, insert, update, delete on table public.driver_locations to authenticated;
grant select, insert on table public.driver_location_history to authenticated;

-- ── Realtime ─────────────────────────────────────────────────────────────

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.driver_locations;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.driver_location_history;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

commit;
