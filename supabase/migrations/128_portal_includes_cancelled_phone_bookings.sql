-- Admin → Customers counts a phone booking even when it was cancelled before payment.
-- The customer portal only listed paid bookings, so two of Andrei Teglas's
-- three cancelled jobs were missing.

begin;

create or replace function public.customer_portal_list_bookings()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := public.customer_portal_email();
  v_customer_id uuid;
begin
  if v_email = '' then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;
  select id into v_customer_id from public.customers where email = v_email;

  return jsonb_build_object(
    'ok', true,
    'bookings', coalesce((
      select jsonb_agg(public.customer_portal_booking_json(q, false) order by q.move_date desc nulls last, q.created_at desc)
      from public.quotes q
      where public.portal_quote_belongs_to_customer(v_customer_id, v_email, q.customer_id, q.email)
        and public.quote_is_customer_booking(
          q.payment_status, q.source, q.email, q.is_test, q.archived_for_go_live, q.quote_ref
        )
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.customer_portal_get_booking(p_quote_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := public.customer_portal_email();
  v_customer_id uuid;
  v_q public.quotes%rowtype;
  v_token uuid;
  v_amendments jsonb;
begin
  if v_email = '' or p_quote_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  select id into v_customer_id from public.customers where email = v_email;

  select * into v_q
  from public.quotes q
  where q.id = p_quote_id
    and public.portal_quote_belongs_to_customer(v_customer_id, v_email, q.customer_id, q.email)
    and public.quote_is_customer_booking(
      q.payment_status, q.source, q.email, q.is_test, q.archived_for_go_live, q.quote_ref
    );

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
    'acted_by', a.acted_by
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

create or replace function public.customer_portal_booking_ids_for_email(p_email text)
returns table (id uuid, email text, quote_ref text, full_name text)
language sql
stable
security definer
set search_path = public
as $$
  select q.id,
         coalesce(c.email, q.email) as email,
         q.quote_ref,
         coalesce(c.full_name, q.full_name) as full_name
  from public.quotes q
  left join public.customers c on c.id = q.customer_id
  where public.quote_is_customer_booking(
      q.payment_status, q.source, q.email, q.is_test, q.archived_for_go_live, q.quote_ref
    )
    and (
      (c.id is not null and c.email = lower(trim(coalesce(p_email, ''))))
      or (q.customer_id is null and lower(trim(coalesce(q.email, ''))) = lower(trim(coalesce(p_email, ''))))
    );
$$;

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
    'customer', public.customer_profile_json(v_customer),
    'bookings', coalesce((
      select jsonb_agg(public.customer_portal_booking_json(q, false) order by q.move_date desc nulls last, q.created_at desc)
      from public.quotes q
      where public.portal_quote_belongs_to_customer(v_customer.id, v_customer.email, q.customer_id, q.email)
        and public.quote_is_customer_booking(
          q.payment_status, q.source, q.email, q.is_test, q.archived_for_go_live, q.quote_ref
        )
    ), '[]'::jsonb)
  );
end;
$$;

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
    and public.portal_quote_belongs_to_customer(v_customer.id, v_customer.email, q.customer_id, q.email)
    and public.quote_is_customer_booking(
      q.payment_status, q.source, q.email, q.is_test, q.archived_for_go_live, q.quote_ref
    );

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
    'acted_by', a.acted_by
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
    'customer', public.customer_profile_json(v_customer),
    'booking', public.customer_portal_booking_json(v_q, true),
    'tracking_token', v_token,
    'amendments', v_amendments,
    'feedback', v_feedback
  );
end;
$$;

create or replace function public.admin_customer_profile(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_customer public.customers%rowtype;
  v_ids uuid[];
begin
  if not public.auth_is_admin_session() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select * into v_customer from public.customers where id = p_id;
  if v_customer.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select coalesce(array_agg(q.id), '{}')
    into v_ids
  from public.quotes q
  where public.portal_quote_belongs_to_customer(v_customer.id, v_customer.email, q.customer_id, q.email)
    and public.quote_is_customer_booking(
      q.payment_status, q.source, q.email, q.is_test, q.archived_for_go_live, q.quote_ref
    );

  return jsonb_build_object(
    'ok', true,
    'customer', public.customer_profile_json(v_customer),
    'bookings', coalesce((
      select jsonb_agg(public.customer_portal_booking_json(q, true) order by q.move_date desc nulls last, q.created_at desc)
      from public.quotes q
      where q.id = any(v_ids)
    ), '[]'::jsonb),
    'amendments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'quote_id', a.quote_id,
        'status', a.status,
        'previous_total', a.previous_total,
        'next_total', a.next_total,
        'payment_delta', a.payment_delta,
        'refund_due', a.refund_due,
        'created_at', a.created_at,
        'paid_at', a.paid_at,
        'applied_at', a.applied_at
      ) order by a.created_at desc)
      from public.customer_booking_amendments a
      where a.quote_id = any(v_ids)
    ), '[]'::jsonb),
    'feedback', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id,
        'quote_id', f.quote_id,
        'rating', f.rating,
        'driver_rating', f.driver_rating,
        'review_text', f.review_text,
        'customer_name', f.customer_name,
        'submitted_at', f.submitted_at
      ) order by f.submitted_at desc)
      from public.job_customer_feedback f
      where f.quote_id = any(v_ids)
    ), '[]'::jsonb)
  );
end;
$$;

notify pgrst, 'reload schema';

commit;
