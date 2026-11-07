-- Drop-off Start is a history row (in_transit / left for delivery).
-- It counts only after pickup is complete on this attempt. A driver insert
-- before that is rejected. An earlier row already stored does not open delivery.

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
       and v_collected is not null
       and at_time >= v_collected
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

create or replace function public.job_status_history_require_pickup_before_dropoff()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s text;
  stop text;
  v_stage text;
begin
  if new.quote_id is null or new.corrects_event_id is not null then
    return new;
  end if;

  if public.auth_is_admin_session() or not public.auth_is_driver_session() then
    return new;
  end if;

  s := lower(trim(coalesce(new.status, '')));
  stop := lower(trim(coalesce(new.stop_type, '')));
  if s not in ('in_transit', 'left_for_delivery', 'on_way_to_delivery')
     and not (
       stop in ('delivery', 'dropoff')
       and s in ('on_way', 'started', 'start', 'in_progress', 'on_the_way', 'left_for_collection')
     ) then
    return new;
  end if;

  select w.stage into v_stage
  from public.driver_workflow_state(new.quote_id) w
  limit 1;

  if coalesce(v_stage, '') not in (
    'collection_complete',
    'left_for_delivery',
    'arrived_delivery',
    'unloading',
    'completed'
  ) then
    raise exception 'dropoff_before_pickup_complete'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists ccc_job_status_history_require_pickup_before_dropoff on public.job_status_history;
create trigger ccc_job_status_history_require_pickup_before_dropoff
  before insert on public.job_status_history
  for each row
  execute function public.job_status_history_require_pickup_before_dropoff();

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

  if not public.auth_is_admin_session()
     and lower(trim(coalesce(new.status, ''))) in (
       'in_transit', 'left_for_delivery', 'on_way_to_delivery'
     )
     and coalesce(v_state.stage, '') not in (
       'collection_complete',
       'left_for_delivery',
       'arrived_delivery',
       'unloading',
       'completed'
     ) then
    raise exception 'dropoff_before_pickup_complete'
      using errcode = 'P0001';
  end if;

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
  'A driver quote update is replaced by the confirmed workflow. Drop-off Start is rejected until pickup is complete.';

-- Delivery arrival follows a Start that itself follows a completed pickup.
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
  v_stage text;
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

  select w.stage into v_stage
  from public.driver_workflow_state(p_quote_id) w
  limit 1;

  if lower(trim(coalesce(p_stop_type, ''))) in ('delivery', 'dropoff') then
    v_status := 'arrived_delivery';
    v_stop := 'delivery';
    if v_stage is distinct from 'left_for_delivery'
       and coalesce(v_stage, '') not in ('arrived_delivery', 'unloading', 'completed') then
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

create or replace function public.consider_gps_stop_arrival()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes%rowtype;
  v_asg public.job_assignments%rowtype;
  v_sampled timestamptz;
  v_accuracy double precision;
  v_speed double precision;
  v_stop text;
  v_status text;
  v_dest_lat double precision;
  v_dest_lng double precision;
  v_distance double precision;
  v_stage text;
begin
  if new.quote_id is null or new.driver_id is null then
    return new;
  end if;
  if new.latitude is null or new.longitude is null then
    return new;
  end if;

  v_sampled := coalesce(new.sampled_at, new.updated_at);
  if v_sampled is null
     or v_sampled < now() - interval '90 seconds'
     or v_sampled > now() + interval '2 minutes' then
    return new;
  end if;

  v_accuracy := new.accuracy;
  if v_accuracy is null or v_accuracy < 0 or v_accuracy > 60 then
    return new;
  end if;
  v_speed := new.speed;
  if v_speed is not null and v_speed > 3 then
    return new;
  end if;

  select * into v_quote from public.quotes where id = new.quote_id;
  if not found
     or v_quote.assigned_driver_id is distinct from new.driver_id
     or v_quote.cancelled_at is not null
     or public.quote_row_is_completed(v_quote.status, v_quote.operational_status, v_quote.completed_at) then
    return new;
  end if;

  select * into v_asg
  from public.job_assignments
  where quote_id = new.quote_id
    and driver_id = new.driver_id
    and completed_at is null
    and lower(trim(coalesce(status, ''))) not in ('completed', 'cancelled', 'inactive', 'unassigned', 'removed')
  order by updated_at desc nulls last
  limit 1;
  if not found then
    return new;
  end if;

  select w.stage into v_stage
  from public.driver_workflow_state(new.quote_id) w
  limit 1;

  -- Delivery is active only after pickup is complete and drop-off Start is saved.
  -- Otherwise collection is active after its Start. A stop that already has an arrival is left alone.
  if v_stage = 'left_for_delivery'
     and not exists (
       select 1
       from public.job_status_history h
       where h.quote_id = new.quote_id
         and coalesce(h.workflow_version, 1) = coalesce(v_quote.workflow_version, 1)
         and h.corrects_event_id is null
         and (
           lower(trim(coalesce(h.status, ''))) in ('arrived_delivery', 'at_delivery')
           or (
             lower(trim(coalesce(h.status, ''))) = 'arrived'
             and lower(trim(coalesce(h.stop_type, ''))) in ('delivery', 'dropoff')
           )
         )
     ) then
    v_stop := 'delivery';
    v_status := 'arrived_delivery';
    v_dest_lat := v_quote.delivery_lat;
    v_dest_lng := v_quote.delivery_lng;
  elsif v_stage = 'left_for_collection' then
    v_stop := 'pickup';
    v_status := 'arrived_pickup';
    v_dest_lat := v_quote.pickup_lat;
    v_dest_lng := v_quote.pickup_lng;
  else
    return new;
  end if;

  if v_dest_lat is null or v_dest_lng is null then
    return new;
  end if;

  v_distance := public.metres_between(new.latitude, new.longitude, v_dest_lat, v_dest_lng);
  if v_distance is null or v_distance > 100 then
    return new;
  end if;

  insert into public.job_status_history (
    job_assignment_id,
    quote_id,
    driver_id,
    status,
    occurred_at,
    source,
    stop_type,
    workflow_version,
    latitude,
    longitude,
    accuracy_m,
    notes,
    driver_name
  )
  values (
    coalesce(new.assignment_id, v_asg.id),
    new.quote_id,
    new.driver_id,
    v_status,
    v_sampled,
    'gps',
    v_stop,
    coalesce(v_quote.workflow_version, 1),
    new.latitude,
    new.longitude,
    v_accuracy,
    'arrival_audit gps_confirmed=true reason=gps_fix stop=' || v_stop || ' distance_m=' || round(v_distance::numeric, 1),
    (select d.full_name from public.drivers d where d.id = new.driver_id)
  );

  return new;
exception
  when others then
    return new;
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
