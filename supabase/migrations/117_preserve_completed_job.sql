-- A completed booking must not be reopened by a stale writer.
-- Driver stop sync, a retried request, and service-role payment webhooks can
-- update quotes.status / job_assignments hours later. Admin reopen (reassign,
-- return to marketplace) still works because those sessions are admin.

begin;

create or replace function public.quote_row_is_completed(p_status text, p_operational text, p_completed_at timestamptz)
returns boolean
language sql
immutable
as $$
  select
    lower(trim(coalesce(p_status, ''))) = 'completed'
    or lower(trim(coalesce(p_operational, ''))) = 'completed'
    or p_completed_at is not null;
$$;

create or replace function public.quotes_preserve_completed_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.auth_is_admin_session() then
    return new;
  end if;

  if not public.quote_row_is_completed(old.status, old.operational_status, old.completed_at) then
    return new;
  end if;

  -- Keep every completion signal a non-admin write tried to clear.
  if lower(trim(coalesce(old.status, ''))) = 'completed'
     and lower(trim(coalesce(new.status, ''))) is distinct from 'completed' then
    new.status := old.status;
  end if;

  if lower(trim(coalesce(old.operational_status, ''))) = 'completed'
     and lower(trim(coalesce(new.operational_status, ''))) is distinct from 'completed' then
    new.operational_status := old.operational_status;
  elsif old.completed_at is not null
     and lower(trim(coalesce(new.operational_status, ''))) is distinct from 'completed'
     and lower(trim(coalesce(old.operational_status, ''))) is distinct from 'completed' then
    new.operational_status := 'Completed';
  end if;

  if old.completed_at is not null and new.completed_at is null then
    new.completed_at := old.completed_at;
  end if;

  return new;
end;
$$;

drop trigger if exists zzz_quotes_preserve_completed_booking on public.quotes;
create trigger zzz_quotes_preserve_completed_booking
  before update on public.quotes
  for each row
  execute function public.quotes_preserve_completed_booking();

comment on function public.quotes_preserve_completed_booking() is
  'Non-admin updates cannot move a completed quote back to an active status or clear completed_at.';

-- Driver workflow mirror runs on status change. It must not replace Completed
-- with On way when a late stop update arrives.
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
    when 'on_way' then 'On way'
    when 'arrived' then 'Arrived'
    when 'pickup_completed' then 'In transit'
    when 'in_transit' then 'In transit'
    when 'in_progress' then 'In progress'
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

create or replace function public.job_assignments_preserve_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.auth_is_admin_session() then
    return new;
  end if;

  if lower(trim(coalesce(old.status, ''))) is distinct from 'completed'
     and old.completed_at is null then
    return new;
  end if;

  if lower(trim(coalesce(new.status, ''))) is distinct from 'completed' then
    new.status := case
      when lower(trim(coalesce(old.status, ''))) = 'completed' then old.status
      else 'completed'
    end;
  end if;

  if old.completed_at is not null and new.completed_at is null then
    new.completed_at := old.completed_at;
  end if;

  return new;
end;
$$;

drop trigger if exists zzz_job_assignments_preserve_completed on public.job_assignments;
create trigger zzz_job_assignments_preserve_completed
  before update on public.job_assignments
  for each row
  execute function public.job_assignments_preserve_completed();

comment on function public.job_assignments_preserve_completed() is
  'Non-admin updates cannot reactivate a completed job_assignments row.';

commit;
