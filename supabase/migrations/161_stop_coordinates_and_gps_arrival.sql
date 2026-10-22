-- Saved collection and delivery coordinates are the point used by the map
-- and by automatic arrival. A fresh GPS fix within 100 metres of the active
-- stop records the same arrival as a manual press. It does not start loading
-- or complete the stop. An arrival that is already saved is left unchanged.

alter table public.quotes
  add column if not exists pickup_lat double precision,
  add column if not exists pickup_lng double precision,
  add column if not exists delivery_lat double precision,
  add column if not exists delivery_lng double precision;

comment on column public.quotes.pickup_lat is
  'Saved collection latitude. Shared by the dispatch map and 100 m arrival.';
comment on column public.quotes.pickup_lng is
  'Saved collection longitude. Shared by the dispatch map and 100 m arrival.';
comment on column public.quotes.delivery_lat is
  'Saved delivery latitude. Shared by the dispatch map and 100 m arrival.';
comment on column public.quotes.delivery_lng is
  'Saved delivery longitude. Shared by the dispatch map and 100 m arrival.';

create or replace function public.metres_between(
  p_lat1 double precision,
  p_lng1 double precision,
  p_lat2 double precision,
  p_lng2 double precision
)
returns double precision
language sql
immutable
as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(p_lat2 - p_lat1) / 2), 2)
    + cos(radians(p_lat1)) * cos(radians(p_lat2)) * power(sin(radians(p_lng2 - p_lng1) / 2), 2)
  ));
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

  -- Delivery is active only after its Start. Otherwise collection is active
  -- after its Start. A stop that already has an arrival is left alone.
  if exists (
    select 1
    from public.job_status_history h
    where h.quote_id = new.quote_id
      and coalesce(h.workflow_version, 1) = coalesce(v_quote.workflow_version, 1)
      and h.corrects_event_id is null
      and lower(trim(coalesce(h.status, ''))) in ('in_transit', 'left_for_delivery', 'on_way_to_delivery')
  ) and not exists (
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
  elsif exists (
    select 1
    from public.job_status_history h
    where h.quote_id = new.quote_id
      and coalesce(h.workflow_version, 1) = coalesce(v_quote.workflow_version, 1)
      and h.corrects_event_id is null
      and lower(trim(coalesce(h.status, ''))) in (
        'on_way', 'started', 'start', 'in_progress', 'on_the_way', 'left_for_collection'
      )
  ) and not exists (
    select 1
    from public.job_status_history h
    where h.quote_id = new.quote_id
      and coalesce(h.workflow_version, 1) = coalesce(v_quote.workflow_version, 1)
      and h.corrects_event_id is null
      and lower(trim(coalesce(h.status, ''))) in ('arrived', 'arrived_pickup', 'at_collection')
  ) then
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

drop trigger if exists trg_driver_locations_gps_arrival on public.driver_locations;
create trigger trg_driver_locations_gps_arrival
  after insert or update of latitude, longitude, sampled_at, accuracy, speed
  on public.driver_locations
  for each row
  execute function public.consider_gps_stop_arrival();

comment on function public.consider_gps_stop_arrival() is
  'After Start, one fresh accurate GPS fix within 100 m of the saved active stop records arrival. Loading and completion stay separate.';
