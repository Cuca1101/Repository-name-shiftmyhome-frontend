-- Fix driver assignment reactivation after 072 status normalization.
-- 072 lowercased Assigned/Accepted but driver_has_quote_assignment() and
-- job_assignments_status_check still expected legacy casing — re-assign from
-- admin could not reliably sync to the mobile app.

begin;

-- 1) Canonical statuses for mobile visibility
update public.job_assignments
set
  status = 'active',
  updated_at = now(),
  completed_at = null
where lower(trim(status)) in ('assigned', 'accepted');

-- 2) Case-insensitive assignment helper (used by quotes + photos RLS)
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

comment on function public.driver_has_quote_assignment(uuid) is
  'True when current driver has a non-terminal assignment for the quote (case-insensitive status).';

-- 3) Status check — allow lowercase legacy + workflow statuses
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

-- 4) Driver UPDATE policies — accept lowercase assigned/accepted targets
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
