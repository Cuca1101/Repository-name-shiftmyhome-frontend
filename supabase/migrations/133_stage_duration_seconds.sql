-- Save how long each driver stage lasted, from the button press until the next stage.

alter table public.job_status_history
  add column if not exists duration_seconds integer;

comment on column public.job_status_history.duration_seconds is
  'Seconds from this stage button until the next stage button. Null while the stage is still open.';

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
    'customer_not_available', 'unable_to_contact'
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

drop trigger if exists trg_stamp_previous_stage_duration on public.job_status_history;
create trigger trg_stamp_previous_stage_duration
  before insert on public.job_status_history
  for each row
  execute function public.stamp_previous_stage_duration();

with ordered as (
  select
    id,
    coalesce(occurred_at, created_at) as at,
    lead(coalesce(occurred_at, created_at)) over (
      partition by quote_id
      order by coalesce(occurred_at, created_at), created_at
    ) as next_at
  from public.job_status_history
  where corrects_event_id is null
    and lower(trim(coalesce(status, ''))) not in (
      'gps', 'location', 'available_location', 'active_job_location', 'correction',
      'customer_not_available', 'unable_to_contact'
    )
)
update public.job_status_history h
set duration_seconds = greatest(0, floor(extract(epoch from (ordered.next_at - ordered.at)))::int)
from ordered
where h.id = ordered.id
  and ordered.next_at is not null
  and h.duration_seconds is null;
