-- Repair stuck driver/assignment/GPS sync (run once after 071).
-- Fixes quotes still assigned when job_assignments cancelled/completed,
-- and orphan assignments with no quote.assigned_driver_id.

begin;

-- 1) Quotes: clear driver when assignment is terminal
update public.quotes q
set
  assigned_driver_id = null,
  assigned_driver_name = null,
  status = case
    when lower(trim(coalesce(q.status, ''))) in ('on_way', 'arrived', 'in_transit', 'pickup_completed', 'in_progress', 'completed')
      then 'Booked'
    else q.status
  end,
  operational_status = case
    when q.operational_status in ('Completed', 'Cancelled') then q.operational_status
    else null
  end
from public.job_assignments ja
where ja.quote_id = q.id
  and q.assigned_driver_id is not null
  and lower(trim(ja.status)) in ('cancelled', 'inactive', 'completed');

-- 2) Orphan assignments: quote has no driver but assignment still active
update public.job_assignments ja
set
  status = 'cancelled',
  updated_at = now()
from public.quotes q
where q.id = ja.quote_id
  and q.assigned_driver_id is null
  and q.assigned_driver_name is null
  and lower(trim(ja.status)) not in ('cancelled', 'inactive', 'completed');

-- 3) Normalize legacy Cancelled / Assigned casing on assignments
update public.job_assignments
set status = lower(trim(status))
where status in ('Cancelled', 'Assigned', 'Accepted', 'Completed');

-- 4) Clear GPS job link when quote no longer assigned to that driver
update public.driver_locations dl
set
  quote_id = null,
  assignment_id = null,
  status = 'available',
  updated_at = now()
where dl.quote_id is not null
  and not exists (
    select 1
    from public.quotes q
    where q.id = dl.quote_id
      and q.assigned_driver_id = dl.driver_id
  );

commit;

-- Verify
select q.quote_ref, q.assigned_driver_id, ja.status as ja_status
from public.quotes q
left join public.job_assignments ja on ja.quote_id = q.id
where q.assigned_driver_id is not null
   or lower(coalesce(ja.status, '')) not in ('cancelled', 'inactive', 'completed')
order by q.quote_ref
limit 20;
