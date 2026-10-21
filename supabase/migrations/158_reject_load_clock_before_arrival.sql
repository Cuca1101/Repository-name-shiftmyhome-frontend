-- The driver app used to insert loading_started when the first collection item
-- was ticked, even if Arrived had not been recorded. That row stays in history.
-- A new load-clock row is accepted only after Start and Arrived on this attempt.

create or replace function public.job_status_history_require_arrival_before_load_clock()
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

  s := lower(trim(coalesce(new.status, '')));
  if s not in ('loading', 'loading_started', 'unloading', 'unloading_started', 'unloading_completed') then
    return new;
  end if;

  select coalesce(q.workflow_version, 1) into v_version
  from public.quotes q
  where q.id = new.quote_id;
  v_version := coalesce(new.workflow_version, v_version, 1);

  if s in ('loading', 'loading_started') then
    if not exists (
      select 1
      from public.job_status_history h
      where h.quote_id = new.quote_id
        and coalesce(h.workflow_version, 1) = v_version
        and h.corrects_event_id is null
        and lower(trim(coalesce(h.status, ''))) in (
          'on_way', 'started', 'start', 'in_progress', 'on_the_way', 'left_for_collection'
        )
    ) or not exists (
      select 1
      from public.job_status_history h
      where h.quote_id = new.quote_id
        and coalesce(h.workflow_version, 1) = v_version
        and h.corrects_event_id is null
        and lower(trim(coalesce(h.status, ''))) in ('arrived', 'arrived_pickup', 'at_collection')
    ) then
      raise exception 'load_clock_before_arrival'
        using errcode = 'P0001';
    end if;
  elsif not exists (
    select 1
    from public.job_status_history h
    where h.quote_id = new.quote_id
      and coalesce(h.workflow_version, 1) = v_version
      and h.corrects_event_id is null
      and lower(trim(coalesce(h.status, ''))) in ('in_transit', 'left_for_delivery', 'on_way_to_delivery')
  ) or not exists (
    select 1
    from public.job_status_history h
    where h.quote_id = new.quote_id
      and coalesce(h.workflow_version, 1) = v_version
      and h.corrects_event_id is null
      and (
        lower(trim(coalesce(h.status, ''))) in ('arrived_delivery', 'at_delivery')
        or (
          lower(trim(coalesce(h.status, ''))) = 'arrived'
          and lower(trim(coalesce(h.stop_type, ''))) in ('delivery', 'dropoff')
        )
      )
  ) then
    raise exception 'load_clock_before_arrival'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists bbb_job_status_history_require_arrival_before_load_clock on public.job_status_history;
create trigger bbb_job_status_history_require_arrival_before_load_clock
  before insert on public.job_status_history
  for each row
  execute function public.job_status_history_require_arrival_before_load_clock();
