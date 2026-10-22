-- A saved Arrived row is the stage whether the driver pressed Arrived or GPS
-- recorded it. Loading clocks stay out of the customer stage. Arrival still
-- requires Start on the same attempt, at or before the arrival time.
-- History rows are not rewritten. Open bookings whose quote status was left
-- behind that saved arrival are brought forward.

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
      'correction', 'customer_not_available', 'unable_to_contact',
      'loading', 'loading_started',
      'unloading', 'unloading_started', 'unloading_completed'
    )
    and not (
      (
        lower(trim(coalesce(h.status, ''))) in ('arrived_pickup', 'at_collection')
        or (
          lower(trim(coalesce(h.status, ''))) = 'arrived'
          and lower(trim(coalesce(h.stop_type, ''))) not in ('delivery', 'dropoff')
        )
      )
      and not exists (
        select 1
        from public.job_status_history start_row
        where start_row.quote_id = h.quote_id
          and coalesce(start_row.workflow_version, 1) = coalesce(h.workflow_version, 1)
          and start_row.corrects_event_id is null
          and lower(trim(coalesce(start_row.status, ''))) in (
            'on_way', 'started', 'start', 'in_progress', 'on_the_way', 'left_for_collection'
          )
          and coalesce(start_row.occurred_at, start_row.created_at)
            <= coalesce(h.occurred_at, h.created_at)
      )
    )
    and not (
      (
        lower(trim(coalesce(h.status, ''))) in ('arrived_delivery', 'at_delivery')
        or (
          lower(trim(coalesce(h.status, ''))) = 'arrived'
          and lower(trim(coalesce(h.stop_type, ''))) in ('delivery', 'dropoff')
        )
      )
      and not exists (
        select 1
        from public.job_status_history start_row
        where start_row.quote_id = h.quote_id
          and coalesce(start_row.workflow_version, 1) = coalesce(h.workflow_version, 1)
          and start_row.corrects_event_id is null
          and lower(trim(coalesce(start_row.status, ''))) in (
            'in_transit', 'left_for_delivery', 'on_way_to_delivery'
          )
          and coalesce(start_row.occurred_at, start_row.created_at)
            <= coalesce(h.occurred_at, h.created_at)
      )
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
    'correction', 'customer_not_available', 'unable_to_contact',
    'loading', 'loading_started',
    'unloading', 'unloading_started', 'unloading_completed'
  )
  and not (
    (
      lower(trim(coalesce(h.status, ''))) in ('arrived_pickup', 'at_collection')
      or (
        lower(trim(coalesce(h.status, ''))) = 'arrived'
        and lower(trim(coalesce(h.stop_type, ''))) not in ('delivery', 'dropoff')
      )
    )
    and not exists (
      select 1
      from public.job_status_history start_row
      where start_row.quote_id = h.quote_id
        and coalesce(start_row.workflow_version, 1) = coalesce(h.workflow_version, 1)
        and start_row.corrects_event_id is null
        and lower(trim(coalesce(start_row.status, ''))) in (
          'on_way', 'started', 'start', 'in_progress', 'on_the_way', 'left_for_collection'
        )
        and coalesce(start_row.occurred_at, start_row.created_at)
          <= coalesce(h.occurred_at, h.created_at)
    )
  )
  and not (
    (
      lower(trim(coalesce(h.status, ''))) in ('arrived_delivery', 'at_delivery')
      or (
        lower(trim(coalesce(h.status, ''))) = 'arrived'
        and lower(trim(coalesce(h.stop_type, ''))) in ('delivery', 'dropoff')
      )
    )
    and not exists (
      select 1
      from public.job_status_history start_row
      where start_row.quote_id = h.quote_id
        and coalesce(start_row.workflow_version, 1) = coalesce(h.workflow_version, 1)
        and start_row.corrects_event_id is null
        and lower(trim(coalesce(start_row.status, ''))) in (
          'in_transit', 'left_for_delivery', 'on_way_to_delivery'
        )
        and coalesce(start_row.occurred_at, start_row.created_at)
          <= coalesce(h.occurred_at, h.created_at)
    )
  )
order by h.quote_id, coalesce(h.occurred_at, h.created_at) desc;

comment on view public.booking_workflow_status_v is
  'Latest move stage on the current driver attempt. Manual and GPS arrivals count after Start. Load clocks do not.';

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
  delivery_stop boolean;
  v_label text;
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
  delivery_stop := lower(trim(coalesce(new.stop_type, ''))) in ('delivery', 'dropoff');
  if s = 'arrived' then
    if delivery_stop then
      s := 'arrived_delivery';
    else
      s := 'arrived_pickup';
    end if;
  end if;

  if s in ('loading', 'loading_started', 'unloading', 'unloading_started', 'unloading_completed') then
    return new;
  end if;

  if s in ('arrived_pickup', 'arrived_delivery') then
    if s = 'arrived_delivery' then
      if not exists (
        select 1
        from public.job_status_history h
        where h.quote_id = new.quote_id
          and h.id is distinct from new.id
          and coalesce(h.workflow_version, 1) = coalesce(v_version, 1)
          and h.corrects_event_id is null
          and lower(trim(coalesce(h.status, ''))) in ('in_transit', 'left_for_delivery', 'on_way_to_delivery')
          and coalesce(h.occurred_at, h.created_at) <= coalesce(new.occurred_at, new.created_at, now())
      ) then
        return new;
      end if;
    elsif not exists (
      select 1
      from public.job_status_history h
      where h.quote_id = new.quote_id
        and h.id is distinct from new.id
        and coalesce(h.workflow_version, 1) = coalesce(v_version, 1)
        and h.corrects_event_id is null
        and lower(trim(coalesce(h.status, ''))) in (
          'on_way', 'started', 'start', 'in_progress', 'on_the_way', 'left_for_collection'
        )
        and coalesce(h.occurred_at, h.created_at) <= coalesce(new.occurred_at, new.created_at, now())
    ) then
      return new;
    end if;
  end if;

  if s not in (
    'on_way', 'started', 'start',
    'arrived_pickup',
    'pickup_completed', 'loaded',
    'in_transit',
    'arrived_delivery',
    'completed'
  ) then
    return new;
  end if;

  v_label := case s
    when 'on_way' then 'Left for collection'
    when 'started' then 'Left for collection'
    when 'start' then 'Left for collection'
    when 'arrived_pickup' then 'At collection'
    when 'pickup_completed' then 'Collection finished'
    when 'loaded' then 'Collection finished'
    when 'in_transit' then 'Left for delivery'
    when 'arrived_delivery' then 'At delivery'
    when 'completed' then 'Completed'
    else null
  end;

  update public.quotes q
  set
    status = s,
    operational_status = coalesce(v_label, q.operational_status)
  where q.id = new.quote_id
    and not public.quote_row_is_completed(q.status, q.operational_status, q.completed_at)
    and coalesce(q.workflow_version, 1) = coalesce(new.workflow_version, 1)
    and (
      lower(trim(coalesce(q.status, ''))) is distinct from s
      or (v_label is not null and q.operational_status is distinct from v_label)
    );

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
  s text;
begin
  if public.quote_row_is_completed(old.status, old.operational_status, old.completed_at)
     and not public.auth_is_admin_session() then
    return new;
  end if;

  if not public.auth_is_driver_session() then
    return new;
  end if;

  s := lower(trim(coalesce(new.status, '')));

  if s in ('loading', 'loading_started', 'unloading', 'unloading_started', 'unloading_completed') then
    new.status := old.status;
    new.operational_status := old.operational_status;
    return new;
  end if;

  if s in ('arrived', 'arrived_pickup', 'at_collection')
     and not exists (
       select 1
       from public.job_status_history h
       where h.quote_id = new.id
         and coalesce(h.workflow_version, 1) = coalesce(old.workflow_version, 1)
         and h.corrects_event_id is null
         and lower(trim(coalesce(h.status, ''))) in ('arrived', 'arrived_pickup', 'at_collection')
         and exists (
           select 1
           from public.job_status_history start_row
           where start_row.quote_id = new.id
             and coalesce(start_row.workflow_version, 1) = coalesce(old.workflow_version, 1)
             and start_row.corrects_event_id is null
             and lower(trim(coalesce(start_row.status, ''))) in (
               'on_way', 'started', 'start', 'in_progress', 'on_the_way', 'left_for_collection'
             )
             and coalesce(start_row.occurred_at, start_row.created_at)
               <= coalesce(h.occurred_at, h.created_at)
         )
     ) then
    new.status := old.status;
    new.operational_status := old.operational_status;
    return new;
  end if;

  if s in ('arrived_delivery', 'at_delivery')
     and not exists (
       select 1
       from public.job_status_history h
       where h.quote_id = new.id
         and coalesce(h.workflow_version, 1) = coalesce(old.workflow_version, 1)
         and h.corrects_event_id is null
         and (
           lower(trim(coalesce(h.status, ''))) in ('arrived_delivery', 'at_delivery')
           or (
             lower(trim(coalesce(h.status, ''))) = 'arrived'
             and lower(trim(coalesce(h.stop_type, ''))) in ('delivery', 'dropoff')
           )
         )
         and exists (
           select 1
           from public.job_status_history start_row
           where start_row.quote_id = new.id
             and coalesce(start_row.workflow_version, 1) = coalesce(old.workflow_version, 1)
             and start_row.corrects_event_id is null
             and lower(trim(coalesce(start_row.status, ''))) in ('in_transit', 'left_for_delivery', 'on_way_to_delivery')
             and coalesce(start_row.occurred_at, start_row.created_at)
               <= coalesce(h.occurred_at, h.created_at)
         )
     ) then
    new.status := old.status;
    new.operational_status := old.operational_status;
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  new.operational_status := case s
    when 'on_way' then 'Left for collection'
    when 'started' then 'Left for collection'
    when 'start' then 'Left for collection'
    when 'in_progress' then 'Left for collection'
    when 'arrived' then 'At collection'
    when 'arrived_pickup' then 'At collection'
    when 'at_collection' then 'At collection'
    when 'pickup_completed' then 'Collection finished'
    when 'loaded' then 'Collection finished'
    when 'in_transit' then 'Left for delivery'
    when 'arrived_delivery' then 'At delivery'
    when 'at_delivery' then 'At delivery'
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

-- One arrival per stop per attempt. A repeated GPS fix or a manual press
-- after GPS does not add another journey row. Returning null cancels the
-- insert after the attempt check has already accepted the driver.
create or replace function public.job_status_history_skip_duplicate_arrival()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bucket text;
begin
  if new.corrects_event_id is not null or new.quote_id is null then
    return new;
  end if;

  bucket := case
    when lower(trim(coalesce(new.status, ''))) in ('arrived_delivery', 'at_delivery') then 'delivery'
    when lower(trim(coalesce(new.status, ''))) = 'arrived'
      and lower(trim(coalesce(new.stop_type, ''))) in ('delivery', 'dropoff') then 'delivery'
    when lower(trim(coalesce(new.status, ''))) in ('arrived', 'arrived_pickup', 'at_collection') then 'pickup'
    else null
  end;

  if bucket is null then
    return new;
  end if;

  if exists (
    select 1
    from public.job_status_history h
    where h.quote_id = new.quote_id
      and coalesce(h.workflow_version, 1) = coalesce(new.workflow_version, 1)
      and h.corrects_event_id is null
      and (
        (bucket = 'pickup' and lower(trim(coalesce(h.status, ''))) in ('arrived', 'arrived_pickup', 'at_collection'))
        or (
          bucket = 'delivery'
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
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists zzz_job_status_history_skip_duplicate_arrival on public.job_status_history;
create trigger zzz_job_status_history_skip_duplicate_arrival
  before insert on public.job_status_history
  for each row
  execute function public.job_status_history_skip_duplicate_arrival();

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
    return jsonb_build_object('ok', true, 'duplicate', true);
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
    p_assignment_id,
    p_quote_id,
    v_driver,
    v_status,
    v_occurred,
    case when lower(trim(coalesce(p_source, ''))) = 'manual' then 'manual' else 'gps' end,
    v_stop,
    coalesce(v_quote.workflow_version, 1),
    p_latitude,
    p_longitude,
    p_accuracy_m,
    nullif(trim(coalesce(p_notes, '')), ''),
    (select d.full_name from public.drivers d where d.id = v_driver)
  )
  returning id into v_id;

  if v_id is null then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  update public.job_assignments
  set
    status = 'arrived',
    updated_at = now(),
    claimed_workflow_version = coalesce(v_quote.workflow_version, 1)
  where id = p_assignment_id
    and driver_id = v_driver
    and completed_at is null
    and lower(trim(coalesce(status, ''))) not in ('completed', 'cancelled', 'inactive', 'unassigned', 'removed');

  return jsonb_build_object('ok', true, 'duplicate', false, 'id', v_id, 'occurred_at', v_occurred);
exception
  when others then
    return jsonb_build_object('ok', false, 'reason', sqlerrm);
end;
$$;

revoke all on function public.record_driver_arrival(uuid, uuid, text, timestamptz, integer, double precision, double precision, double precision, text, text) from public;
grant execute on function public.record_driver_arrival(uuid, uuid, text, timestamptz, integer, double precision, double precision, double precision, text, text) to authenticated;

update public.quotes q
set
  status = stage.s,
  operational_status = case lower(trim(stage.s))
    when 'on_way' then 'Left for collection'
    when 'started' then 'Left for collection'
    when 'start' then 'Left for collection'
    when 'in_progress' then 'Left for collection'
    when 'arrived_pickup' then 'At collection'
    when 'arrived' then 'At collection'
    when 'at_collection' then 'At collection'
    when 'pickup_completed' then 'Collection finished'
    when 'loaded' then 'Collection finished'
    when 'in_transit' then 'Left for delivery'
    when 'arrived_delivery' then 'At delivery'
    when 'at_delivery' then 'At delivery'
    when 'completed' then 'Completed'
    else q.operational_status
  end
from (
  select q2.id, public.latest_driver_stage_status(q2.id) as s
  from public.quotes q2
  where q2.completed_at is null
    and q2.cancelled_at is null
    and lower(trim(coalesce(q2.operational_status, ''))) is distinct from 'cancelled'
    and lower(trim(coalesce(q2.status, ''))) not in ('completed', 'cancelled')
) stage
where q.id = stage.id
  and stage.s is not null
  and btrim(stage.s) <> ''
  and lower(trim(coalesce(q.status, ''))) is distinct from lower(trim(stage.s))
  and not public.quote_row_is_completed(q.status, q.operational_status, q.completed_at);
