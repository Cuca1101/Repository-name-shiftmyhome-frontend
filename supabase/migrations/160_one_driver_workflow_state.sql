-- One confirmed workflow for the current assignment attempt.
-- job_status_history is the event log. driver_workflow_state reads that log
-- and is the only place that decides the stage. quotes.status and
-- quotes.operational_status are a projection of it. A driver update cannot
-- choose a different stage. Manual and GPS arrivals stay the same event;
-- only job_status_history.source differs. History rows are not rewritten.

create or replace function public.driver_workflow_state(p_quote_id uuid)
returns table (
  stage text,
  status text,
  operational_status text,
  stage_at timestamptz,
  assignment_status text,
  workflow_version integer
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_version integer;
  v_start timestamptz;
  v_arrived timestamptz;
  v_loading timestamptz;
  v_collected timestamptz;
  v_delivery_start timestamptz;
  v_delivery_arrived timestamptz;
  v_unloading timestamptz;
  v_completed timestamptz;
  r record;
  s text;
  at_time timestamptz;
  delivery_stop boolean;
  best_rank integer := 0;
  best_stage text;
  best_at timestamptz;
begin
  select coalesce(q.workflow_version, 1) into v_version
  from public.quotes q
  where q.id = p_quote_id;
  if v_version is null then
    return;
  end if;

  for r in
    select h.status, h.stop_type, coalesce(h.occurred_at, h.created_at) as at_time
    from public.job_status_history h
    where h.quote_id = p_quote_id
      and coalesce(h.workflow_version, 1) = v_version
      and h.corrects_event_id is null
    order by coalesce(h.occurred_at, h.created_at), h.created_at
  loop
    s := lower(trim(coalesce(r.status, '')));
    at_time := r.at_time;
    if s = '' or at_time is null then
      continue;
    end if;
    if s in (
      'gps', 'location', 'available_location', 'active_job_location',
      'correction', 'customer_not_available', 'unable_to_contact'
    ) then
      continue;
    end if;

    delivery_stop := lower(trim(coalesce(r.stop_type, ''))) in ('delivery', 'dropoff');
    if s = 'arrived' then
      s := case when delivery_stop then 'arrived_delivery' else 'arrived_pickup' end;
    end if;

    if s in ('on_way', 'started', 'start', 'in_progress', 'on_the_way', 'left_for_collection')
       and v_start is null then
      v_start := at_time;
    elsif s in ('arrived_pickup', 'at_collection')
       and v_start is not null
       and at_time >= v_start
       and v_arrived is null then
      v_arrived := at_time;
    elsif s in ('loading', 'loading_started')
       and v_arrived is not null
       and at_time >= v_arrived
       and v_loading is null then
      v_loading := at_time;
    elsif s in ('pickup_completed', 'loaded', 'collection_finished', 'items_collected')
       and v_arrived is not null
       and at_time >= v_arrived
       and v_collected is null then
      v_collected := at_time;
    elsif s in ('in_transit', 'left_for_delivery', 'on_way_to_delivery')
       and v_delivery_start is null then
      v_delivery_start := at_time;
    elsif s in ('arrived_delivery', 'at_delivery')
       and v_delivery_start is not null
       and at_time >= v_delivery_start
       and v_delivery_arrived is null then
      v_delivery_arrived := at_time;
    elsif s in ('unloading', 'unloading_started')
       and v_delivery_arrived is not null
       and at_time >= v_delivery_arrived
       and v_unloading is null then
      v_unloading := at_time;
    elsif s = 'completed' and v_completed is null then
      v_completed := at_time;
    end if;
  end loop;

  -- The latest milestone wins. An equal timestamp keeps the further stage.
  if v_start is not null then
    best_rank := 1; best_stage := 'left_for_collection'; best_at := v_start;
  end if;
  if v_arrived is not null and (best_at is null or v_arrived >= best_at) then
    best_rank := 2; best_stage := 'arrived_collection'; best_at := v_arrived;
  end if;
  if v_loading is not null and (best_at is null or v_loading >= best_at) then
    best_rank := 3; best_stage := 'loading'; best_at := v_loading;
  end if;
  if v_collected is not null and (best_at is null or v_collected >= best_at) then
    best_rank := 4; best_stage := 'collection_complete'; best_at := v_collected;
  end if;
  if v_delivery_start is not null and (best_at is null or v_delivery_start >= best_at) then
    best_rank := 5; best_stage := 'left_for_delivery'; best_at := v_delivery_start;
  end if;
  if v_delivery_arrived is not null and (best_at is null or v_delivery_arrived >= best_at) then
    best_rank := 6; best_stage := 'arrived_delivery'; best_at := v_delivery_arrived;
  end if;
  if v_unloading is not null and (best_at is null or v_unloading >= best_at) then
    best_rank := 7; best_stage := 'unloading'; best_at := v_unloading;
  end if;
  if v_completed is not null and (best_at is null or v_completed >= best_at) then
    best_rank := 8; best_stage := 'completed'; best_at := v_completed;
  end if;

  if best_stage is null then
    return;
  end if;

  stage := best_stage;
  stage_at := best_at;
  workflow_version := v_version;
  if best_stage = 'completed' then
    status := 'completed';
    operational_status := 'Completed';
    assignment_status := 'completed';
  elsif best_stage = 'unloading' then
    status := 'arrived_delivery';
    operational_status := 'Arrived at delivery · Unloading';
    assignment_status := 'arrived';
  elsif best_stage = 'arrived_delivery' then
    status := 'arrived_delivery';
    operational_status := 'Arrived at delivery';
    assignment_status := 'arrived';
  elsif best_stage = 'left_for_delivery' then
    status := 'in_transit';
    operational_status := 'Left for delivery';
    assignment_status := 'in_progress';
  elsif best_stage = 'collection_complete' then
    status := 'pickup_completed';
    operational_status := 'Collection complete';
    assignment_status := 'in_progress';
  elsif best_stage = 'loading' then
    status := 'arrived_pickup';
    operational_status := 'Arrived at collection · Loading';
    assignment_status := 'arrived';
  elsif best_stage = 'arrived_collection' then
    status := 'arrived_pickup';
    operational_status := 'Arrived at collection';
    assignment_status := 'arrived';
  else
    status := 'on_way';
    operational_status := 'Left for collection';
    assignment_status := 'on_way';
  end if;
  return next;
end;
$$;

revoke all on function public.driver_workflow_state(uuid) from public;
grant execute on function public.driver_workflow_state(uuid) to authenticated, service_role;

create or replace function public.latest_driver_stage_status(p_quote_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select w.status
  from public.driver_workflow_state(p_quote_id) w
  limit 1;
$$;

create or replace function public.project_driver_workflow(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes%rowtype;
  v_state record;
begin
  select * into v_quote from public.quotes where id = p_quote_id;
  if not found then
    return;
  end if;
  if public.quote_row_is_completed(v_quote.status, v_quote.operational_status, v_quote.completed_at)
     or v_quote.cancelled_at is not null
     or lower(trim(coalesce(v_quote.operational_status, ''))) = 'cancelled' then
    return;
  end if;

  select * into v_state from public.driver_workflow_state(p_quote_id);
  if v_state.status is null then
    return;
  end if;

  update public.quotes q
  set
    status = v_state.status,
    operational_status = v_state.operational_status,
    completed_at = case
      when v_state.status = 'completed' then coalesce(q.completed_at, v_state.stage_at, now())
      else q.completed_at
    end
  where q.id = p_quote_id
    and (
      q.status is distinct from v_state.status
      or q.operational_status is distinct from v_state.operational_status
      or (v_state.status = 'completed' and q.completed_at is null)
    );

  update public.job_assignments a
  set
    status = v_state.assignment_status,
    claimed_workflow_version = coalesce(a.workflow_version, v_state.workflow_version, 1),
    completed_at = case
      when v_state.assignment_status = 'completed' then coalesce(a.completed_at, v_state.stage_at, now())
      else a.completed_at
    end,
    updated_at = now()
  where a.quote_id = p_quote_id
    and a.driver_id = v_quote.assigned_driver_id
    and a.completed_at is null
    and lower(trim(coalesce(a.status, ''))) not in ('completed', 'cancelled', 'inactive', 'unassigned', 'removed')
    and (
      a.status is distinct from v_state.assignment_status
      or (v_state.assignment_status = 'completed' and a.completed_at is null)
    );
end;
$$;

revoke all on function public.project_driver_workflow(uuid) from public;
grant execute on function public.project_driver_workflow(uuid) to service_role;

create or replace function public.quotes_apply_driver_stage_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
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

  perform public.project_driver_workflow(new.quote_id);
  return new;
end;
$$;

create or replace function public.quotes_sync_driver_workflow_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state record;
begin
  if public.quote_row_is_completed(old.status, old.operational_status, old.completed_at)
     and not public.auth_is_admin_session() then
    return new;
  end if;

  if not public.auth_is_driver_session() then
    return new;
  end if;

  select * into v_state from public.driver_workflow_state(new.id);
  if v_state.status is null then
    new.status := old.status;
    new.operational_status := old.operational_status;
    return new;
  end if;

  new.status := v_state.status;
  new.operational_status := v_state.operational_status;
  if v_state.status = 'completed' and new.completed_at is null then
    new.completed_at := coalesce(v_state.stage_at, now());
  end if;
  return new;
end;
$$;

comment on function public.quotes_sync_driver_workflow_status() is
  'A driver quote update is replaced by the confirmed workflow. The phone cannot store a different status.';

drop view if exists public.booking_workflow_status_v;
create view public.booking_workflow_status_v
with (security_invoker = true)
as
select
  q.id as quote_id,
  w.status as workflow_status,
  w.stage_at as workflow_at,
  w.operational_status,
  w.stage as workflow_stage,
  w.assignment_status,
  q.assigned_driver_id as driver_id,
  null::uuid as job_assignment_id,
  null::double precision as latitude,
  null::double precision as longitude,
  w.workflow_version
from public.quotes q
cross join lateral public.driver_workflow_state(q.id) w;

comment on view public.booking_workflow_status_v is
  'Confirmed driver stage for the current attempt. status and the display label come from the same history.';

grant select on public.booking_workflow_status_v to authenticated;

create or replace function public.public_get_job_move_timeline(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_quote public.quotes%rowtype;
  v_version integer;
  v_workflow jsonb;
begin
  if p_token is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  select q.*
    into v_quote
  from public.job_tracking_tokens t
  join public.quotes q on q.id = t.quote_id
  where t.token = p_token
    and t.revoked_at is null
    and t.expires_at >= now()
  limit 1;

  if v_quote.id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  v_version := coalesce(v_quote.workflow_version, 1);
  select to_jsonb(w) into v_workflow
  from public.driver_workflow_state(v_quote.id) w;

  return jsonb_build_object(
    'ok', true,
    'workflow_version', v_version,
    'assigned_at', v_quote.assigned_at,
    'status', v_quote.status,
    'operational_status', v_quote.operational_status,
    'workflow', v_workflow,
    'completed_at', v_quote.completed_at,
    'cancelled_at', v_quote.cancelled_at,
    'assignment_status', (
      select a.status
      from public.job_assignments a
      where a.quote_id = v_quote.id
      order by a.updated_at desc nulls last
      limit 1
    ),
    'assignment_completed_at', (
      select a.completed_at
      from public.job_assignments a
      where a.quote_id = v_quote.id
      order by a.updated_at desc nulls last
      limit 1
    ),
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
      where h.quote_id = v_quote.id
        and coalesce(h.workflow_version, 1) = v_version
    ), '[]'::jsonb)
  );
end;
$$;

-- GPS and manual arrival both insert one history row. The projection writes
-- the quote and assignment. This function no longer updates them itself.
create or replace function public.record_driver_arrival(
  p_quote_id uuid,
  p_assignment_id uuid,
  p_stop_type text,
  p_occurred_at timestamptz,
  p_workflow_version integer,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision,
  p_source text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver uuid;
  v_quote public.quotes%rowtype;
  v_asg public.job_assignments%rowtype;
  v_status text;
  v_stop text;
  v_id uuid;
  v_occurred timestamptz;
begin
  if not public.auth_is_driver_session() then
    return jsonb_build_object('ok', false, 'reason', 'not_driver');
  end if;

  v_driver := public.auth_driver_id();
  if v_driver is null or p_quote_id is null or p_assignment_id is null then
    return jsonb_build_object('ok', false, 'reason', 'assignment_closed');
  end if;

  select * into v_quote from public.quotes where id = p_quote_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'assignment_closed');
  end if;

  if public.quote_row_is_completed(v_quote.status, v_quote.operational_status, v_quote.completed_at)
     or lower(trim(coalesce(v_quote.operational_status, ''))) = 'cancelled'
     or v_quote.cancelled_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'completed');
  end if;

  if v_quote.assigned_driver_id is distinct from v_driver then
    return jsonb_build_object('ok', false, 'reason', 'assignment_closed');
  end if;

  if p_workflow_version is distinct from coalesce(v_quote.workflow_version, 1) then
    return jsonb_build_object('ok', false, 'reason', 'stale_workflow_version');
  end if;

  select * into v_asg
  from public.job_assignments
  where id = p_assignment_id
    and quote_id = p_quote_id;

  if not found
     or v_asg.driver_id is distinct from v_driver
     or v_asg.completed_at is not null
     or lower(trim(coalesce(v_asg.status, ''))) in ('completed', 'cancelled', 'inactive', 'unassigned', 'removed') then
    return jsonb_build_object('ok', false, 'reason', 'assignment_closed');
  end if;

  if lower(trim(coalesce(p_stop_type, ''))) in ('delivery', 'dropoff') then
    v_status := 'arrived_delivery';
    v_stop := 'delivery';
    if not exists (
      select 1
      from public.job_status_history h
      where h.quote_id = p_quote_id
        and coalesce(h.workflow_version, 1) = coalesce(v_quote.workflow_version, 1)
        and h.corrects_event_id is null
        and lower(trim(coalesce(h.status, ''))) in ('in_transit', 'left_for_delivery', 'on_way_to_delivery')
    ) then
      return jsonb_build_object('ok', false, 'reason', 'not_started');
    end if;
  else
    v_status := 'arrived_pickup';
    v_stop := 'pickup';
    if not exists (
      select 1
      from public.job_status_history h
      where h.quote_id = p_quote_id
        and coalesce(h.workflow_version, 1) = coalesce(v_quote.workflow_version, 1)
        and h.corrects_event_id is null
        and lower(trim(coalesce(h.status, ''))) in (
          'on_way', 'started', 'start', 'in_progress', 'on_the_way', 'left_for_collection'
        )
    ) then
      return jsonb_build_object('ok', false, 'reason', 'not_started');
    end if;
  end if;

  v_occurred := coalesce(p_occurred_at, now());

  if exists (
    select 1
    from public.job_status_history h
    where h.quote_id = p_quote_id
      and coalesce(h.workflow_version, 1) = coalesce(v_quote.workflow_version, 1)
      and h.corrects_event_id is null
      and (
        (v_stop = 'pickup' and lower(trim(coalesce(h.status, ''))) in ('arrived', 'arrived_pickup', 'at_collection'))
        or (
          v_stop = 'delivery'
          and (
            lower(trim(coalesce(h.status, ''))) in ('arrived_delivery', 'at_delivery')
            or (
              lower(trim(coalesce(h.status, ''))) = 'arrived'
              and lower(trim(coalesce(h.stop_type, ''))) in ('delivery', 'dropoff')
            )
          )
        )
      )
  ) then
    perform public.project_driver_workflow(p_quote_id);
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  insert into public.job_status_history (
    job_assignment_id, quote_id, driver_id, status, occurred_at, source,
    stop_type, workflow_version, latitude, longitude, accuracy_m, notes, driver_name
  )
  values (
    p_assignment_id, p_quote_id, v_driver, v_status, v_occurred,
    case when lower(trim(coalesce(p_source, ''))) = 'manual' then 'manual' else 'gps' end,
    v_stop, coalesce(v_quote.workflow_version, 1), p_latitude, p_longitude, p_accuracy_m,
    nullif(trim(coalesce(p_notes, '')), ''),
    (select d.full_name from public.drivers d where d.id = v_driver)
  )
  returning id into v_id;

  if v_id is null then
    perform public.project_driver_workflow(p_quote_id);
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  return jsonb_build_object('ok', true, 'duplicate', false, 'id', v_id, 'occurred_at', v_occurred);
exception
  when others then
    return jsonb_build_object('ok', false, 'reason', sqlerrm);
end;
$$;

do $$
declare
  r record;
begin
  for r in
    select q.id
    from public.quotes q
    where q.completed_at is null
      and q.cancelled_at is null
      and lower(trim(coalesce(q.operational_status, ''))) is distinct from 'cancelled'
      and lower(trim(coalesce(q.status, ''))) not in ('completed', 'cancelled')
      and q.assigned_driver_id is not null
  loop
    perform public.project_driver_workflow(r.id);
  end loop;
end $$;
