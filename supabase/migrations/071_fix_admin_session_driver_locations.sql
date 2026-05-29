-- Fix admin session detection + driver_locations RLS after 061/070 drift.
-- Symptoms when broken:
--   - Admin cannot unassign drivers (job_assignments / quotes UPDATE blocked)
--   - Operations map shows no live GPS (driver_locations SELECT blocked)
--
-- Root cause: auth_is_admin_session() ignored user_metadata.role = admin and
-- blocked admins who also have a linked drivers row. driver_locations admin
-- policy from 061 used is_admin() instead of auth_is_admin_session().

begin;

-- ── 1) Admin session — explicit admin role always wins ───────────────────

create or replace function public.auth_is_admin_session()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and (
      coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
      or coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin'
      or (
        public.auth_driver_id() is null
        and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') is distinct from 'driver'
        and coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') is distinct from 'driver'
      )
    );
$$;

comment on function public.auth_is_admin_session() is
  'Admin web session: JWT role admin (app or user metadata), or legacy non-driver without fleet row.';

-- ── 2) job_assignments — ensure admin manage policy exists ───────────────

drop policy if exists "Admin session manage job assignments" on public.job_assignments;
create policy "Admin session manage job assignments"
  on public.job_assignments
  for all
  to authenticated
  using (public.auth_is_admin_session())
  with check (public.auth_is_admin_session());

-- ── 3) driver_locations — align admin read + allow admin cleanup ─────────

do $$
begin
  if exists (
    select 1 from pg_tables
    where schemaname = 'public' and tablename = 'driver_locations'
  ) then
    grant select, insert, update, delete on table public.driver_locations to authenticated;

    drop policy if exists drivers_insert_own_driver_location on public.driver_locations;
    drop policy if exists drivers_update_own_driver_location on public.driver_locations;
    drop policy if exists drivers_select_own_driver_location on public.driver_locations;
    drop policy if exists admin_select_all_driver_locations on public.driver_locations;
    drop policy if exists "Drivers insert own driver location" on public.driver_locations;
    drop policy if exists "Drivers update own driver location" on public.driver_locations;
    drop policy if exists "Drivers read own driver location" on public.driver_locations;
    drop policy if exists "Admin read all driver locations" on public.driver_locations;
    drop policy if exists "Admin manage all driver locations" on public.driver_locations;

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

    create policy "Admin manage all driver locations"
      on public.driver_locations
      for all
      to authenticated
      using (public.auth_is_admin_session())
      with check (public.auth_is_admin_session());
  end if;
end $$;

commit;
