-- Run in Supabase Dashboard → SQL Editor if CLI db push is unavailable.
-- Fixes: admin assign → mobile app sync + admin GPS read for dual admin/driver accounts.

-- ── 074: assignment reactivation + case-insensitive status ─────────────────

begin;

update public.job_assignments
set
  status = 'active',
  updated_at = now(),
  completed_at = null
where lower(trim(status)) in ('assigned', 'accepted');

create or replace function public.driver_has_quote_assignment(p_quote_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.job_assignments ja
    where ja.quote_id = p_quote_id
      and ja.driver_id = public.auth_driver_id()
      and lower(trim(ja.status)) in (
        'active',
        'assigned',
        'accepted',
        'on_way',
        'in_progress',
        'arrived',
        'in_transit',
        'pickup_completed',
        'completed'
      )
      and lower(trim(ja.status)) not in ('cancelled', 'inactive', 'unassigned', 'removed')
  );
$$;

alter table public.job_assignments drop constraint if exists job_assignments_status_check;
alter table public.job_assignments
  add constraint job_assignments_status_check
  check (
    lower(trim(status)) in (
      'active',
      'inactive',
      'cancelled',
      'assigned',
      'accepted',
      'on_way',
      'in_progress',
      'arrived',
      'in_transit',
      'pickup_completed',
      'completed',
      'unassigned',
      'removed'
    )
  );

drop policy if exists "Drivers update own job assignments" on public.job_assignments;
create policy "Drivers update own job assignments"
  on public.job_assignments
  for update
  to authenticated
  using (public.auth_is_driver_session() and driver_id = public.auth_driver_id())
  with check (
    public.auth_is_driver_session()
    and driver_id = public.auth_driver_id()
    and lower(trim(status)) in (
      'active',
      'assigned',
      'accepted',
      'on_way',
      'in_progress',
      'arrived',
      'in_transit',
      'pickup_completed',
      'completed'
    )
  );

drop policy if exists "drivers_update_own_assignments" on public.job_assignments;
create policy "drivers_update_own_assignments"
  on public.job_assignments
  for update
  to authenticated
  using (driver_id = public.auth_driver_id())
  with check (
    driver_id = public.auth_driver_id()
    and lower(trim(status)) in (
      'active',
      'assigned',
      'accepted',
      'in_progress',
      'on_way',
      'arrived',
      'in_transit',
      'pickup_completed',
      'completed'
    )
    and (
      lower(trim(status)) <> 'completed'
      or completed_at is not null
    )
  );

commit;

-- ── 075: admin JWT role wins (fix 073 dual admin+driver accounts) ─────────

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

drop policy if exists "Admin session manage job assignments" on public.job_assignments;
create policy "Admin session manage job assignments"
  on public.job_assignments
  for all
  to authenticated
  using (public.auth_is_admin_session())
  with check (public.auth_is_admin_session());

commit;

-- Verify
select pg_get_functiondef('public.auth_is_admin_session()'::regprocedure);

select q.quote_ref, q.assigned_driver_name, ja.status as ja_status
from public.quotes q
join public.job_assignments ja on ja.quote_id = q.id
where lower(trim(ja.status)) not in ('cancelled', 'inactive', 'completed')
order by ja.updated_at desc
limit 10;
