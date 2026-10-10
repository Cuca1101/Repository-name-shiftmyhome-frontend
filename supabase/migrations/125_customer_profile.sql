-- Customer profile is the stable customers.id.
-- Name, phone and the saved address live on that row.
-- A new email is applied only after the new address is confirmed, and it does
-- not rewrite booking addresses, sent documents, or payment history.

begin;

alter table public.customers
  add column if not exists saved_address text,
  add column if not exists pending_email text,
  add column if not exists pending_email_at timestamptz,
  add column if not exists auth_user_id uuid;

create unique index if not exists customers_auth_user_id_key
  on public.customers (auth_user_id)
  where auth_user_id is not null;

create unique index if not exists customers_pending_email_key
  on public.customers (pending_email)
  where pending_email is not null;

create table if not exists public.customer_email_changes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  new_email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.customer_email_changes enable row level security;
revoke all on public.customer_email_changes from public, anon, authenticated;
grant all on public.customer_email_changes to service_role;

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
  -- A booking that is already filed keeps that customer. Quote edits must not
  -- overwrite the profile or open a second customer file.
  if new.customer_id is not null then
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
    set full_name = coalesce(public.customers.full_name, excluded.full_name),
        phone = coalesce(public.customers.phone, excluded.phone),
        updated_at = now()
  returning id into v_id;

  new.customer_id := v_id;
  return new;
end;
$$;

create or replace function public.portal_quote_belongs_to_customer(
  p_customer_id uuid,
  p_email text,
  p_quote_customer_id uuid,
  p_quote_email text
)
returns boolean
language sql
immutable
as $$
  select case
    when p_customer_id is not null and p_quote_customer_id = p_customer_id then true
    when p_quote_customer_id is null
      and lower(trim(coalesce(p_quote_email, ''))) = lower(trim(coalesce(p_email, ''))) then true
    when p_customer_id is null
      and lower(trim(coalesce(p_quote_email, ''))) = lower(trim(coalesce(p_email, ''))) then true
    else false
  end;
$$;

create or replace function public.customer_profile_json(p_customer public.customers)
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
  select jsonb_build_object(
    'id', p_customer.id,
    'email', p_customer.email,
    'full_name', coalesce(p_customer.full_name, ''),
    'phone', coalesce(p_customer.phone, ''),
    'saved_address', coalesce(p_customer.saved_address, ''),
    'pending_email', coalesce(p_customer.pending_email, ''),
    'has_password', exists (
      select 1
      from auth.users u
      where coalesce(u.encrypted_password, '') <> ''
        and (
          u.id = p_customer.auth_user_id
          or (p_customer.auth_user_id is null and lower(u.email) = p_customer.email)
        )
    )
  );
$$;

revoke all on function public.customer_profile_json(public.customers) from public, anon, authenticated;

create or replace function public.customer_portal_contact()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_email text := public.customer_portal_email();
  v_customer public.customers%rowtype;
begin
  if v_email = '' then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  select * into v_customer from public.customers where email = v_email;
  if v_customer.id is null then
    return jsonb_build_object(
      'ok', true,
      'email', v_email,
      'full_name', '',
      'phone', '',
      'saved_address', '',
      'pending_email', '',
      'has_password', false
    );
  end if;

  if v_customer.auth_user_id is null
    and auth.uid() is not null
    and not exists (select 1 from public.customers other where other.auth_user_id = auth.uid())
  then
    update public.customers
      set auth_user_id = auth.uid()
    where id = v_customer.id
      and auth_user_id is null;
    v_customer.auth_user_id := auth.uid();
  end if;

  return public.customer_profile_json(v_customer) || jsonb_build_object('ok', true);
end;
$$;

create or replace function public.customer_portal_save_profile(
  p_field text,
  p_value text,
  p_customer_id uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_field text := lower(trim(coalesce(p_field, '')));
  v_value text := trim(coalesce(p_value, ''));
  v_customer public.customers%rowtype;
  v_email text := public.customer_portal_email();
begin
  if v_field not in ('full_name', 'phone', 'saved_address') then
    return jsonb_build_object('ok', false, 'error', 'Choose which detail to save.');
  end if;

  if public.account_session_kind() = 'admin' then
    if p_customer_id is null then
      return jsonb_build_object('ok', false, 'error', 'Open this customer from Admin → Customers.');
    end if;
    select * into v_customer from public.customers where id = p_customer_id;
  elsif v_email = '' then
    return jsonb_build_object('ok', false, 'error', 'Sign in again to update your account.');
  else
    select * into v_customer from public.customers where email = v_email;
  end if;

  if v_customer.id is null then
    return jsonb_build_object('ok', false, 'error', 'Customer profile not found.');
  end if;

  if v_field = 'full_name' and (char_length(v_value) < 2 or char_length(v_value) > 80) then
    return jsonb_build_object('ok', false, 'error', 'Enter the full name, up to 80 characters.');
  end if;
  if v_field = 'phone' and (char_length(regexp_replace(v_value, '\D', '', 'g')) < 7 or char_length(v_value) > 30) then
    return jsonb_build_object('ok', false, 'error', 'Enter a phone number we can call.');
  end if;
  if v_field = 'saved_address' and (char_length(v_value) < 5 or char_length(v_value) > 240) then
    return jsonb_build_object('ok', false, 'error', 'Enter the full address to save on this profile.');
  end if;

  if v_field = 'full_name' then
    update public.customers set full_name = v_value, updated_at = now() where id = v_customer.id;
  elsif v_field = 'phone' then
    update public.customers set phone = v_value, updated_at = now() where id = v_customer.id;
  else
    update public.customers set saved_address = v_value, updated_at = now() where id = v_customer.id;
  end if;

  select * into v_customer from public.customers where id = v_customer.id;
  return public.customer_profile_json(v_customer) || jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.customer_portal_save_profile(text, text, uuid) from public, anon;
grant execute on function public.customer_portal_save_profile(text, text, uuid) to authenticated;

create or replace function public.customer_email_is_taken(p_email text, p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.customers c
    where c.id is distinct from p_customer_id
      and (
        c.email = lower(trim(coalesce(p_email, '')))
        or c.pending_email = lower(trim(coalesce(p_email, '')))
      )
  )
  or exists (
    select 1
    from auth.users u
    left join public.customers owner on owner.auth_user_id = u.id
    where lower(u.email) = lower(trim(coalesce(p_email, '')))
      and owner.id is distinct from p_customer_id
      and u.id is distinct from (select auth_user_id from public.customers where id = p_customer_id)
  );
$$;

revoke all on function public.customer_email_is_taken(text, uuid) from public, anon, authenticated;
grant execute on function public.customer_email_is_taken(text, uuid) to service_role;

create or replace function public.customer_begin_email_change(
  p_customer_id uuid,
  p_new_email text,
  p_token_hash text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_new_email, '')));
  v_customer public.customers%rowtype;
begin
  if p_customer_id is null or p_token_hash is null or char_length(p_token_hash) < 32 then
    return jsonb_build_object('ok', false, 'error', 'Could not start the email change.');
  end if;
  if position('@' in v_email) < 2 or position(' ' in v_email) > 0 or char_length(v_email) > 200 then
    return jsonb_build_object('ok', false, 'error', 'Enter a valid email address.');
  end if;

  select * into v_customer from public.customers where id = p_customer_id for update;
  if v_customer.id is null then
    return jsonb_build_object('ok', false, 'error', 'Customer profile not found.');
  end if;
  if v_email = v_customer.email then
    return jsonb_build_object('ok', false, 'error', 'That is already the email on this account.');
  end if;
  if public.customer_email_is_taken(v_email, v_customer.id) then
    return jsonb_build_object(
      'ok', false,
      'error', 'This email already belongs to another ShiftMyHome account. The accounts were not combined.'
    );
  end if;

  delete from public.customer_email_changes
  where customer_id = v_customer.id
    and confirmed_at is null;

  insert into public.customer_email_changes (customer_id, new_email, token_hash, expires_at)
  values (v_customer.id, v_email, p_token_hash, now() + interval '24 hours');

  update public.customers
    set pending_email = v_email,
        pending_email_at = now(),
        updated_at = now()
  where id = v_customer.id;

  return jsonb_build_object('ok', true, 'pending_email', v_email, 'current_email', v_customer.email);
end;
$$;

revoke all on function public.customer_begin_email_change(uuid, text, text) from public, anon, authenticated;
grant execute on function public.customer_begin_email_change(uuid, text, text) to service_role;

create or replace function public.customer_apply_email_change(p_token_hash text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_change public.customer_email_changes%rowtype;
  v_customer public.customers%rowtype;
  v_auth uuid;
begin
  select * into v_change
  from public.customer_email_changes
  where token_hash = p_token_hash
  for update;
  if v_change.id is null or v_change.confirmed_at is not null or v_change.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'This confirmation link is invalid or has expired. The current email is unchanged.');
  end if;

  select * into v_customer from public.customers where id = v_change.customer_id for update;
  if v_customer.id is null then
    return jsonb_build_object('ok', false, 'error', 'Customer profile not found.');
  end if;
  if v_customer.auth_user_id is null then
    select u.id into v_auth
    from auth.users u
    where lower(u.email) = v_customer.email
      and lower(coalesce(u.raw_app_meta_data ->> 'role', u.raw_user_meta_data ->> 'role', '')) not in ('admin', 'driver')
      and not exists (select 1 from public.drivers d where d.user_id = u.id)
    limit 1;
    if v_auth is not null and not exists (select 1 from public.customers other where other.auth_user_id = v_auth) then
      update public.customers set auth_user_id = v_auth where id = v_customer.id;
      v_customer.auth_user_id := v_auth;
    end if;
  end if;

  if public.customer_email_is_taken(v_change.new_email, v_customer.id) then
    return jsonb_build_object(
      'ok', false,
      'error', 'This email already belongs to another ShiftMyHome account. The accounts were not combined.'
    );
  end if;

  update public.customers
    set email = v_change.new_email,
        pending_email = null,
        pending_email_at = null,
        updated_at = now()
  where id = v_customer.id;

  update public.customer_email_changes
    set confirmed_at = now()
  where id = v_change.id;

  return jsonb_build_object(
    'ok', true,
    'customer_id', v_customer.id,
    'old_email', v_customer.email,
    'new_email', v_change.new_email,
    'auth_user_id', v_customer.auth_user_id
  );
end;
$$;

revoke all on function public.customer_apply_email_change(text) from public, anon, authenticated;
grant execute on function public.customer_apply_email_change(text) to service_role;

create or replace function public.customer_revert_email_change(p_customer_id uuid, p_old_email text, p_pending_email text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  update public.customers
    set email = lower(trim(p_old_email)),
        pending_email = nullif(lower(trim(coalesce(p_pending_email, ''))), ''),
        pending_email_at = case when nullif(lower(trim(coalesce(p_pending_email, ''))), '') is null then null else now() end,
        updated_at = now()
  where id = p_customer_id;

  if nullif(lower(trim(coalesce(p_pending_email, ''))), '') is null then
    delete from public.customer_email_changes
    where customer_id = p_customer_id
      and confirmed_at is null;
  end if;
end;
$$;

revoke all on function public.customer_revert_email_change(uuid, text, text) from public, anon, authenticated;
grant execute on function public.customer_revert_email_change(uuid, text, text) to service_role;

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
        and lower(coalesce(q.payment_status, '')) in ('paid', 'deposit_paid')
        and coalesce(q.is_test, false) = false
        and coalesce(q.archived_for_go_live, false) = false
        and coalesce(q.quote_ref, '') !~* '(DEMO|TEST)'
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
  where lower(coalesce(q.payment_status, '')) in ('paid', 'deposit_paid')
    and coalesce(q.is_test, false) = false
    and coalesce(q.archived_for_go_live, false) = false
    and coalesce(q.quote_ref, '') !~* '(DEMO|TEST)'
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
        and lower(coalesce(q.payment_status, '')) in ('paid', 'deposit_paid')
        and coalesce(q.is_test, false) = false
        and coalesce(q.archived_for_go_live, false) = false
        and coalesce(q.quote_ref, '') !~* '(DEMO|TEST)'
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
    and lower(coalesce(q.payment_status, '')) in ('paid', 'deposit_paid')
    and coalesce(q.is_test, false) = false
    and coalesce(q.archived_for_go_live, false) = false
    and coalesce(q.quote_ref, '') !~* '(DEMO|TEST)';

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
