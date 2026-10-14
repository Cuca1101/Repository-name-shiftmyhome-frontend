-- Loading and Unloading are parallel clocks. They must not close the Arrived
-- stage, and drivers must be allowed to record unloading_started.

create or replace function public.stamp_previous_stage_duration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prev_id uuid;
  prev_at timestamptz;
  next_at timestamptz;
  skip_statuses text[] := array[
    'gps', 'location', 'available_location', 'active_job_location', 'correction',
    'customer_not_available', 'unable_to_contact',
    'loading_started', 'loading', 'unloading_started'
  ];
begin
  if new.corrects_event_id is not null then
    return new;
  end if;
  if lower(trim(coalesce(new.status, ''))) = any (skip_statuses) then
    return new;
  end if;

  next_at := coalesce(new.occurred_at, new.created_at, now());

  select h.id, coalesce(h.occurred_at, h.created_at)
    into prev_id, prev_at
  from public.job_status_history h
  where h.quote_id is not distinct from new.quote_id
    and h.id is distinct from new.id
    and h.corrects_event_id is null
    and lower(trim(coalesce(h.status, ''))) <> all (skip_statuses)
    and coalesce(h.occurred_at, h.created_at) <= next_at
  order by coalesce(h.occurred_at, h.created_at) desc
  limit 1;

  if prev_id is not null and prev_at is not null and prev_at <= next_at then
    update public.job_status_history
    set duration_seconds = greatest(0, floor(extract(epoch from (next_at - prev_at)))::int)
    where id = prev_id
      and duration_seconds is null;
  end if;

  return new;
end;
$$;

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
      'loading_started',
      'unloading_started',
      'unloading_completed',
      'in_transit',
      'completed',
      'cancelled',
      'gps',
      'location',
      'started',
      'start',
      'available_location',
      'active_job_location',
      'customer_not_available',
      'unable_to_contact'
    )
  );

-- The status check rejects inserts before the policy runs. loading_started and
-- unloading_started must be allowed or the first item tick never reaches history.
alter table public.job_status_history
  drop constraint if exists job_status_history_status_check;

alter table public.job_status_history
  add constraint job_status_history_status_check
  check (status = any (array[
    'on_way',
    'in_progress',
    'arrived',
    'arrived_pickup',
    'arrived_delivery',
    'pickup_completed',
    'loaded',
    'loading',
    'loading_started',
    'unloading_started',
    'unloading_completed',
    'in_transit',
    'completed',
    'cancelled',
    'assigned',
    'available_location',
    'active_job_location',
    'gps',
    'location',
    'started',
    'start',
    'customer_not_available',
    'unable_to_contact',
    'correction'
  ]));
