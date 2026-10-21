-- Loading and unloading stay in job_status_history. They are not the customer
-- stage. A GPS arrival counts only after that journey leg has started.
-- Open bookings stuck on Loading are put back on the latest real stage.

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
      lower(trim(coalesce(h.status, ''))) in ('arrived', 'arrived_pickup', 'arrived_delivery', 'at_collection', 'at_delivery')
      and lower(trim(coalesce(h.source, ''))) is distinct from 'gps'
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
    lower(trim(coalesce(h.status, ''))) in ('arrived', 'arrived_pickup', 'arrived_delivery', 'at_collection', 'at_delivery')
    and lower(trim(coalesce(h.source, ''))) is distinct from 'gps'
  )
order by h.quote_id, coalesce(h.occurred_at, h.created_at) desc;

comment on view public.booking_workflow_status_v is
  'Latest move stage on the current driver attempt. Load clocks and non-GPS arrivals are not the stage.';

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
    if lower(trim(coalesce(new.source, ''))) is distinct from 'gps' then
      return new;
    end if;
    if s = 'arrived_delivery' then
      if not exists (
        select 1
        from public.job_status_history h
        where h.quote_id = new.quote_id
          and h.id is distinct from new.id
          and coalesce(h.workflow_version, 1) = coalesce(v_version, 1)
          and h.corrects_event_id is null
          and lower(trim(coalesce(h.status, ''))) in ('in_transit', 'left_for_delivery', 'on_way_to_delivery')
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

  update public.quotes q
  set status = s
  where q.id = new.quote_id
    and not public.quote_row_is_completed(q.status, q.operational_status, q.completed_at)
    and coalesce(q.workflow_version, 1) = coalesce(new.workflow_version, 1)
    and lower(trim(coalesce(q.status, ''))) is distinct from s;

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
         and lower(trim(coalesce(h.source, ''))) = 'gps'
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
         and lower(trim(coalesce(h.source, ''))) = 'gps'
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
    when 'pickup_completed' then 'Collection finished'
    when 'loaded' then 'Collection finished'
    when 'in_transit' then 'Left for delivery'
    when 'arrived_delivery' then 'At delivery'
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

  return jsonb_build_object(
    'ok', true,
    'workflow_version', v_version,
    'assigned_at', v_quote.assigned_at,
    'status', v_quote.status,
    'operational_status', v_quote.operational_status,
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

revoke all on function public.public_get_job_move_timeline(uuid) from public;
grant execute on function public.public_get_job_move_timeline(uuid) to anon, authenticated, service_role;

update public.quotes q
set
  status = coalesce(
    nullif(public.latest_driver_stage_status(q.id), ''),
    case when q.assigned_driver_id is not null then 'assigned' else 'Booked' end
  ),
  operational_status = case lower(trim(coalesce(public.latest_driver_stage_status(q.id), '')))
    when 'on_way' then 'Left for collection'
    when 'started' then 'Left for collection'
    when 'start' then 'Left for collection'
    when 'in_progress' then 'Left for collection'
    when 'arrived_pickup' then 'At collection'
    when 'arrived' then 'At collection'
    when 'pickup_completed' then 'Collection finished'
    when 'loaded' then 'Collection finished'
    when 'in_transit' then 'Left for delivery'
    when 'arrived_delivery' then 'At delivery'
    when 'completed' then 'Completed'
    else case
      when q.assigned_driver_id is not null then 'Assigned'
      else q.operational_status
    end
  end
where lower(trim(coalesce(q.status, ''))) in (
  'loading', 'loading_started', 'unloading', 'unloading_started', 'unloading_completed'
)
  and q.completed_at is null
  and lower(trim(coalesce(q.operational_status, ''))) is distinct from 'cancelled';
