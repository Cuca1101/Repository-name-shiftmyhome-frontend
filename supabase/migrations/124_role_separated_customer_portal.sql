-- A signed-in admin or driver is not a customer.
-- Customer portal RPCs refuse staff sessions.
-- Admin view of a customer is a separate, explicit admin call.

begin;

alter table public.customer_booking_amendments
  add column if not exists acted_by uuid,
  add column if not exists acted_as text;

alter table public.customer_booking_amendments
  drop constraint if exists customer_booking_amendments_acted_as_check;

alter table public.customer_booking_amendments
  add constraint customer_booking_amendments_acted_as_check
  check (acted_as is null or acted_as in ('customer', 'admin'));

create or replace function public.account_session_kind()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then 'none'
    when public.auth_is_admin_session() then 'admin'
    when public.auth_is_driver_session() then 'driver'
    else 'customer'
  end;
$$;

revoke all on function public.account_session_kind() from public;
grant execute on function public.account_session_kind() to authenticated;

create or replace function public.customer_portal_email()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.account_session_kind() is distinct from 'customer' then
    return '';
  end if;
  return lower(trim(coalesce(auth.jwt() ->> 'email', '')));
end;
$$;

revoke all on function public.customer_portal_email() from public;
grant execute on function public.customer_portal_email() to authenticated;

create or replace function public.account_email_kind(p_email text)
returns text
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_user auth.users%rowtype;
  v_role text;
begin
  select * into v_user
  from auth.users
  where lower(email) = lower(trim(coalesce(p_email, '')))
  limit 1;
  if v_user.id is null then
    return 'customer';
  end if;
  v_role := lower(coalesce(v_user.raw_app_meta_data ->> 'role', v_user.raw_user_meta_data ->> 'role', ''));
  if v_role = 'admin' then
    return 'admin';
  end if;
  if v_role = 'driver' or exists (select 1 from public.drivers d where d.user_id = v_user.id) then
    return 'driver';
  end if;
  return 'customer';
end;
$$;

revoke all on function public.account_email_kind(text) from public, anon, authenticated;
grant execute on function public.account_email_kind(text) to service_role;

create or replace function public.admin_customer_portal_list(p_customer_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_customer public.customers%rowtype;
begin
  if not public.auth_is_admin_session() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_customer_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select * into v_customer from public.customers where id = p_customer_id;
  if v_customer.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  return jsonb_build_object(
    'ok', true,
    'customer', jsonb_build_object(
      'id', v_customer.id,
      'email', v_customer.email,
      'full_name', coalesce(v_customer.full_name, ''),
      'phone', coalesce(v_customer.phone, '')
    ),
    'bookings', coalesce((
      select jsonb_agg(public.customer_portal_booking_json(q, false) order by q.move_date desc nulls last, q.created_at desc)
      from public.quotes q
      where lower(trim(coalesce(q.email, ''))) = v_customer.email
        and lower(coalesce(q.payment_status, '')) in ('paid', 'deposit_paid')
        and coalesce(q.is_test, false) = false
        and coalesce(q.archived_for_go_live, false) = false
        and coalesce(q.quote_ref, '') !~* '(DEMO|TEST)'
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_customer_portal_list(uuid) from public, anon;
grant execute on function public.admin_customer_portal_list(uuid) to authenticated;

create or replace function public.admin_customer_portal_booking(p_customer_id uuid, p_quote_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customers%rowtype;
  v_q public.quotes%rowtype;
  v_token uuid;
  v_amendments jsonb;
  v_feedback jsonb;
begin
  if not public.auth_is_admin_session() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_customer_id is null or p_quote_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select * into v_customer from public.customers where id = p_customer_id;
  if v_customer.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select * into v_q
  from public.quotes q
  where q.id = p_quote_id
    and lower(trim(coalesce(q.email, ''))) = v_customer.email
    and lower(coalesce(q.payment_status, '')) in ('paid', 'deposit_paid')
    and coalesce(q.is_test, false) = false
    and coalesce(q.archived_for_go_live, false) = false
    and coalesce(q.quote_ref, '') !~* '(DEMO|TEST)';

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
    'paid_at', a.paid_at,
    'acted_as', a.acted_as,
    'acted_by', a.acted_by,
    'author', (select u.email from auth.users u where u.id = a.acted_by)
  ) order by a.created_at desc), '[]'::jsonb)
  into v_amendments
  from public.customer_booking_amendments a
  where a.quote_id = v_q.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', f.id,
    'rating', f.rating,
    'driver_rating', f.driver_rating,
    'review_text', f.review_text,
    'customer_name', f.customer_name,
    'submitted_at', f.submitted_at
  ) order by f.submitted_at desc), '[]'::jsonb)
  into v_feedback
  from public.job_customer_feedback f
  where f.quote_id = v_q.id;

  return jsonb_build_object(
    'ok', true,
    'customer', jsonb_build_object(
      'id', v_customer.id,
      'email', v_customer.email,
      'full_name', coalesce(v_customer.full_name, ''),
      'phone', coalesce(v_customer.phone, '')
    ),
    'booking', public.customer_portal_booking_json(v_q, true),
    'tracking_token', v_token,
    'amendments', v_amendments,
    'feedback', v_feedback
  );
end;
$$;

revoke all on function public.admin_customer_portal_booking(uuid, uuid) from public, anon;
grant execute on function public.admin_customer_portal_booking(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
