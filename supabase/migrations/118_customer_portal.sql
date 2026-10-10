-- Customer portal: magic-link identity, own-bookings only, amendment history.
-- Tracking tokens and booking ids stay read-only. Writes go through the service role
-- after the edge function checks the signed-in email.

begin;

create table if not exists public.customer_booking_amendments (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  status text not null,
  previous_total numeric,
  next_total numeric,
  payment_delta numeric not null default 0,
  existing_balance numeric,
  changes jsonb not null default '[]'::jsonb,
  proposed jsonb not null default '{}'::jsonb,
  approval_reasons jsonb not null default '[]'::jsonb,
  refund_due numeric,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_booking_amendments_status_check check (
    status in (
      'pending_payment',
      'pending_approval',
      'applied',
      'abandoned',
      'payment_failed',
      'rejected',
      'paid_needs_review'
    )
  )
);

create index if not exists customer_booking_amendments_quote_idx
  on public.customer_booking_amendments (quote_id, created_at desc);

create unique index if not exists customer_booking_amendments_one_open
  on public.customer_booking_amendments (quote_id)
  where status in ('pending_payment', 'pending_approval', 'paid_needs_review');

create table if not exists public.customer_portal_link_requests (
  email text primary key,
  requested_at timestamptz not null default now()
);

alter table public.customer_booking_amendments enable row level security;
alter table public.customer_portal_link_requests enable row level security;

drop policy if exists customer_booking_amendments_admin_read on public.customer_booking_amendments;
create policy customer_booking_amendments_admin_read
  on public.customer_booking_amendments
  for select
  to authenticated
  using (public.auth_is_admin_session());

revoke all on public.customer_booking_amendments from public, anon;
revoke all on public.customer_portal_link_requests from public, anon, authenticated;
grant select on public.customer_booking_amendments to authenticated;
grant all on public.customer_booking_amendments to service_role;
grant all on public.customer_portal_link_requests to service_role;

create or replace function public.customer_portal_email()
returns text
language sql
stable
as $$
  select lower(trim(coalesce(auth.jwt() ->> 'email', '')));
$$;

revoke all on function public.customer_portal_email() from public;
grant execute on function public.customer_portal_email() to authenticated;

create or replace function public.customer_portal_claim_link_send(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_ok boolean := false;
begin
  if v_email = '' or position('@' in v_email) < 2 then
    return false;
  end if;

  insert into public.customer_portal_link_requests (email, requested_at)
  values (v_email, now())
  on conflict (email) do update
    set requested_at = now()
    where public.customer_portal_link_requests.requested_at < now() - interval '60 seconds'
  returning true into v_ok;

  return coalesce(v_ok, false);
end;
$$;

revoke all on function public.customer_portal_claim_link_send(text) from public, anon, authenticated;
grant execute on function public.customer_portal_claim_link_send(text) to service_role;

create or replace function public.customer_portal_driver_busy(
  p_driver uuid,
  p_date date,
  p_exclude uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.quotes q
    where p_driver is not null
      and q.assigned_driver_id = p_driver
      and q.id is distinct from p_exclude
      and q.move_date = p_date
      and q.cancelled_at is null
      and lower(coalesce(q.status, '')) <> 'cancelled'
      and lower(coalesce(q.operational_status, '')) not in ('cancelled', 'completed')
      and lower(coalesce(q.payment_status, '')) in ('paid', 'deposit_paid')
  );
$$;

revoke all on function public.customer_portal_driver_busy(uuid, date, uuid) from public, anon, authenticated;
grant execute on function public.customer_portal_driver_busy(uuid, date, uuid) to service_role;

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
    'assigned_driver_name', q.assigned_driver_name,
    'service', q.service,
    'service_type', q.service_type,
    'completed_at', q.completed_at,
    'cancelled_at', q.cancelled_at,
    'service_package_snapshot', q.service_package_snapshot,
    'details', case when p_include_details then q.details else null end
  );
$$;

revoke all on function public.customer_portal_booking_json(public.quotes, boolean) from public;

create or replace function public.customer_portal_list_bookings()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := public.customer_portal_email();
begin
  if v_email = '' then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  return jsonb_build_object(
    'ok', true,
    'bookings', coalesce((
      select jsonb_agg(public.customer_portal_booking_json(q, false) order by q.move_date desc nulls last, q.created_at desc)
      from public.quotes q
      where lower(trim(coalesce(q.email, ''))) = v_email
        and lower(coalesce(q.payment_status, '')) in ('paid', 'deposit_paid')
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.customer_portal_list_bookings() from public, anon;
grant execute on function public.customer_portal_list_bookings() to authenticated;

create or replace function public.customer_portal_get_booking(p_quote_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := public.customer_portal_email();
  v_q public.quotes%rowtype;
  v_token uuid;
  v_amendments jsonb;
begin
  if v_email = '' or p_quote_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select * into v_q
  from public.quotes q
  where q.id = p_quote_id
    and lower(trim(coalesce(q.email, ''))) = v_email
    and lower(coalesce(q.payment_status, '')) in ('paid', 'deposit_paid');

  if v_q.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if lower(coalesce(v_q.payment_status, '')) in ('paid', 'deposit_paid') then
    v_token := public.ensure_job_tracking_token(v_q.id);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'status', a.status,
    'previous_total', a.previous_total,
    'next_total', a.next_total,
    'payment_delta', a.payment_delta,
    'existing_balance', a.existing_balance,
    'changes', a.changes,
    'approval_reasons', a.approval_reasons,
    'refund_due', a.refund_due,
    'created_at', a.created_at,
    'applied_at', a.applied_at,
    'paid_at', a.paid_at
  ) order by a.created_at desc), '[]'::jsonb)
  into v_amendments
  from public.customer_booking_amendments a
  where a.quote_id = v_q.id;

  return jsonb_build_object(
    'ok', true,
    'booking', public.customer_portal_booking_json(v_q, true),
    'tracking_token', v_token,
    'amendments', v_amendments
  );
end;
$$;

revoke all on function public.customer_portal_get_booking(uuid) from public, anon;
grant execute on function public.customer_portal_get_booking(uuid) to authenticated;

grant execute on function public.public_quote_day_slot_counts(date, date) to service_role;
grant execute on function public.public_get_pricing_settings() to service_role;

create or replace function public.customer_portal_booking_ids_for_email(p_email text)
returns table (id uuid, email text, quote_ref text, full_name text)
language sql
stable
security definer
set search_path = public
as $$
  select q.id, q.email, q.quote_ref, q.full_name
  from public.quotes q
  where lower(trim(coalesce(q.email, ''))) = lower(trim(coalesce(p_email, '')))
    and lower(coalesce(q.payment_status, '')) in ('paid', 'deposit_paid');
$$;

revoke all on function public.customer_portal_booking_ids_for_email(text) from public, anon, authenticated;
grant execute on function public.customer_portal_booking_ids_for_email(text) to service_role;

comment on table public.customer_booking_amendments is
  'Customer portal date/item changes and the payment that covered a price increase. One open change per booking.';

commit;
