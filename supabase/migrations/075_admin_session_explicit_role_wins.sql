-- Fix 073 regression: JWT role=admin must always pass auth_is_admin_session().
-- 073 required auth_driver_id() IS NULL, which blocked admin accounts that also
-- have a linked drivers row (e.g. office admin who is also in the fleet table).
-- Drivers still cannot pass: they have app_metadata.role = driver, not admin.

begin;

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
    );
$$;

comment on function public.auth_is_admin_session() is
  'Admin web: explicit JWT role admin (app or user metadata). Drivers use role=driver.';

-- Ensure admin can manage assignments (assign / unassign → mobile sync)
drop policy if exists "Admin session manage job assignments" on public.job_assignments;
create policy "Admin session manage job assignments"
  on public.job_assignments
  for all
  to authenticated
  using (public.auth_is_admin_session())
  with check (public.auth_is_admin_session());

commit;
