-- A reused job_assignments row must still be able to start a new driver attempt.
-- workflow_version is the attempt id. Older history, photos and signatures stay
-- on the attempt that created them and cannot satisfy the new attempt.

begin;

alter table public.quotes
  add column if not exists workflow_version integer not null default 1,
  add column if not exists claimed_workflow_version integer,
  add column if not exists workflow_reset_at timestamptz,
  add column if not exists workflow_reset_by text,
  add column if not exists workflow_reset_reason text;

alter table public.job_assignments
  add column if not exists workflow_version integer not null default 1,
  add column if not exists claimed_workflow_version integer,
  add column if not exists workflow_reset_kind text;

alter table public.job_assignments drop constraint if exists job_assignments_workflow_reset_kind_check;
alter table public.job_assignments
  add constraint job_assignments_workflow_reset_kind_check
  check (
    workflow_reset_kind is null
    or workflow_reset_kind in ('manual', 'reassignment', 'unassign')
  );

alter table public.job_status_history
  add column if not exists workflow_version integer;

alter table public.job_photos
  add column if not exists workflow_version integer;

update public.job_status_history
set workflow_version = 1
where workflow_version is null;

update public.job_photos
set workflow_version = 1
where workflow_version is null;

create index if not exists job_status_history_quote_attempt_idx
  on public.job_status_history (quote_id, workflow_version, created_at desc);

comment on column public.quotes.workflow_version is
  'Current driver attempt. Increments on unassign, reassignment and manual reset. The booking id does not change.';
comment on column public.job_assignments.workflow_version is
  'Same attempt number as quotes.workflow_version. The assignment row may be reused.';
comment on column public.job_assignments.workflow_reset_kind is
  'Why the current attempt was opened: manual reset, reassignment, or unassign. Null on an ordinary first assign.';

create table if not exists public.driver_workflow_resets (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  previous_version integer not null,
  workflow_version integer not null,
  reason text not null check (reason in ('manual', 'reassignment', 'unassign')),
  actor_label text,
  actor_user_id uuid,
  driver_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists driver_workflow_resets_quote_idx
  on public.driver_workflow_resets (quote_id, created_at desc);

alter table public.driver_workflow_resets enable row level security;

drop policy if exists "Admin read driver workflow resets" on public.driver_workflow_resets;
create policy "Admin read driver workflow resets"
  on public.driver_workflow_resets
  for select
  to authenticated
  using (public.auth_is_admin_session());

grant select on public.driver_workflow_resets to authenticated;

create or replace function public.workflow_status_is_driver_progress(p_status text)
returns boolean
language sql
immutable
as $$
  select lower(trim(coalesce(p_status, ''))) in (
    'on_way', 'started', 'start', 'in_progress',
    'arrived', 'arrived_pickup', 'arrived_delivery',
    'loading', 'loading_started',
    'pickup_completed', 'loaded',
    'in_transit',
    'unloading', 'unloading_started', 'unloading_completed'
  );
$$;

create or replace function public.quote_workflow_is_terminal(
  p_status text,
  p_operational text,
  p_completed_at timestamptz,
  p_cancelled_at timestamptz
)
returns boolean
language sql
immutable
as $$
  select
    public.quote_row_is_completed(p_status, p_operational, p_completed_at)
    or p_cancelled_at is not null
    or lower(trim(coalesce(p_status, ''))) = 'cancelled'
    or lower(trim(coalesce(p_operational, ''))) = 'cancelled';
$$;

create or replace function public.quote_attempt_has_driver_progress(p_quote_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_quote public.quotes%rowtype;
  v_asg public.job_assignments%rowtype;
  v_version integer;
begin
  select * into v_quote from public.quotes where id = p_quote_id;
  if not found then
    return false;
  end if;
  v_version := coalesce(v_quote.workflow_version, 1);

  if public.workflow_status_is_driver_progress(v_quote.status)
     or public.workflow_status_is_driver_progress(v_quote.operational_status) then
    return true;
  end if;

  select * into v_asg from public.job_assignments where quote_id = p_quote_id;
  if found and public.workflow_status_is_driver_progress(v_asg.status) then
    return true;
  end if;

  if exists (
    select 1
    from public.job_status_history h
    where h.quote_id = p_quote_id
      and coalesce(h.workflow_version, 1) = v_version
      and h.corrects_event_id is null
      and public.workflow_status_is_driver_progress(h.status)
  ) then
    return true;
  end if;

  if exists (
    select 1
    from public.quote_inventory_items i
    where i.quote_id = p_quote_id
      and (i.driver_loaded or i.driver_unloaded)
  ) then
    return true;
  end if;

  return false;
end;
$$;

-- Opens a new attempt, or reports that the current one is already ready to start.
-- Does not delete history, photos, signatures, payments or the booking.
create or replace function public.prepare_driver_workflow_attempt(
  p_quote_id uuid,
  p_reason text,
  p_driver_id uuid default null,
  p_actor text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes%rowtype;
  v_asg public.job_assignments%rowtype;
  v_has_asg boolean := false;
  v_reason text := lower(trim(coalesce(p_reason, '')));
  v_actor text;
  v_version integer;
  v_bump boolean := false;
  v_write_assignment boolean := false;
  v_prior_driver uuid;
  v_driver_changed boolean := false;
  v_already_closed boolean := false;
begin
  if not public.auth_is_admin_session() then
    return jsonb_build_object('ok', false, 'error', 'not_authorised');
  end if;
  if p_quote_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_quote');
  end if;
  if v_reason not in ('manual', 'reassignment', 'unassign') then
    return jsonb_build_object('ok', false, 'error', 'unknown_reason');
  end if;

  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if public.quote_workflow_is_terminal(
    v_quote.status,
    v_quote.operational_status,
    v_quote.completed_at,
    v_quote.cancelled_at
  ) then
    return jsonb_build_object('ok', false, 'error', 'completed_or_cancelled');
  end if;

  select * into v_asg from public.job_assignments where quote_id = p_quote_id for update;
  v_has_asg := found;
  v_prior_driver := case when v_has_asg then v_asg.driver_id else v_quote.assigned_driver_id end;
  v_driver_changed :=
    v_reason = 'reassignment'
    and v_has_asg
    and p_driver_id is not null
    and v_asg.driver_id is distinct from p_driver_id;
  v_already_closed :=
    v_has_asg
    and lower(trim(coalesce(v_asg.status, ''))) in ('cancelled', 'inactive', 'unassigned', 'removed');

  if v_reason = 'manual' or v_reason = 'unassign' then
    v_bump := true;
  elsif v_reason = 'reassignment' then
    -- Unassign already opened a fresh version and cancelled the row.
    -- A direct move to another driver, while the row is still active, also
    -- opens a new version so an in-flight Start from the previous driver
    -- cannot land on the new assignment.
    v_bump := public.quote_attempt_has_driver_progress(p_quote_id)
      or (v_driver_changed and not v_already_closed);
  end if;

  v_version := coalesce(v_quote.workflow_version, 1);
  v_actor := coalesce(
    nullif(trim(coalesce(p_actor, '')), ''),
    nullif(trim(coalesce(auth.jwt() ->> 'email', '')), ''),
    auth.uid()::text
  );

  if v_bump then
    v_version := v_version + 1;

    update public.quote_inventory_items
    set driver_loaded = false,
        driver_unloaded = false
    where quote_id = p_quote_id;

    update public.quotes
    set workflow_version = v_version,
        claimed_workflow_version = null,
        workflow_reset_at = now(),
        workflow_reset_by = v_actor,
        workflow_reset_reason = v_reason,
        status = 'Booked',
        operational_status = case
          when v_reason = 'unassign' then null
          else 'Assigned'
        end,
        completed_at = null
    where id = p_quote_id;

    if v_has_asg then
      if v_reason = 'reassignment' then
        update public.job_assignments
        set workflow_version = v_version,
            claimed_workflow_version = null,
            workflow_reset_kind = 'reassignment',
            driver_id = coalesce(p_driver_id, driver_id),
            status = 'active',
            completed_at = null,
            updated_at = now()
        where quote_id = p_quote_id;
        v_write_assignment := true;
      else
        update public.job_assignments
        set workflow_version = v_version,
            claimed_workflow_version = null,
            workflow_reset_kind = v_reason,
            status = case
              when v_reason = 'manual' then 'active'
              when v_reason = 'unassign' then 'cancelled'
              else status
            end,
            completed_at = case
              when v_reason in ('manual', 'unassign') then null
              else completed_at
            end,
            updated_at = now()
        where quote_id = p_quote_id;
      end if;
    end if;

    insert into public.driver_workflow_resets (
      quote_id, previous_version, workflow_version, reason, actor_label, actor_user_id, driver_id
    ) values (
      p_quote_id,
      v_version - 1,
      v_version,
      v_reason,
      v_actor,
      auth.uid(),
      case when v_reason = 'reassignment' then coalesce(p_driver_id, v_prior_driver) else v_prior_driver end
    );
  end if;

  -- No new version was needed, but the job still has to land on the chosen
  -- driver as ready to start. One assignment write, so the phone alerts once.
  if not v_bump
     and v_reason = 'reassignment'
     and v_has_asg
     and p_driver_id is not null
     and (v_driver_changed or v_already_closed) then
    update public.job_assignments
    set driver_id = p_driver_id,
        status = 'active',
        workflow_reset_kind = 'reassignment',
        claimed_workflow_version = null,
        completed_at = null,
        updated_at = now()
    where quote_id = p_quote_id;
    v_write_assignment := true;
  end if;

  return jsonb_build_object(
    'ok', true,
    'bumped', v_bump,
    'assignment_written', v_write_assignment,
    'workflow_version', v_version,
    'prior_driver_id', v_prior_driver,
    'error', null
  );
end;
$$;

revoke all on function public.prepare_driver_workflow_attempt(uuid, text, uuid, text) from public;
grant execute on function public.prepare_driver_workflow_attempt(uuid, text, uuid, text) to authenticated;

-- Live stage is the latest event on the current attempt only.
create or replace function public.latest_driver_stage_status(p_quote_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select h.status
  from public.job_status_history h
  join public.quotes q on q.id = h.quote_id
  where h.quote_id = p_quote_id
    and coalesce(h.workflow_version, 1) = coalesce(q.workflow_version, 1)
    and h.corrects_event_id is null
    and lower(trim(coalesce(h.status, ''))) not in (
      'gps', 'location', 'available_location', 'active_job_location',
      'correction', 'customer_not_available', 'unable_to_contact'
    )
  order by coalesce(h.occurred_at, h.created_at) desc
  limit 1;
$$;

drop view if exists public.booking_workflow_status_v;
create view public.booking_workflow_status_v
with (security_invoker = true)
as
select distinct on (h.quote_id)
  h.quote_id,
  h.status as workflow_status,
  coalesce(h.occurred_at, h.created_at) as workflow_at,
  h.driver_id,
  h.job_assignment_id,
  h.latitude,
  h.longitude,
  coalesce(h.workflow_version, 1) as workflow_version
from public.job_status_history h
join public.quotes q on q.id = h.quote_id
where h.quote_id is not null
  and coalesce(h.workflow_version, 1) = coalesce(q.workflow_version, 1)
  and h.corrects_event_id is null
  and lower(trim(coalesce(h.status, ''))) not in (
    'gps', 'location', 'available_location', 'active_job_location',
    'correction', 'customer_not_available', 'unable_to_contact'
  )
order by h.quote_id, coalesce(h.occurred_at, h.created_at) desc;

comment on view public.booking_workflow_status_v is
  'Latest move stage on the current driver attempt. Earlier attempts stay in job_status_history.';

grant select on public.booking_workflow_status_v to authenticated;

create or replace function public.quotes_apply_driver_stage_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s text;
  v_version integer;
begin
  if new.quote_id is null or new.corrects_event_id is not null then
    return new;
  end if;

  select coalesce(q.workflow_version, 1) into v_version
  from public.quotes q
  where q.id = new.quote_id;

  if coalesce(new.workflow_version, 1) is distinct from coalesce(v_version, 1) then
    return new;
  end if;

  s := lower(trim(coalesce(new.status, '')));
  if s = 'arrived' then
    if lower(trim(coalesce(new.stop_type, ''))) in ('delivery', 'dropoff') then
      s := 'arrived_delivery';
    else
      s := 'arrived_pickup';
    end if;
  end if;

  if s not in (
    'on_way', 'started', 'start',
    'arrived_pickup',
    'loading_started', 'loading',
    'pickup_completed', 'loaded',
    'in_transit',
    'arrived_delivery',
    'unloading_started',
    'completed'
  ) then
    return new;
  end if;

  update public.quotes q
  set status = s
  where q.id = new.quote_id
    and not public.quote_row_is_completed(q.status, q.operational_status, q.completed_at)
    and coalesce(q.workflow_version, 1) = coalesce(new.workflow_version, 1)
    and lower(trim(coalesce(q.status, ''))) is distinct from s;

  return new;
end;
$$;

-- Reject a delayed Start / Arrived / Complete from an older attempt.
create or replace function public.job_status_history_require_current_attempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes%rowtype;
  v_asg public.job_assignments%rowtype;
begin
  if new.quote_id is null then
    return new;
  end if;

  select * into v_quote from public.quotes where id = new.quote_id;
  if not found then
    return new;
  end if;

  if public.auth_is_admin_session() and not public.auth_is_driver_session() then
    if new.workflow_version is null then
      new.workflow_version := coalesce(v_quote.workflow_version, 1);
    end if;
    return new;
  end if;

  if not public.auth_is_driver_session() then
    if new.workflow_version is null then
      new.workflow_version := coalesce(v_quote.workflow_version, 1);
    end if;
    return new;
  end if;

  if new.workflow_version is null
     or new.workflow_version is distinct from coalesce(v_quote.workflow_version, 1) then
    raise exception 'stale_workflow_version'
      using errcode = 'P0001';
  end if;

  select * into v_asg from public.job_assignments where quote_id = new.quote_id;
  if not found
     or v_asg.driver_id is distinct from public.auth_driver_id()
     or lower(trim(coalesce(v_asg.status, ''))) in ('cancelled', 'inactive', 'unassigned', 'removed') then
    raise exception 'assignment_closed'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists aaa_job_status_history_require_current_attempt on public.job_status_history;
create trigger aaa_job_status_history_require_current_attempt
  before insert on public.job_status_history
  for each row
  execute function public.job_status_history_require_current_attempt();

create or replace function public.quotes_reject_stale_driver_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.auth_is_admin_session() or not public.auth_is_driver_session() then
    return new;
  end if;

  if new.workflow_version is distinct from old.workflow_version then
    new.workflow_version := old.workflow_version;
  end if;

  if new.status is not distinct from old.status
     and new.operational_status is not distinct from old.operational_status
     and new.completed_at is not distinct from old.completed_at then
    return new;
  end if;

  if new.claimed_workflow_version is null
     or new.claimed_workflow_version is distinct from old.workflow_version then
    raise exception 'stale_workflow_version'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists aaa_quotes_reject_stale_driver_progress on public.quotes;
create trigger aaa_quotes_reject_stale_driver_progress
  before update on public.quotes
  for each row
  execute function public.quotes_reject_stale_driver_progress();

create or replace function public.job_assignments_reject_stale_driver_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.auth_is_admin_session() or not public.auth_is_driver_session() then
    return new;
  end if;

  if new.workflow_version is distinct from old.workflow_version then
    new.workflow_version := old.workflow_version;
  end if;
  if new.workflow_reset_kind is distinct from old.workflow_reset_kind then
    new.workflow_reset_kind := old.workflow_reset_kind;
  end if;

  if new.status is not distinct from old.status
     and new.completed_at is not distinct from old.completed_at then
    return new;
  end if;

  if lower(trim(coalesce(old.status, ''))) in ('cancelled', 'inactive', 'unassigned', 'removed') then
    raise exception 'assignment_closed'
      using errcode = 'P0001';
  end if;

  if new.claimed_workflow_version is null
     or new.claimed_workflow_version is distinct from old.workflow_version then
    raise exception 'stale_workflow_version'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists aaa_job_assignments_reject_stale_driver_progress on public.job_assignments;
create trigger aaa_job_assignments_reject_stale_driver_progress
  before update on public.job_assignments
  for each row
  execute function public.job_assignments_reject_stale_driver_progress();

create or replace function public.job_photos_require_current_attempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version integer;
begin
  if new.quote_id is null then
    return new;
  end if;

  select coalesce(workflow_version, 1) into v_version
  from public.quotes
  where id = new.quote_id;

  if public.auth_is_driver_session() and not public.auth_is_admin_session() then
    if new.workflow_version is null
       or new.workflow_version is distinct from coalesce(v_version, 1) then
      raise exception 'stale_workflow_version'
        using errcode = 'P0001';
    end if;
    return new;
  end if;

  if new.workflow_version is null then
    new.workflow_version := coalesce(v_version, 1);
  end if;
  return new;
end;
$$;

drop trigger if exists aaa_job_photos_require_current_attempt on public.job_photos;
create trigger aaa_job_photos_require_current_attempt
  before insert on public.job_photos
  for each row
  execute function public.job_photos_require_current_attempt();

-- Old 4-argument tick calls cannot attach to a new attempt.
create or replace function public.set_driver_inventory_tick(
  p_quote_id uuid,
  p_item_id uuid,
  p_loaded boolean,
  p_unloaded boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'stale_workflow_version'
    using errcode = 'P0001';
end;
$$;

create or replace function public.set_driver_inventory_tick(
  p_quote_id uuid,
  p_item_id uuid,
  p_loaded boolean,
  p_unloaded boolean,
  p_workflow_version integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version integer;
begin
  if public.auth_driver_id() is null then
    raise exception 'No driver profile';
  end if;
  if not public.driver_has_quote_assignment(p_quote_id) then
    raise exception 'This job is not assigned to you';
  end if;

  select coalesce(workflow_version, 1) into v_version
  from public.quotes
  where id = p_quote_id;

  if p_workflow_version is null or p_workflow_version is distinct from v_version then
    raise exception 'stale_workflow_version'
      using errcode = 'P0001';
  end if;

  update public.quote_inventory_items
  set driver_loaded = coalesce(p_loaded, false),
      driver_unloaded = coalesce(p_unloaded, false)
  where id = p_item_id
    and quote_id = p_quote_id;

  if not found then
    raise exception 'Inventory item not found';
  end if;
end;
$$;

revoke all on function public.set_driver_inventory_tick(uuid, uuid, boolean, boolean) from public;
revoke all on function public.set_driver_inventory_tick(uuid, uuid, boolean, boolean, integer) from public;
grant execute on function public.set_driver_inventory_tick(uuid, uuid, boolean, boolean) to authenticated;
grant execute on function public.set_driver_inventory_tick(uuid, uuid, boolean, boolean, integer) to authenticated;

-- Customer timeline shows the current attempt. Earlier rows stay in the table.
create or replace function public.public_get_job_move_timeline(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_quote_id uuid;
  v_version integer;
begin
  if p_token is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  select t.quote_id
    into v_quote_id
  from public.job_tracking_tokens t
  where t.token = p_token
    and t.revoked_at is null
    and t.expires_at >= now()
  limit 1;

  if v_quote_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  select coalesce(workflow_version, 1) into v_version
  from public.quotes
  where id = v_quote_id;

  return jsonb_build_object(
    'ok', true,
    'workflow_version', coalesce(v_version, 1),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', h.id,
        'status', h.status,
        'occurred_at', h.occurred_at,
        'created_at', h.created_at,
        'source', h.source,
        'stop_type', h.stop_type,
        'latitude', h.latitude,
        'longitude', h.longitude,
        'accuracy_m', h.accuracy_m,
        'notes', h.notes,
        'driver_id', h.driver_id,
        'driver_name', coalesce(nullif(trim(h.driver_name), ''), nullif(trim(d.full_name), '')),
        'corrects_event_id', h.corrects_event_id,
        'correction_reason', h.correction_reason,
        'actor_name', h.actor_name,
        'workflow_version', coalesce(h.workflow_version, 1)
      ) order by coalesce(h.occurred_at, h.created_at), h.created_at)
      from public.job_status_history h
      left join public.drivers d on d.id = h.driver_id
      where h.quote_id = v_quote_id
        and coalesce(h.workflow_version, 1) = coalesce(v_version, 1)
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.public_get_job_move_timeline(uuid) from public;
grant execute on function public.public_get_job_move_timeline(uuid) to anon, authenticated, service_role;

-- Driver signatures from an earlier attempt are not current proof.
-- Customer photos taken with the booking stay visible.
create or replace function public.tracking_evidence_photos(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  v_tok public.job_tracking_tokens%rowtype;
  v_q public.quotes%rowtype;
begin
  if p_token is null then
    return '[]'::jsonb;
  end if;

  select * into v_tok from public.job_tracking_tokens where token = p_token limit 1;
  if v_tok.id is null or v_tok.revoked_at is not null or v_tok.expires_at < now() then
    return '[]'::jsonb;
  end if;

  select * into v_q from public.quotes where id = v_tok.quote_id limit 1;
  if v_q.id is null or lower(coalesce(v_q.payment_status, '')) not in ('paid', 'deposit_paid') then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(to_jsonb(s) order by s.created_at nulls last)
    from (
      select
        p.id::text as id,
        p.photo_type,
        p.stop_type,
        p.storage_path,
        p.file_name,
        p.mime_type,
        p.uploaded_by,
        p.created_at,
        p.driver_id,
        p.metadata,
        coalesce(p.workflow_version, 1) as workflow_version
      from public.job_photos p
      where (
          p.quote_id = v_q.id
          or (nullif(v_q.quote_ref, '') is not null and p.quote_ref = v_q.quote_ref)
        )
        and (
          coalesce(p.uploaded_by, '') is distinct from 'driver'
          or coalesce(p.workflow_version, 1) = coalesce(v_q.workflow_version, 1)
        )

      union all

      select
        'storage:' || o.id::text as id,
        case
          when o.folder in ('pod_signature', 'waiver_signature') then o.folder
          when o.file_name like '%damage%' then 'damage'
          when o.file_name like '%delivery%' or o.file_name like '%dropoff%' then 'delivery'
          when o.file_name like '%pickup%' or o.file_name like '%collection%' then 'collection'
          when o.file_name like '%proof%' then 'proof'
          else 'general'
        end as photo_type,
        case
          when o.file_name like '%delivery%' or o.file_name like '%dropoff%' then 'DROPOFF'
          when o.file_name like '%pickup%' or o.file_name like '%collection%' then 'PICKUP'
          else null
        end as stop_type,
        o.name as storage_path,
        o.file_name,
        coalesce(o.metadata->>'mimetype', o.metadata->>'contentType') as mime_type,
        'driver' as uploaded_by,
        o.created_at,
        null::uuid as driver_id,
        null::jsonb as metadata,
        1 as workflow_version
      from (
        select
          objects.id,
          objects.name,
          objects.created_at,
          objects.metadata,
          split_part(objects.name, '/', 3) as folder,
          lower(
            case
              when split_part(objects.name, '/', 4) <> '' then split_part(objects.name, '/', 4)
              else regexp_replace(objects.name, '^.*/', '')
            end
          ) as file_name
        from storage.objects
        where coalesce(v_q.workflow_version, 1) = 1
          and objects.bucket_id in ('quote-photos', 'job-evidence', 'job-photos')
          and objects.name ~* '\.(jpe?g|png|webp|gif|heic|heif)$'
          and (
            objects.name like v_q.id::text || '/%'
            or (nullif(v_q.quote_ref, '') is not null and objects.name ilike v_q.quote_ref || '/%')
          )
          and not exists (
            select 1
            from public.job_photos p
            where p.storage_path = objects.name
              and (
                p.quote_id = v_q.id
                or (nullif(v_q.quote_ref, '') is not null and p.quote_ref = v_q.quote_ref)
              )
          )
      ) o
    ) s
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.tracking_evidence_photos(uuid) from public, anon, authenticated;
grant execute on function public.tracking_evidence_photos(uuid) to service_role;

commit;
