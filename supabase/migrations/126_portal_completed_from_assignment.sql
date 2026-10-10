-- Admin Completed Jobs includes a finished driver assignment.
-- The customer portal was still reading the quote journey status, so a job
-- left on "On way" stayed In progress after the assignment was completed.
-- Finishing the assignment now completes the quote as well. The historical
-- repair does not send a new completion email.

begin;

create or replace function public.customer_portal_booking_json(q public.quotes, p_include_details boolean)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', q.id,
    'quote_ref', q.quote_ref,
    'status', q.status,
    'operational_status', q.operational_status,
    'payment_status', q.payment_status,
    'payment_type', q.payment_type,
    'full_name', q.full_name,
    'email', q.email,
    'phone', q.phone,
    'pickup_address', q.pickup_address,
    'delivery_address', q.delivery_address,
    'move_date', q.move_date,
    'arrival_window', q.arrival_window,
    'arrival_type', q.arrival_type,
    'arrival_time', q.arrival_time,
    'distance_miles', q.distance_miles,
    'crew_size', q.crew_size,
    'vehicle_size', q.vehicle_size,
    'inventory', q.inventory,
    'inventory_text', q.inventory_text,
    'estimated_total', q.estimated_total,
    'calculated_total', q.calculated_total,
    'agreed_price', q.agreed_price,
    'amount_paid', q.amount_paid,
    'remaining_balance', q.remaining_balance,
    'assigned_driver_id', q.assigned_driver_id,
    'assigned_driver_name', q.assigned_driver_name,
    'assigned_driver_phone', (
      select nullif(trim(d.phone), '')
      from public.drivers d
      where d.id = q.assigned_driver_id
    ),
    'assignment_status', (
      select a.status from public.job_assignments a where a.quote_id = q.id
    ),
    'assignment_completed_at', (
      select a.completed_at from public.job_assignments a where a.quote_id = q.id
    ),
    'service', q.service,
    'service_type', q.service_type,
    'completed_at', q.completed_at,
    'cancelled_at', q.cancelled_at,
    'customer_kind', q.customer_kind,
    'created_at', q.created_at,
    'service_package_snapshot', q.service_package_snapshot,
    'details', case when p_include_details then q.details else null end
  );
$$;

revoke all on function public.customer_portal_booking_json(public.quotes, boolean) from public;

create or replace function public.job_assignments_sync_quote_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(trim(coalesce(new.status, ''))) is distinct from 'completed' then
    return new;
  end if;

  update public.quotes q
    set status = 'completed',
        operational_status = 'Completed',
        completed_at = coalesce(q.completed_at, new.completed_at, now())
  where q.id = new.quote_id
    and q.cancelled_at is null
    and lower(coalesce(q.status, '')) is distinct from 'cancelled'
    and lower(coalesce(q.operational_status, '')) is distinct from 'cancelled'
    and not public.quote_row_is_completed(q.status, q.operational_status, q.completed_at);

  return new;
end;
$$;

drop trigger if exists job_assignments_sync_quote_completed on public.job_assignments;
create trigger job_assignments_sync_quote_completed
  after insert or update of status, completed_at on public.job_assignments
  for each row
  execute function public.job_assignments_sync_quote_completed();

comment on function public.job_assignments_sync_quote_completed() is
  'A completed driver assignment marks the quote completed for admin and the customer portal.';

alter table public.quotes disable trigger trg_enqueue_job_completed_notify_on_quote;

update public.quotes q
set status = 'completed',
    operational_status = 'Completed',
    completed_at = coalesce(q.completed_at, a.completed_at, now())
from public.job_assignments a
where a.quote_id = q.id
  and lower(a.status) = 'completed'
  and q.cancelled_at is null
  and lower(coalesce(q.status, '')) is distinct from 'cancelled'
  and lower(coalesce(q.operational_status, '')) is distinct from 'cancelled'
  and not public.quote_row_is_completed(q.status, q.operational_status, q.completed_at);

alter table public.quotes enable trigger trg_enqueue_job_completed_notify_on_quote;

commit;
