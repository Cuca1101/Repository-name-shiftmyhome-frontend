-- When admin clears assigned_driver_id on quotes, auto-cancel job_assignments
-- so the mobile app stops showing the job even if the admin client cancel fails.

begin;

create or replace function public.quotes_cancel_assignment_on_driver_clear()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.assigned_driver_id is not distinct from old.assigned_driver_id then
    return new;
  end if;

  if new.assigned_driver_id is not null then
    return new;
  end if;

  if old.assigned_driver_id is null
    and coalesce(trim(old.assigned_driver_name), '') = '' then
    return new;
  end if;

  update public.job_assignments ja
  set
    status = 'cancelled',
    updated_at = now(),
    completed_at = null
  where ja.quote_id = new.id
    and lower(trim(ja.status)) not in ('cancelled', 'inactive', 'unassigned', 'removed');

  return new;
end;
$$;

drop trigger if exists quotes_cancel_assignment_on_driver_clear on public.quotes;
create trigger quotes_cancel_assignment_on_driver_clear
  after update of assigned_driver_id, assigned_driver_name on public.quotes
  for each row
  execute function public.quotes_cancel_assignment_on_driver_clear();

commit;
