-- Customer portal Job progress shows the same Accepted time as admin Job Details.
-- That stamp is quotes.assigned_at. The booking payload did not include it.

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
    'assigned_at', q.assigned_at,
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
