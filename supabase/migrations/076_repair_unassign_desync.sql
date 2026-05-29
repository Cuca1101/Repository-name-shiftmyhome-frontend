-- Repair partial unassign: quote has no driver but assignment still active/completed
-- or marketplace_visibility stuck on 'assigned'.

begin;

update public.quotes q
set
  marketplace_visibility = 'hidden_from_partners',
  operational_status = case
    when q.operational_status in ('Completed', 'Cancelled') then q.operational_status
    else null
  end,
  status = case
    when lower(trim(coalesce(q.status, ''))) in ('on_way', 'arrived', 'in_transit', 'pickup_completed', 'in_progress')
      then 'Booked'
    else q.status
  end
where q.assigned_driver_id is null
  and coalesce(trim(q.assigned_driver_name), '') = ''
  and q.marketplace_visibility = 'assigned'
  and q.completed_at is null
  and q.cancelled_at is null;

update public.job_assignments ja
set
  status = 'cancelled',
  updated_at = now(),
  completed_at = null
from public.quotes q
where q.id = ja.quote_id
  and q.assigned_driver_id is null
  and coalesce(trim(q.assigned_driver_name), '') = ''
  and lower(trim(ja.status)) not in ('cancelled', 'inactive');

commit;
