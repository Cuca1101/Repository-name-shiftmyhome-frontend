-- Driver app job workflow: fix assignment helper + admin workflow view (Start → Complete pickup/dropoff).
-- Mobile writes quotes.status, job_assignments.status, job_status_history.status (on_way, arrived, etc.).
-- Idempotent; does not reset data.

-- =============================================================================
-- 1) driver_has_quote_assignment — must stay true during on_way / in_transit (not only active)
-- =============================================================================
-- Production had only ('active','completed') which breaks sync after Start Job sets on_way.

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
      and ja.status in (
        'active',
        'Assigned',
        'Accepted',
        'on_way',
        'in_progress',
        'arrived',
        'in_transit',
        'pickup_completed',
        'completed',
        'Completed'
      )
  );
$$;

comment on function public.driver_has_quote_assignment(uuid) is
  'True when current driver has a non-cancelled assignment for the quote (includes on_way/in_transit workflow).';

-- Legacy driver accounts: linked drivers.user_id without app_metadata.role still count as driver (not admin).
create or replace function public.auth_is_driver_session()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and public.auth_driver_id() is not null
    and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') is distinct from 'admin';
$$;

comment on function public.auth_is_driver_session() is
  'Fleet driver session: active drivers row + JWT role is not admin (role=driver or legacy empty).';

-- =============================================================================
-- 2) Mirror quotes.status → operational_status for admin timeline (driver session only)
-- =============================================================================

create or replace function public.quotes_sync_driver_workflow_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s text;
begin
  if not public.auth_is_driver_session() then
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  s := lower(trim(coalesce(new.status, '')));

  new.operational_status := case s
    when 'on_way' then 'On way'
    when 'arrived' then 'Arrived'
    when 'pickup_completed' then 'In transit'
    when 'in_transit' then 'In transit'
    when 'in_progress' then 'In progress'
    when 'completed' then 'Completed'
    when 'cancelled' then 'Cancelled'
    else new.operational_status
  end;

  if s = 'completed' and new.completed_at is null then
    new.completed_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists quotes_sync_driver_workflow_status on public.quotes;
create trigger quotes_sync_driver_workflow_status
  before update of status on public.quotes
  for each row
  execute function public.quotes_sync_driver_workflow_status();

comment on function public.quotes_sync_driver_workflow_status() is
  'When driver updates quotes.status from mobile, mirror operational_status for admin UI.';

-- =============================================================================
-- 3) job_status_history — allow full mobile status vocabulary on driver INSERT
-- =============================================================================

drop policy if exists "Drivers insert own job status history" on public.job_status_history;
create policy "Drivers insert own job status history"
  on public.job_status_history
  for insert
  to authenticated
  with check (
    public.auth_is_driver_session()
    and driver_id = public.auth_driver_id()
    and (
      quote_id is null
      or public.driver_has_quote_assignment(quote_id)
    )
    and lower(trim(status)) in (
      'on_way',
      'in_progress',
      'arrived',
      'arrived_pickup',
      'arrived_delivery',
      'pickup_completed',
      'loaded',
      'in_transit',
      'completed',
      'cancelled',
      'gps',
      'location',
      'started',
      'start',
      'available_location',
      'active_job_location'
    )
  );

-- =============================================================================
-- 4) quotes — driver UPDATE on quotes.status (mobile sync path)
-- =============================================================================

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
      'pickup_completed',
      'loaded',
      'in_transit',
      'completed',
      'cancelled',
      ''
    )
  );

-- =============================================================================
-- 5) job_assignments — driver UPDATE (058 policy; ensure present after manual drift)
-- =============================================================================

drop policy if exists "Drivers update own job assignments" on public.job_assignments;
create policy "Drivers update own job assignments"
  on public.job_assignments
  for update
  to authenticated
  using (public.auth_is_driver_session() and driver_id = public.auth_driver_id())
  with check (
    public.auth_is_driver_session()
    and driver_id = public.auth_driver_id()
    and status in (
      'active',
      'Assigned',
      'Accepted',
      'on_way',
      'in_progress',
      'arrived',
      'in_transit',
      'pickup_completed',
      'completed',
      'Completed'
    )
  );

-- Widen check constraint if an older project omitted workflow statuses
alter table public.job_assignments drop constraint if exists job_assignments_status_check;
alter table public.job_assignments
  add constraint job_assignments_status_check
  check (
    status in (
      'active',
      'inactive',
      'cancelled',
      'Assigned',
      'Accepted',
      'on_way',
      'in_progress',
      'arrived',
      'in_transit',
      'pickup_completed',
      'completed',
      'Completed',
      'Cancelled'
    )
  );

-- =============================================================================
-- 6) booking_workflow_status_v — admin + mobile: latest driver workflow event per quote
-- =============================================================================

create or replace view public.booking_workflow_status_v as
select distinct on (h.quote_id)
  h.quote_id,
  h.status as workflow_status,
  h.created_at as workflow_at,
  h.driver_id,
  h.job_assignment_id,
  h.latitude,
  h.longitude
from public.job_status_history h
where h.quote_id is not null
order by h.quote_id, h.created_at desc;

comment on view public.booking_workflow_status_v is
  'Latest job_status_history row per quote — primary source for admin Status Tracker when driver uses mobile.';

grant select on public.booking_workflow_status_v to authenticated;

-- =============================================================================
-- 7) job_photos — driver evidence upload (authenticated, assigned quote)
-- =============================================================================

drop policy if exists "Drivers insert job photos for assignment" on public.job_photos;
create policy "Drivers insert job photos for assignment"
  on public.job_photos
  for insert
  to authenticated
  with check (
    public.auth_is_driver_session()
    and uploaded_by = 'driver'
    and quote_ref ~ '^SMH-[0-9]{4}-[0-9]{6}$'
    and exists (
      select 1
      from public.quotes q
      where q.quote_ref = job_photos.quote_ref
        and public.driver_has_quote_assignment(q.id)
    )
  );

drop policy if exists "Drivers read job photos for assignment" on public.job_photos;
create policy "Drivers read job photos for assignment"
  on public.job_photos
  for select
  to authenticated
  using (
    public.auth_is_driver_session()
    and exists (
      select 1
      from public.quotes q
      where q.quote_ref = job_photos.quote_ref
        and public.driver_has_quote_assignment(q.id)
    )
  );

-- =============================================================================
-- 8) driver_locations — explicit grant (mobile GPS; table may predate 061)
-- =============================================================================

do $$
begin
  if exists (
    select 1 from pg_tables
    where schemaname = 'public' and tablename = 'driver_locations'
  ) then
    grant select, insert, update, delete on table public.driver_locations to authenticated;
    comment on table public.driver_locations is
      'Live driver GPS (one row per driver). authenticated only; RLS scopes own driver_id.';
  end if;
end $$;
