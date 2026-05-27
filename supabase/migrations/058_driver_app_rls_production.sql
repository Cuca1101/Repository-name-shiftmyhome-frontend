-- Driver App production RLS — replaces broad authenticated ALL policies (056–057).
-- Apply in Supabase SQL Editor. Run supabase/scripts/driver-app-rls-audit.sql before and after.
--
-- REMOVES (unsafe):
--   drivers: "Authenticated manage drivers admin" (FOR ALL USING true)
--   job_assignments: "Authenticated manage job assignments" (FOR ALL USING true)
--
-- REQUIRES: Admin Auth users have app_metadata.role = 'admin'
--           Driver Auth users have app_metadata.role = 'driver' (create-driver-account sets this)
-- See: supabase/scripts/backfill-auth-admin-role.sql

-- =============================================================================
-- 1) Helper functions (SECURITY DEFINER, search_path = public)
-- =============================================================================

create or replace function public.auth_driver_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select d.id
  from public.drivers d
  where d.user_id = auth.uid()
    and coalesce(d.active, true) = true
  limit 1;
$$;

create or replace function public.auth_is_driver_session()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and public.auth_driver_id() is not null
    and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'driver';
$$;

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
      or (
        public.auth_driver_id() is null
        and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') is distinct from 'driver'
        and coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') is distinct from 'driver'
      )
    );
$$;

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
        'in_progress',
        'arrived',
        'completed',
        'Completed'
      )
  );
$$;

comment on function public.auth_driver_id() is 'drivers.id for current Auth user (mobile).';
comment on function public.auth_is_driver_session() is 'JWT app_metadata.role = driver with linked fleet row.';
comment on function public.auth_is_admin_session() is 'Admin web session (app_metadata.role = admin or legacy non-driver).';
comment on function public.driver_has_quote_assignment(uuid) is 'Current driver has active assignment for quote.';

grant execute on function public.auth_driver_id() to authenticated;
grant execute on function public.auth_is_driver_session() to authenticated;
grant execute on function public.auth_is_admin_session() to authenticated;
grant execute on function public.driver_has_quote_assignment(uuid) to authenticated;

-- =============================================================================
-- 2) job_status_history
-- =============================================================================

create table if not exists public.job_status_history (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  driver_id uuid not null references public.drivers (id) on delete cascade,
  status text not null,
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists job_status_history_quote_id_idx on public.job_status_history (quote_id);
create index if not exists job_status_history_driver_id_idx on public.job_status_history (driver_id);
create index if not exists job_status_history_created_at_idx on public.job_status_history (created_at desc);

alter table public.job_status_history enable row level security;

-- Optional completion timestamp on assignments (mobile may set when job completes)
alter table public.job_assignments add column if not exists completed_at timestamptz;

-- =============================================================================
-- 3) drivers — DROP dangerous policy, admin + driver scoped
-- =============================================================================

drop policy if exists "Authenticated manage drivers admin" on public.drivers;

create policy "Admin session manage drivers"
  on public.drivers
  for all
  to authenticated
  using (public.auth_is_admin_session())
  with check (public.auth_is_admin_session());

drop policy if exists "Drivers read own profile" on public.drivers;
create policy "Drivers read own profile"
  on public.drivers
  for select
  to authenticated
  using (public.auth_is_driver_session() and user_id = auth.uid());

-- =============================================================================
-- 4) job_assignments
-- =============================================================================

drop policy if exists "Authenticated manage job assignments" on public.job_assignments;

create policy "Admin session manage job assignments"
  on public.job_assignments
  for all
  to authenticated
  using (public.auth_is_admin_session())
  with check (public.auth_is_admin_session());

drop policy if exists "Drivers read own job assignments" on public.job_assignments;
create policy "Drivers read own job assignments"
  on public.job_assignments
  for select
  to authenticated
  using (public.auth_is_driver_session() and driver_id = public.auth_driver_id());

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
      'in_progress',
      'arrived',
      'completed',
      'Completed'
    )
  );

-- =============================================================================
-- 5) quotes — admin + driver scoped
-- =============================================================================

drop policy if exists "Authenticated read all quotes" on public.quotes;
create policy "Authenticated read all quotes"
  on public.quotes
  for select
  to authenticated
  using (public.auth_is_admin_session());

drop policy if exists "Authenticated update quotes admin" on public.quotes;
create policy "Authenticated update quotes admin"
  on public.quotes
  for update
  to authenticated
  using (public.auth_is_admin_session())
  with check (public.auth_is_admin_session());

drop policy if exists "Authenticated insert quotes admin" on public.quotes;
create policy "Authenticated insert quotes admin"
  on public.quotes
  for insert
  to authenticated
  with check (public.auth_is_admin_session());

drop policy if exists "Drivers read assigned quotes" on public.quotes;
create policy "Drivers read assigned quotes"
  on public.quotes
  for select
  to authenticated
  using (
    public.auth_is_driver_session()
    and (
      assigned_driver_id = public.auth_driver_id()
      or public.driver_has_quote_assignment(id)
    )
  );

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
    and lower(trim(coalesce(operational_status, ''))) in (
      'assigned',
      'in_progress',
      'arrived',
      'completed',
      ''
    )
  );

-- =============================================================================
-- 6) job_status_history
-- =============================================================================

drop policy if exists "Admin session manage job status history" on public.job_status_history;
create policy "Admin session manage job status history"
  on public.job_status_history
  for all
  to authenticated
  using (public.auth_is_admin_session())
  with check (public.auth_is_admin_session());

drop policy if exists "Drivers insert own job status history" on public.job_status_history;
create policy "Drivers insert own job status history"
  on public.job_status_history
  for insert
  to authenticated
  with check (
    public.auth_is_driver_session()
    and driver_id = public.auth_driver_id()
    and public.driver_has_quote_assignment(quote_id)
    and lower(trim(status)) in (
      'assigned',
      'in_progress',
      'arrived',
      'arrived_pickup',
      'arrived_delivery',
      'completed',
      'gps',
      'location',
      'started',
      'start'
    )
  );

drop policy if exists "Drivers read own job status history" on public.job_status_history;
create policy "Drivers read own job status history"
  on public.job_status_history
  for select
  to authenticated
  using (public.auth_is_driver_session() and driver_id = public.auth_driver_id());

-- =============================================================================
-- 7) Column guards (drivers cannot change sensitive fields)
-- =============================================================================

create or replace function public.job_assignments_guard_driver_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.auth_is_admin_session() or not public.auth_is_driver_session() then
    return new;
  end if;

  if old.quote_id is distinct from new.quote_id
    or old.driver_id is distinct from new.driver_id
  then
    raise exception 'Driver cannot reassign job_assignments row';
  end if;

  return new;
end;
$$;

drop trigger if exists job_assignments_guard_driver_updates on public.job_assignments;
create trigger job_assignments_guard_driver_updates
  before update on public.job_assignments
  for each row
  execute function public.job_assignments_guard_driver_updates();

create or replace function public.quotes_guard_driver_column_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.auth_is_admin_session() or not public.auth_is_driver_session() then
    return new;
  end if;

  if old.id is distinct from new.id or old.quote_ref is distinct from new.quote_ref then
    raise exception 'Driver cannot change quote identity';
  end if;

  if old.assigned_driver_id is distinct from new.assigned_driver_id
    or old.assigned_driver_name is distinct from new.assigned_driver_name
    or old.assigned_partner_id is distinct from new.assigned_partner_id
    or old.assigned_partner_company is distinct from new.assigned_partner_company
    or old.assigned_at is distinct from new.assigned_at
    or old.assigned_by is distinct from new.assigned_by
  then
    raise exception 'Driver cannot change assignment fields';
  end if;

  if old.estimated_total is distinct from new.estimated_total
    or old.amount_paid is distinct from new.amount_paid
    or old.remaining_balance is distinct from new.remaining_balance
    or old.pricing is distinct from new.pricing
    or old.payment_status is distinct from new.payment_status
    or old.payment_type is distinct from new.payment_type
    or old.paid_at is distinct from new.paid_at
    or old.stripe_session_id is distinct from new.stripe_session_id
    or old.stripe_payment_intent_id is distinct from new.stripe_payment_intent_id
    or old.marketplace_payout_price is distinct from new.marketplace_payout_price
    or old.marketplace_visibility is distinct from new.marketplace_visibility
    or old.driver_payout_amount is distinct from new.driver_payout_amount
    or old.partner_payout_amount is distinct from new.partner_payout_amount
    or old.platform_profit_amount is distinct from new.platform_profit_amount
    or old.platform_margin_percent is distinct from new.platform_margin_percent
    or old.payout_status is distinct from new.payout_status
    or old.payout_notes is distinct from new.payout_notes
    or old.payout_paid_amount is distinct from new.payout_paid_amount
    or old.payout_paid_at is distinct from new.payout_paid_at
    or old.admin_notes_log is distinct from new.admin_notes_log
    or old.admin_completion_note is distinct from new.admin_completion_note
    or old.admin_cancellation_reason is distinct from new.admin_cancellation_reason
    or old.bundled_journey_id is distinct from new.bundled_journey_id
    or old.partner_dashboard_hidden is distinct from new.partner_dashboard_hidden
  then
    raise exception 'Driver cannot change pricing, payment, or admin fields';
  end if;

  if lower(trim(coalesce(new.operational_status, ''))) not in (
    'assigned', 'in_progress', 'arrived', 'completed', ''
  ) then
    raise exception 'Driver operational_status must be in_progress, arrived, or completed';
  end if;

  return new;
end;
$$;

drop trigger if exists quotes_guard_driver_updates on public.quotes;
create trigger quotes_guard_driver_updates
  before update on public.quotes
  for each row
  execute function public.quotes_guard_driver_column_updates();
