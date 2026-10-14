-- One stage name everywhere. The live stage is the latest driver history
-- row, not a GPS ping. Loading and Unloading stay separate from Arrived.

create or replace function public.latest_driver_stage_status(p_quote_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select h.status
  from public.job_status_history h
  where h.quote_id = p_quote_id
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
  h.longitude
from public.job_status_history h
where h.quote_id is not null
  and h.corrects_event_id is null
  and lower(trim(coalesce(h.status, ''))) not in (
    'gps', 'location', 'available_location', 'active_job_location',
    'correction', 'customer_not_available', 'unable_to_contact'
  )
order by h.quote_id, coalesce(h.occurred_at, h.created_at) desc;

comment on view public.booking_workflow_status_v is
  'Latest move stage per quote. GPS and contact notes are not stages.';

grant select on public.booking_workflow_status_v to authenticated;

revoke all on function public.latest_driver_stage_status(uuid) from public;
grant execute on function public.latest_driver_stage_status(uuid) to authenticated, service_role;

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

  if new.status is not distinct from old.status then
    return new;
  end if;

  s := lower(trim(coalesce(new.status, '')));

  new.operational_status := case s
    when 'on_way' then 'Left for collection'
    when 'started' then 'Left for collection'
    when 'start' then 'Left for collection'
    when 'in_progress' then 'Left for collection'
    when 'arrived' then 'At collection'
    when 'arrived_pickup' then 'At collection'
    when 'loading' then 'Loading'
    when 'loading_started' then 'Loading'
    when 'pickup_completed' then 'Collection finished'
    when 'loaded' then 'Collection finished'
    when 'in_transit' then 'Left for delivery'
    when 'arrived_delivery' then 'At delivery'
    when 'unloading' then 'Unloading'
    when 'unloading_started' then 'Unloading'
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

-- Keep the booking status on the same stage the driver just recorded.
create or replace function public.quotes_apply_driver_stage_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s text;
begin
  if new.quote_id is null or new.corrects_event_id is not null then
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
    and lower(trim(coalesce(q.status, ''))) is distinct from s;

  return new;
end;
$$;

drop trigger if exists trg_quotes_apply_driver_stage_status on public.job_status_history;
create trigger trg_quotes_apply_driver_stage_status
  after insert on public.job_status_history
  for each row
  execute function public.quotes_apply_driver_stage_status();

-- Open jobs follow the latest recorded stage, including ones already in history.
update public.quotes q
set
  status = stage.stage_status,
  operational_status = case lower(trim(stage.stage_status))
    when 'on_way' then 'Left for collection'
    when 'started' then 'Left for collection'
    when 'start' then 'Left for collection'
    when 'arrived' then 'At collection'
    when 'arrived_pickup' then 'At collection'
    when 'loading' then 'Loading'
    when 'loading_started' then 'Loading'
    when 'pickup_completed' then 'Collection finished'
    when 'loaded' then 'Collection finished'
    when 'in_transit' then 'Left for delivery'
    when 'arrived_delivery' then 'At delivery'
    when 'unloading' then 'Unloading'
    when 'unloading_started' then 'Unloading'
    when 'completed' then 'Completed'
    else q.operational_status
  end
from (
  select id, public.latest_driver_stage_status(id) as stage_status
  from public.quotes
) stage
where q.id = stage.id
  and stage.stage_status is not null
  and not public.quote_row_is_completed(q.status, q.operational_status, q.completed_at);
