-- One customer file per booking email. Does not read or write customer_leads,
-- website leads, or quote-request tables.

begin;

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

alter table public.customer_portal_link_requests
  add column if not exists recovery_requested_at timestamptz;

create or replace function public.customer_portal_claim_recovery_send(p_email text)
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

  insert into public.customer_portal_link_requests (email, requested_at, recovery_requested_at)
  values (v_email, now() - interval '2 minutes', now())
  on conflict (email) do update
    set recovery_requested_at = now()
    where public.customer_portal_link_requests.recovery_requested_at is null
      or public.customer_portal_link_requests.recovery_requested_at < now() - interval '60 seconds'
  returning true into v_ok;

  return coalesce(v_ok, false);
end;
$$;

revoke all on function public.customer_portal_claim_recovery_send(text) from public, anon, authenticated;
grant execute on function public.customer_portal_claim_recovery_send(text) to service_role;

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
  before insert or update on public.quotes
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

create or replace function public.customer_portal_contact()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := public.customer_portal_email();
  v_name text;
  v_phone text;
begin
  if v_email = '' then
    return jsonb_build_object('ok', false);
  end if;

  select nullif(trim(coalesce(q.full_name, '')), ''), nullif(trim(coalesce(q.phone, '')), '')
    into v_name, v_phone
  from public.quotes q
  where lower(trim(coalesce(q.email, ''))) = v_email
    and lower(coalesce(q.payment_status, '')) in ('paid', 'deposit_paid')
  order by q.created_at desc
  limit 1;

  if not found then
    select c.full_name, c.phone
      into v_name, v_phone
    from public.customers c
    where c.email = v_email;
  end if;

  return jsonb_build_object(
    'ok', true,
    'email', v_email,
    'full_name', coalesce(v_name, ''),
    'phone', coalesce(v_phone, '')
  );
end;
$$;

revoke all on function public.customer_portal_contact() from public, anon;
grant execute on function public.customer_portal_contact() to authenticated;

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
      select jsonb_agg(to_jsonb(s) order by s.updated_at desc)
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
            where (
              q.customer_id = c.id
              or lower(trim(coalesce(q.email, ''))) = c.email
            )
              and lower(coalesce(q.payment_status, '')) in ('paid', 'deposit_paid')
          ) as booking_count
        from public.customers c
        where v_q = ''
          or strpos(lower(c.email), v_q) > 0
          or strpos(lower(coalesce(c.full_name, '')), v_q) > 0
          or (
            length(v_digits) >= 3
            and strpos(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), v_digits) > 0
          )
        order by c.updated_at desc
        limit 80
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
  where (
    q.customer_id = v_customer.id
    or lower(trim(coalesce(q.email, ''))) = v_customer.email
  )
    and lower(coalesce(q.payment_status, '')) in ('paid', 'deposit_paid');

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
      select jsonb_agg(public.customer_portal_booking_json(q, false) order by q.move_date desc nulls last, q.created_at desc)
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
    'payments', coalesce((
      select jsonb_agg(p order by p.paid_at desc nulls last)
      from (
        select
          'booking'::text as kind,
          q.quote_ref as reference,
          q.amount_paid as amount,
          q.paid_at,
          q.payment_type,
          q.stripe_payment_intent_id
        from public.quotes q
        where q.id = any(v_ids)
          and coalesce(q.amount_paid, 0) > 0
        union all
        select
          'amendment',
          q.quote_ref,
          a.payment_delta,
          a.paid_at,
          'customer_booking_amendment',
          a.stripe_payment_intent_id
        from public.customer_booking_amendments a
        join public.quotes q on q.id = a.quote_id
        where a.quote_id = any(v_ids)
          and a.paid_at is not null
        union all
        select
          'extra_charge',
          coalesce(e.booking_reference, q.quote_ref),
          coalesce(e.approved_amount, e.estimated_amount),
          e.paid_at,
          e.status,
          e.stripe_payment_intent_id
        from public.extra_charge_requests e
        left join public.quotes q on q.id = e.quote_id
        where e.quote_id = any(v_ids)
          and e.paid_at is not null
        union all
        select
          'tip',
          q.quote_ref,
          t.amount_gbp,
          t.paid_at,
          t.status,
          t.stripe_payment_intent_id
        from public.job_tips t
        join public.quotes q on q.id = t.quote_id
        where t.quote_id = any(v_ids)
          and t.status = 'paid'
      ) p
    ), '[]'::jsonb),
    'emails', coalesce((
      select jsonb_agg(e order by e.sent_at desc)
      from (
        select
          a.subject,
          a.recipient_email,
          a.sent_at,
          a.event_key,
          a.provider_status as status
        from public.customer_email_archive a
        where a.quote_id = any(v_ids)
        union all
        select
          coalesce(n.event_label, n.event_key),
          n.recipient_email,
          n.sent_at,
          n.event_key,
          n.delivery_status
        from public.job_customer_notifications n
        where n.quote_id = any(v_ids)
        order by sent_at desc
        limit 80
      ) e
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_customer_profile(uuid) from public, anon;
grant execute on function public.admin_customer_profile(uuid) to authenticated;

commit;
