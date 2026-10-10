-- One profile per normalised email. The new/returning label is stored on the
-- booking when that booking is created and is never recalculated later.

alter table public.quotes
  add column if not exists customer_kind text;

alter table public.quotes
  drop constraint if exists quotes_customer_kind_check;

alter table public.quotes
  add constraint quotes_customer_kind_check
  check (customer_kind is null or customer_kind in ('new', 'returning'));

create or replace function public.quote_is_customer_booking(
  p_payment_status text,
  p_source text,
  p_email text,
  p_is_test boolean,
  p_archived boolean,
  p_quote_ref text
)
returns boolean
language sql
immutable
as $$
  select (
      lower(coalesce(p_payment_status, '')) in ('paid', 'deposit_paid')
      or lower(coalesce(p_source, '')) in ('phone_booking', 'admin_phone_booking')
    )
    and position('@' in lower(trim(coalesce(p_email, '')))) > 1
    and lower(trim(coalesce(p_email, ''))) <> 'phone-booking@shiftmyhome.local'
    and coalesce(p_is_test, false) = false
    and coalesce(p_archived, false) = false
    and coalesce(p_quote_ref, '') !~* '(DEMO|TEST)';
$$;

revoke all on function public.quote_is_customer_booking(text, text, text, boolean, boolean, text) from public, anon, authenticated;

create or replace function public.sync_customer_from_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(new.email, '')));
  v_id uuid;
  v_prior integer;
begin
  if tg_op = 'UPDATE' and old.customer_kind is not null then
    new.customer_kind := old.customer_kind;
  end if;

  if not public.quote_is_customer_booking(
    new.payment_status, new.source, new.email, new.is_test, new.archived_for_go_live, new.quote_ref
  ) then
    return new;
  end if;

  new.email := v_email;

  insert into public.customers (email, full_name, phone, updated_at)
  values (
    v_email,
    nullif(trim(coalesce(new.full_name, '')), ''),
    nullif(trim(coalesce(new.phone, '')), ''),
    now()
  )
  on conflict (email) do update
    set full_name = coalesce(excluded.full_name, public.customers.full_name),
        phone = coalesce(excluded.phone, public.customers.phone),
        updated_at = now()
  returning id into v_id;

  new.customer_id := v_id;

  if new.customer_kind is null then
    select count(*)
      into v_prior
    from public.quotes q
    where q.id is distinct from new.id
      and lower(trim(coalesce(q.email, ''))) = v_email
      and public.quote_is_customer_booking(
        q.payment_status, q.source, q.email, q.is_test, q.archived_for_go_live, q.quote_ref
      );
    new.customer_kind := case when v_prior > 0 then 'returning' else 'new' end;
  end if;

  return new;
end;
$$;

drop trigger if exists quotes_sync_customer_from_booking on public.quotes;
create trigger quotes_sync_customer_from_booking
  before insert or update of email, full_name, phone, payment_status, customer_id, source, customer_kind
  on public.quotes
  for each row
  execute function public.sync_customer_from_booking();

update public.quotes q
set customer_kind = ranked.kind
from (
  select
    id,
    case
      when row_number() over (
        partition by lower(trim(email))
        order by created_at asc, id asc
      ) = 1 then 'new'
      else 'returning'
    end as kind
  from public.quotes
  where public.quote_is_customer_booking(
    payment_status, source, email, is_test, archived_for_go_live, quote_ref
  )
) ranked
where q.id = ranked.id
  and q.customer_kind is null;

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

create or replace function public.admin_customer_search(p_query text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_q text := lower(trim(coalesce(p_query, '')));
  v_digits text := regexp_replace(v_q, '\D', '', 'g');
begin
  if not public.auth_is_admin_session() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  return jsonb_build_object(
    'ok', true,
    'customers', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.full_name nulls last, s.email)
      from (
        select
          c.id,
          c.email,
          c.full_name,
          c.phone,
          c.updated_at,
          (
            select count(*)
            from public.quotes q
            where lower(trim(coalesce(q.email, ''))) = c.email
              and public.quote_is_customer_booking(
                q.payment_status, q.source, q.email, q.is_test, q.archived_for_go_live, q.quote_ref
              )
          ) as booking_count,
          (
            select min(q.created_at)
            from public.quotes q
            where lower(trim(coalesce(q.email, ''))) = c.email
              and public.quote_is_customer_booking(
                q.payment_status, q.source, q.email, q.is_test, q.archived_for_go_live, q.quote_ref
              )
          ) as first_booking_at,
          (
            select coalesce(jsonb_agg(jsonb_build_object(
              'id', q.id,
              'quote_ref', q.quote_ref,
              'move_date', q.move_date,
              'created_at', q.created_at,
              'customer_kind', q.customer_kind,
              'status', q.status,
              'operational_status', q.operational_status,
              'completed_at', q.completed_at,
              'cancelled_at', q.cancelled_at,
              'amount_paid', q.amount_paid,
              'remaining_balance', q.remaining_balance,
              'agreed_price', q.agreed_price,
              'estimated_total', q.estimated_total,
              'calculated_total', q.calculated_total,
              'payment_status', q.payment_status,
              'payment_type', q.payment_type
            ) order by q.move_date desc nulls last, q.created_at desc), '[]'::jsonb)
            from public.quotes q
            where lower(trim(coalesce(q.email, ''))) = c.email
              and public.quote_is_customer_booking(
                q.payment_status, q.source, q.email, q.is_test, q.archived_for_go_live, q.quote_ref
              )
          ) as bookings
        from public.customers c
        where v_q = ''
          or strpos(lower(c.email), v_q) > 0
          or strpos(lower(coalesce(c.full_name, '')), v_q) > 0
          or (
            length(v_digits) >= 3
            and strpos(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), v_digits) > 0
          )
      ) s
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_customer_search(text) from public, anon;
grant execute on function public.admin_customer_search(text) to authenticated;

create or replace function public.admin_customer_identity(p_email text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_count integer;
  v_first timestamptz;
begin
  if not public.auth_is_admin_session() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if position('@' in v_email) < 2 or v_email = 'phone-booking@shiftmyhome.local' then
    return jsonb_build_object('ok', true, 'known', false, 'booking_count', 0, 'next_kind', 'new');
  end if;

  select count(*), min(q.created_at)
    into v_count, v_first
  from public.quotes q
  where lower(trim(coalesce(q.email, ''))) = v_email
    and public.quote_is_customer_booking(
      q.payment_status, q.source, q.email, q.is_test, q.archived_for_go_live, q.quote_ref
    );

  return jsonb_build_object(
    'ok', true,
    'known', v_count > 0,
    'booking_count', v_count,
    'first_booking_at', v_first,
    'next_kind', case when v_count > 0 then 'returning' else 'new' end
  );
end;
$$;

revoke all on function public.admin_customer_identity(text) from public, anon;
grant execute on function public.admin_customer_identity(text) to authenticated;

create or replace function public.admin_customer_portal_list(p_customer_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_customer public.customers%rowtype;
  v_count integer;
  v_first timestamptz;
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

  select count(*), min(q.created_at)
    into v_count, v_first
  from public.quotes q
  where lower(trim(coalesce(q.email, ''))) = v_customer.email
    and public.quote_is_customer_booking(
      q.payment_status, q.source, q.email, q.is_test, q.archived_for_go_live, q.quote_ref
    );

  return jsonb_build_object(
    'ok', true,
    'customer', jsonb_build_object(
      'id', v_customer.id,
      'email', v_customer.email,
      'full_name', coalesce(v_customer.full_name, ''),
      'phone', coalesce(v_customer.phone, ''),
      'booking_count', v_count,
      'first_booking_at', v_first
    ),
    'bookings', coalesce((
      select jsonb_agg(public.customer_portal_booking_json(q, false) order by q.move_date desc nulls last, q.created_at desc)
      from public.quotes q
      where lower(trim(coalesce(q.email, ''))) = v_customer.email
        and public.quote_is_customer_booking(
          q.payment_status, q.source, q.email, q.is_test, q.archived_for_go_live, q.quote_ref
        )
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
  v_count integer;
  v_first timestamptz;
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
    and public.quote_is_customer_booking(
      q.payment_status, q.source, q.email, q.is_test, q.archived_for_go_live, q.quote_ref
    );

  if v_q.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if lower(coalesce(v_q.payment_status, '')) in ('paid', 'deposit_paid') then
    v_token := public.ensure_job_tracking_token(v_q.id);
  end if;

  select count(*), min(q.created_at)
    into v_count, v_first
  from public.quotes q
  where lower(trim(coalesce(q.email, ''))) = v_customer.email
    and public.quote_is_customer_booking(
      q.payment_status, q.source, q.email, q.is_test, q.archived_for_go_live, q.quote_ref
    );

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
      'phone', coalesce(v_customer.phone, ''),
      'booking_count', v_count,
      'first_booking_at', v_first
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
