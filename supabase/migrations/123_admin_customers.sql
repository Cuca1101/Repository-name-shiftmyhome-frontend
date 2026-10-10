-- One customer file per booking email. Same name with a different email stays a
-- separate person. New paid bookings update this file through the quote trigger.

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_email_key unique (email)
);

create index if not exists customers_name_idx on public.customers (lower(full_name));
create index if not exists customers_phone_idx on public.customers (phone);

alter table public.quotes
  add column if not exists customer_id uuid references public.customers (id) on delete set null;

create index if not exists quotes_customer_id_idx on public.quotes (customer_id);

alter table public.customers enable row level security;

revoke all on public.customers from public, anon, authenticated;
grant all on public.customers to service_role;

create or replace function public.sync_customer_from_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(new.email, '')));
  v_id uuid;
begin
  if lower(coalesce(new.payment_status, '')) not in ('paid', 'deposit_paid') then
    return new;
  end if;
  if position('@' in v_email) < 2 or v_email = 'phone-booking@shiftmyhome.local' then
    return new;
  end if;
  if tg_op = 'UPDATE'
    and old.customer_id is not null
    and lower(trim(coalesce(old.email, ''))) = v_email
    and coalesce(old.full_name, '') = coalesce(new.full_name, '')
    and coalesce(old.phone, '') = coalesce(new.phone, '')
    and lower(coalesce(old.payment_status, '')) in ('paid', 'deposit_paid')
  then
    return new;
  end if;

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
  return new;
end;
$$;

drop trigger if exists quotes_sync_customer_from_booking on public.quotes;
create trigger quotes_sync_customer_from_booking
  before insert or update of email, full_name, phone, payment_status, customer_id
  on public.quotes
  for each row
  execute function public.sync_customer_from_booking();

insert into public.customers (email, full_name, phone)
select distinct on (lower(trim(q.email)))
  lower(trim(q.email)),
  nullif(trim(coalesce(q.full_name, '')), ''),
  nullif(trim(coalesce(q.phone, '')), '')
from public.quotes q
where lower(coalesce(q.payment_status, '')) in ('paid', 'deposit_paid')
  and position('@' in lower(trim(coalesce(q.email, '')))) > 1
  and lower(trim(q.email)) <> 'phone-booking@shiftmyhome.local'
  and coalesce(q.is_test, false) = false
  and coalesce(q.archived_for_go_live, false) = false
  and coalesce(q.quote_ref, '') !~* '(DEMO|TEST)'
order by lower(trim(q.email)), q.created_at desc
on conflict (email) do update
  set full_name = coalesce(excluded.full_name, public.customers.full_name),
      phone = coalesce(excluded.phone, public.customers.phone),
      updated_at = now();

update public.quotes q
set customer_id = c.id
from public.customers c
where q.customer_id is null
  and lower(trim(coalesce(q.email, ''))) = c.email
  and lower(coalesce(q.payment_status, '')) in ('paid', 'deposit_paid');

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
              and lower(coalesce(q.payment_status, '')) in ('paid', 'deposit_paid')
              and coalesce(q.is_test, false) = false
              and coalesce(q.archived_for_go_live, false) = false
              and coalesce(q.quote_ref, '') !~* '(DEMO|TEST)'
          ) as booking_count,
          (
            select coalesce(jsonb_agg(jsonb_build_object(
              'id', q.id,
              'quote_ref', q.quote_ref,
              'move_date', q.move_date,
              'created_at', q.created_at,
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
              and lower(coalesce(q.payment_status, '')) in ('paid', 'deposit_paid')
              and coalesce(q.is_test, false) = false
              and coalesce(q.archived_for_go_live, false) = false
              and coalesce(q.quote_ref, '') !~* '(DEMO|TEST)'
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
  where lower(trim(coalesce(q.email, ''))) = v_customer.email
    and lower(coalesce(q.payment_status, '')) in ('paid', 'deposit_paid')
    and coalesce(q.is_test, false) = false
    and coalesce(q.archived_for_go_live, false) = false
    and coalesce(q.quote_ref, '') !~* '(DEMO|TEST)';

  return jsonb_build_object(
    'ok', true,
    'customer', jsonb_build_object(
      'id', v_customer.id,
      'email', v_customer.email,
      'full_name', v_customer.full_name,
      'phone', v_customer.phone,
      'created_at', v_customer.created_at,
      'updated_at', v_customer.updated_at
    ),
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

revoke all on function public.admin_customer_profile(uuid) from public, anon;
grant execute on function public.admin_customer_profile(uuid) to authenticated;

notify pgrst, 'reload schema';
