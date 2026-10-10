-- Customer portal shows the same paid bookings as admin: the stored quote_ref, without test rows.

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
        and coalesce(q.is_test, false) = false
        and coalesce(q.archived_for_go_live, false) = false
        and coalesce(q.quote_ref, '') !~* '(DEMO|TEST)'
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
    and lower(coalesce(q.payment_status, '')) in ('paid', 'deposit_paid')
    and coalesce(q.is_test, false) = false
    and coalesce(q.archived_for_go_live, false) = false
    and coalesce(q.quote_ref, '') !~* '(DEMO|TEST)';
$$;

revoke all on function public.customer_portal_booking_ids_for_email(text) from public, anon, authenticated;
grant execute on function public.customer_portal_booking_ids_for_email(text) to service_role;
