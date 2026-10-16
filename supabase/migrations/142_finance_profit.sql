-- Manual Finance & Profit ledger. Independent of bookings, jobs, payments, customers and drivers.
-- The PIN is stored only as a bcrypt hash. Access is RPC-only after an admin unlock session.

create extension if not exists pgcrypto with schema extensions;

alter table public.admin_config_secrets
  add column if not exists finance_pin_hash text;

comment on column public.admin_config_secrets.finance_pin_hash is
  'Bcrypt hash of the Finance & Profit PIN. Plain PIN is never stored.';

-- ---------------------------------------------------------------------------
-- Tables (no client grants; SECURITY DEFINER RPCs only)
-- ---------------------------------------------------------------------------

create table if not exists public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_key text not null unique,
  slug text not null unique,
  bucket text not null check (bucket in ('diesel', 'driver_pay', 'helper_pay', 'other')),
  is_system boolean not null default false,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_income_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_key text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_payees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_key text not null,
  kind text not null check (kind in ('driver', 'helper', 'other')),
  created_at timestamptz not null default now(),
  unique (name_key, kind)
);

create table if not exists public.finance_income (
  id uuid primary key default gen_random_uuid(),
  activity_date date not null,
  source_name text not null,
  amount_gbp numeric(12, 2) not null check (amount_gbp > 0 and amount_gbp <= 1000000),
  description text,
  client_key text unique,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists finance_income_activity_date_idx
  on public.finance_income (activity_date desc);

create table if not exists public.finance_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  category_id uuid not null references public.finance_categories (id),
  amount_gbp numeric(12, 2) not null check (amount_gbp > 0 and amount_gbp <= 1000000),
  description text not null,
  payee_name text,
  receipt_path text,
  receipt_name text,
  client_key text unique,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists finance_expenses_expense_date_idx
  on public.finance_expenses (expense_date desc);

create table if not exists public.finance_unlock_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists finance_unlock_sessions_user_idx
  on public.finance_unlock_sessions (user_id);

create table if not exists public.finance_pin_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  created_at timestamptz not null default now()
);

create index if not exists finance_pin_attempts_user_created_idx
  on public.finance_pin_attempts (user_id, created_at desc);

comment on table public.finance_income is
  'Manual income entered in Finance & Profit. Not linked to bookings, jobs or payments.';
comment on table public.finance_expenses is
  'Manual expenses entered in Finance & Profit. Payee names are not linked to platform drivers.';

alter table public.finance_categories enable row level security;
alter table public.finance_income_sources enable row level security;
alter table public.finance_payees enable row level security;
alter table public.finance_income enable row level security;
alter table public.finance_expenses enable row level security;
alter table public.finance_unlock_sessions enable row level security;
alter table public.finance_pin_attempts enable row level security;

revoke all on table public.finance_categories from public, anon, authenticated;
revoke all on table public.finance_income_sources from public, anon, authenticated;
revoke all on table public.finance_payees from public, anon, authenticated;
revoke all on table public.finance_income from public, anon, authenticated;
revoke all on table public.finance_expenses from public, anon, authenticated;
revoke all on table public.finance_unlock_sessions from public, anon, authenticated;
revoke all on table public.finance_pin_attempts from public, anon, authenticated;

grant all on table public.finance_categories to service_role;
grant all on table public.finance_income_sources to service_role;
grant all on table public.finance_payees to service_role;
grant all on table public.finance_income to service_role;
grant all on table public.finance_expenses to service_role;
grant all on table public.finance_unlock_sessions to service_role;
grant all on table public.finance_pin_attempts to service_role;

-- ---------------------------------------------------------------------------
-- Seed categories. Custom categories are added later and stay in "other".
-- ---------------------------------------------------------------------------

insert into public.finance_categories (name, name_key, slug, bucket, is_system, sort_order)
values
  ('Diesel', 'diesel', 'diesel', 'diesel', true, 10),
  ('Driver pay', 'driver pay', 'driver-pay', 'driver_pay', true, 20),
  ('Helper pay', 'helper pay', 'helper-pay', 'helper_pay', true, 30),
  ('Insurance', 'insurance', 'insurance', 'other', true, 40),
  ('Repairs', 'repairs', 'repairs', 'other', true, 50),
  ('Van hire', 'van hire', 'van-hire', 'other', true, 60),
  ('Advertising', 'advertising', 'advertising', 'other', true, 70),
  ('Commissions', 'commissions', 'commissions', 'other', true, 80),
  ('Parking', 'parking', 'parking', 'other', true, 90),
  ('Road charges', 'road charges', 'road-charges', 'other', true, 100),
  ('Other expenses', 'other expenses', 'other-expenses', 'other', true, 110)
on conflict (name_key) do nothing;

-- Initial PIN 09121987, including the leading zero. Stored only as a hash.
update public.admin_config_secrets
set finance_pin_hash = extensions.crypt('09121987', extensions.gen_salt('bf')),
    updated_at = now()
where id = 'default'
  and (finance_pin_hash is null or btrim(finance_pin_hash) = '');

insert into public.admin_config_secrets (id, finance_pin_hash)
select 'default', extensions.crypt('09121987', extensions.gen_salt('bf'))
where not exists (select 1 from public.admin_config_secrets where id = 'default');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.finance_clean_name(p_name text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), '');
$$;

create or replace function public.finance_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists finance_income_set_updated_at on public.finance_income;
create trigger finance_income_set_updated_at
  before update on public.finance_income
  for each row execute function public.finance_set_updated_at();

drop trigger if exists finance_expenses_set_updated_at on public.finance_expenses;
create trigger finance_expenses_set_updated_at
  before update on public.finance_expenses
  for each row execute function public.finance_set_updated_at();

create or replace function public.finance_guard(p_token text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_id uuid;
begin
  if not public.auth_is_admin_session() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_token is null or length(p_token) < 32 then
    raise exception 'Finance module is locked. Enter the PIN again.' using errcode = '42501';
  end if;

  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  select s.id
    into v_id
  from public.finance_unlock_sessions s
  where s.user_id = auth.uid()
    and s.token_hash = v_hash
    and s.expires_at > now();

  if v_id is null then
    raise exception 'Finance module is locked. Enter the PIN again.' using errcode = '42501';
  end if;

  update public.finance_unlock_sessions
  set expires_at = now() + interval '30 minutes'
  where id = v_id;
end;
$$;

create or replace function public.finance_storage_allowed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.auth_is_admin_session()
    and exists (
      select 1
      from public.finance_unlock_sessions s
      where s.user_id = auth.uid()
        and s.expires_at > now()
    );
$$;

create or replace function public.finance_parse_date(p_raw text)
returns date
language plpgsql
immutable
as $$
declare
  v_date date;
begin
  if p_raw is null or p_raw !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Enter a valid date.';
  end if;
  begin
    v_date := p_raw::date;
  exception
    when others then
      raise exception 'Enter a valid date.';
  end;
  if to_char(v_date, 'YYYY-MM-DD') <> p_raw
     or v_date < date '2000-01-01'
     or v_date > date '2100-12-31' then
    raise exception 'Enter a valid date.';
  end if;
  return v_date;
end;
$$;

create or replace function public.finance_parse_amount(p_raw text)
returns numeric
language plpgsql
immutable
as $$
declare
  v_amount numeric;
begin
  if p_raw is null or btrim(p_raw) !~ '^\d+(\.\d{1,2})?$' then
    raise exception 'Enter an amount in pounds with up to 2 decimal places.';
  end if;
  v_amount := btrim(p_raw)::numeric;
  if v_amount <= 0 or v_amount > 1000000 then
    raise exception 'Enter an amount greater than 0 and up to 1000000.';
  end if;
  return round(v_amount, 2);
end;
$$;

create or replace function public.finance_income_json(p_row public.finance_income)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', p_row.id,
    'activity_date', to_char(p_row.activity_date, 'YYYY-MM-DD'),
    'source_name', p_row.source_name,
    'amount_gbp', trim(to_char(p_row.amount_gbp, 'FM999999990.00')),
    'description', coalesce(p_row.description, ''),
    'created_at', p_row.created_at,
    'updated_at', p_row.updated_at
  );
$$;

create or replace function public.finance_expense_json(p_row public.finance_expenses)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', p_row.id,
    'expense_date', to_char(p_row.expense_date, 'YYYY-MM-DD'),
    'category_id', p_row.category_id,
    'category_name', c.name,
    'bucket', c.bucket,
    'amount_gbp', trim(to_char(p_row.amount_gbp, 'FM999999990.00')),
    'description', p_row.description,
    'payee_name', coalesce(p_row.payee_name, ''),
    'receipt_path', p_row.receipt_path,
    'receipt_name', p_row.receipt_name,
    'created_at', p_row.created_at,
    'updated_at', p_row.updated_at
  )
  from public.finance_categories c
  where c.id = p_row.category_id;
$$;

create or replace function public.finance_remember_source(p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := public.finance_clean_name(p_name);
  v_key text := lower(public.finance_clean_name(p_name));
begin
  insert into public.finance_income_sources (name, name_key)
  values (v_name, v_key)
  on conflict (name_key) do update
    set name = excluded.name;
end;
$$;

create or replace function public.finance_remember_payee(p_name text, p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := public.finance_clean_name(p_name);
  v_key text;
  v_kind text := p_kind;
begin
  if v_name is null then
    return;
  end if;
  if v_kind not in ('driver', 'helper', 'other') then
    v_kind := 'other';
  end if;
  v_key := lower(v_name);
  insert into public.finance_payees (name, name_key, kind)
  values (v_name, v_key, v_kind)
  on conflict (name_key, kind) do update
    set name = excluded.name;
end;
$$;

create or replace function public.finance_resolve_category(p_category_id uuid, p_new_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text := public.finance_clean_name(p_new_name);
  v_key text;
  v_slug text;
  v_n integer := 2;
begin
  if p_category_id is not null then
    select id into v_id from public.finance_categories where id = p_category_id;
    if v_id is null then
      raise exception 'Choose a category.';
    end if;
    return v_id;
  end if;

  if v_name is null or char_length(v_name) > 60 then
    raise exception 'Enter a category name up to 60 characters.';
  end if;

  v_key := lower(v_name);
  select id into v_id from public.finance_categories where name_key = v_key;
  if v_id is not null then
    return v_id;
  end if;

  v_slug := trim(both '-' from regexp_replace(v_key, '[^a-z0-9]+', '-', 'g'));
  if v_slug is null or v_slug = '' then
    v_slug := 'category';
  end if;
  while exists (select 1 from public.finance_categories where slug = v_slug) loop
    v_slug := trim(both '-' from regexp_replace(v_key, '[^a-z0-9]+', '-', 'g')) || '-' || v_n::text;
    v_n := v_n + 1;
    if v_n > 50 then
      raise exception 'Could not save that category name.';
    end if;
  end loop;

  insert into public.finance_categories (name, name_key, slug, bucket, is_system, sort_order)
  values (
    v_name,
    v_key,
    v_slug,
    'other',
    false,
    (select coalesce(max(sort_order), 100) + 10 from public.finance_categories)
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Unlock / lock
-- ---------------------------------------------------------------------------

create or replace function public.finance_unlock(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_pin text := btrim(coalesce(p_pin, ''));
  v_hash text;
  v_fails integer;
  v_oldest timestamptz;
  v_retry integer;
  v_token text;
  v_token_hash text;
begin
  if not public.auth_is_admin_session() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  delete from public.finance_pin_attempts
  where created_at < now() - interval '1 day';

  delete from public.finance_unlock_sessions
  where expires_at <= now();

  select count(*), min(created_at)
    into v_fails, v_oldest
  from public.finance_pin_attempts
  where user_id = auth.uid()
    and created_at > now() - interval '15 minutes';

  if coalesce(v_fails, 0) >= 5 then
    v_retry := greatest(1, ceil(extract(epoch from (v_oldest + interval '15 minutes' - now())))::integer);
    return jsonb_build_object(
      'ok', false,
      'locked', true,
      'retry_after_seconds', v_retry,
      'error', 'Too many attempts. Try again in ' || greatest(1, ceil(v_retry / 60.0))::integer || ' minute(s).'
    );
  end if;

  select finance_pin_hash
    into v_hash
  from public.admin_config_secrets
  where id = 'default';

  if v_hash is null or btrim(v_hash) = '' then
    return jsonb_build_object(
      'ok', false,
      'error', 'Finance PIN is not set yet.'
    );
  end if;

  -- Compare as text so a leading zero is part of the PIN.
  if v_pin !~ '^[0-9]{8}$' or btrim(v_hash) <> crypt(v_pin, btrim(v_hash)) then
    insert into public.finance_pin_attempts (user_id) values (auth.uid());
    return jsonb_build_object('ok', false, 'error', 'Incorrect PIN.');
  end if;

  delete from public.finance_pin_attempts where user_id = auth.uid();
  delete from public.finance_unlock_sessions where user_id = auth.uid();

  v_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

  insert into public.finance_unlock_sessions (user_id, token_hash, expires_at)
  values (auth.uid(), v_token_hash, now() + interval '30 minutes');

  return jsonb_build_object('ok', true, 'token', v_token);
end;
$$;

create or replace function public.finance_lock(p_token text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.auth_is_admin_session() then
    return;
  end if;
  if p_token is null or length(p_token) < 32 then
    return;
  end if;
  delete from public.finance_unlock_sessions
  where user_id = auth.uid()
    and token_hash = encode(digest(p_token, 'sha256'), 'hex');
end;
$$;

create or replace function public.finance_lock_all()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.auth_is_admin_session() then
    return;
  end if;
  delete from public.finance_unlock_sessions where user_id = auth.uid();
end;
$$;

create or replace function public.finance_touch(p_token text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.finance_guard(p_token);
end;
$$;

-- ---------------------------------------------------------------------------
-- Read / write
-- ---------------------------------------------------------------------------

create or replace function public.finance_list(p_token text, p_from date, p_to date)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_from date := p_from;
  v_to date := p_to;
begin
  perform public.finance_guard(p_token);

  if v_from is null or v_to is null then
    raise exception 'Choose a start and end date.';
  end if;
  if v_from > v_to then
    raise exception 'The start date must be on or before the end date.';
  end if;
  if v_to - v_from > 800 then
    raise exception 'Choose a range of 800 days or less.';
  end if;

  return jsonb_build_object(
    'ok', true,
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'slug', c.slug,
        'bucket', c.bucket,
        'is_system', c.is_system,
        'sort_order', c.sort_order
      ) order by c.sort_order, c.name)
      from public.finance_categories c
    ), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'name', s.name
      ) order by s.name)
      from public.finance_income_sources s
    ), '[]'::jsonb),
    'payees', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'kind', p.kind
      ) order by p.name)
      from public.finance_payees p
    ), '[]'::jsonb),
    'incomes', coalesce((
      select jsonb_agg(public.finance_income_json(i) order by i.activity_date desc, i.created_at desc)
      from public.finance_income i
      where i.activity_date between v_from and v_to
    ), '[]'::jsonb),
    'expenses', coalesce((
      select jsonb_agg(public.finance_expense_json(e) order by e.expense_date desc, e.created_at desc)
      from public.finance_expenses e
      where e.expense_date between v_from and v_to
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.finance_save_income(p_token text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_date date;
  v_source text;
  v_amount numeric;
  v_description text;
  v_client_key text;
  v_id_text text;
  v_have boolean := false;
  v_row public.finance_income;
begin
  perform public.finance_guard(p_token);

  v_date := public.finance_parse_date(p_payload->>'activity_date');
  v_source := public.finance_clean_name(p_payload->>'source_name');
  v_amount := public.finance_parse_amount(p_payload->>'amount_gbp');
  v_description := nullif(left(btrim(coalesce(p_payload->>'description', '')), 500), '');
  v_client_key := nullif(btrim(coalesce(p_payload->>'client_key', '')), '');

  if v_source is null or char_length(v_source) > 80 then
    raise exception 'Enter an income source up to 80 characters.';
  end if;

  if v_client_key is not null and v_client_key !~ '^[0-9a-fA-F-]{36}$' then
    raise exception 'Could not save this income. Try again.';
  end if;

  v_id_text := nullif(btrim(coalesce(p_payload->>'id', '')), '');
  if v_id_text is not null and v_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'That income record was not found.';
  end if;

  if v_id_text is not null then
    v_id := v_id_text::uuid;
    update public.finance_income
    set activity_date = v_date,
        source_name = v_source,
        amount_gbp = v_amount,
        description = v_description
    where id = v_id
    returning * into v_row;
    if not found then
      raise exception 'That income record was not found.';
    end if;
  else
    if v_client_key is not null then
      select * into v_row from public.finance_income where client_key = v_client_key;
      v_have := found;
    end if;
    if not v_have then
      insert into public.finance_income (
        activity_date, source_name, amount_gbp, description, client_key, created_by
      ) values (
        v_date, v_source, v_amount, v_description, v_client_key, auth.uid()
      )
      returning * into v_row;
    end if;
  end if;

  perform public.finance_remember_source(v_source);
  return jsonb_build_object('ok', true, 'income', public.finance_income_json(v_row));
exception
  when unique_violation then
    if v_client_key is null then
      raise;
    end if;
    select * into v_row from public.finance_income where client_key = v_client_key;
    if not found then
      raise;
    end if;
    return jsonb_build_object('ok', true, 'income', public.finance_income_json(v_row));
end;
$$;

create or replace function public.finance_save_expense(p_token text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_date date;
  v_category_id uuid;
  v_amount numeric;
  v_description text;
  v_payee text;
  v_path text;
  v_file text;
  v_client_key text;
  v_bucket text;
  v_kind text;
  v_id_text text;
  v_category_text text;
  v_have boolean := false;
  v_row public.finance_expenses;
begin
  perform public.finance_guard(p_token);

  v_date := public.finance_parse_date(p_payload->>'expense_date');
  v_amount := public.finance_parse_amount(p_payload->>'amount_gbp');
  v_description := btrim(coalesce(p_payload->>'description', ''));
  v_payee := public.finance_clean_name(p_payload->>'payee_name');
  v_path := nullif(btrim(coalesce(p_payload->>'receipt_path', '')), '');
  v_file := nullif(left(btrim(coalesce(p_payload->>'receipt_name', '')), 180), '');
  v_client_key := nullif(btrim(coalesce(p_payload->>'client_key', '')), '');

  if v_description = '' or char_length(v_description) > 500 then
    raise exception 'Enter a name or description up to 500 characters.';
  end if;
  if v_payee is not null and char_length(v_payee) > 80 then
    raise exception 'Enter a person name up to 80 characters.';
  end if;
  if v_path is not null and v_path !~ '^[0-9a-fA-F-]{36}/[^/\\]{1,180}$' then
    raise exception 'The receipt could not be saved.';
  end if;
  if v_client_key is not null and v_client_key !~ '^[0-9a-fA-F-]{36}$' then
    raise exception 'Could not save this expense. Try again.';
  end if;

  v_category_text := nullif(btrim(coalesce(p_payload->>'category_id', '')), '');
  if v_category_text is not null and v_category_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Choose a category.';
  end if;
  v_id_text := nullif(btrim(coalesce(p_payload->>'id', '')), '');
  if v_id_text is not null and v_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'That expense record was not found.';
  end if;

  v_category_id := public.finance_resolve_category(
    v_category_text::uuid,
    p_payload->>'new_category_name'
  );

  if v_id_text is not null then
    v_id := v_id_text::uuid;
    update public.finance_expenses
    set expense_date = v_date,
        category_id = v_category_id,
        amount_gbp = v_amount,
        description = v_description,
        payee_name = v_payee,
        receipt_path = v_path,
        receipt_name = case when v_path is null then null else coalesce(v_file, receipt_name) end
    where id = v_id
    returning * into v_row;
    if not found then
      raise exception 'That expense record was not found.';
    end if;
  else
    if v_client_key is not null then
      select * into v_row from public.finance_expenses where client_key = v_client_key;
      v_have := found;
    end if;
    if not v_have then
      insert into public.finance_expenses (
        expense_date, category_id, amount_gbp, description, payee_name,
        receipt_path, receipt_name, client_key, created_by
      ) values (
        v_date, v_category_id, v_amount, v_description, v_payee,
        v_path, v_file, v_client_key, auth.uid()
      )
      returning * into v_row;
    end if;
  end if;

  select bucket into v_bucket from public.finance_categories where id = v_row.category_id;
  v_kind := case v_bucket
    when 'driver_pay' then 'driver'
    when 'helper_pay' then 'helper'
    else 'other'
  end;
  perform public.finance_remember_payee(v_row.payee_name, v_kind);

  return jsonb_build_object('ok', true, 'expense', public.finance_expense_json(v_row));
exception
  when unique_violation then
    if v_client_key is null then
      raise;
    end if;
    select * into v_row from public.finance_expenses where client_key = v_client_key;
    if not found then
      raise;
    end if;
    return jsonb_build_object('ok', true, 'expense', public.finance_expense_json(v_row));
end;
$$;

create or replace function public.finance_delete_income(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_found uuid;
begin
  perform public.finance_guard(p_token);
  delete from public.finance_income where id = p_id returning id into v_found;
  if v_found is null then
    raise exception 'That income record was not found.';
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.finance_delete_expense(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_path text;
begin
  perform public.finance_guard(p_token);
  delete from public.finance_expenses where id = p_id returning receipt_path into v_path;
  if not found then
    raise exception 'That expense record was not found.';
  end if;
  return jsonb_build_object('ok', true, 'receipt_path', v_path);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: functions only. Tables stay closed to the browser.
-- ---------------------------------------------------------------------------

revoke all on function public.finance_clean_name(text) from public, anon, authenticated;
revoke all on function public.finance_set_updated_at() from public, anon, authenticated;
revoke all on function public.finance_guard(text) from public, anon, authenticated;
revoke all on function public.finance_parse_date(text) from public, anon, authenticated;
revoke all on function public.finance_parse_amount(text) from public, anon, authenticated;
revoke all on function public.finance_income_json(public.finance_income) from public, anon, authenticated;
revoke all on function public.finance_expense_json(public.finance_expenses) from public, anon, authenticated;
revoke all on function public.finance_remember_source(text) from public, anon, authenticated;
revoke all on function public.finance_remember_payee(text, text) from public, anon, authenticated;
revoke all on function public.finance_resolve_category(uuid, text) from public, anon, authenticated;

revoke all on function public.finance_storage_allowed() from public, anon;
grant execute on function public.finance_storage_allowed() to authenticated, service_role;

revoke all on function public.finance_unlock(text) from public, anon;
grant execute on function public.finance_unlock(text) to authenticated, service_role;

revoke all on function public.finance_lock(text) from public, anon;
grant execute on function public.finance_lock(text) to authenticated, service_role;

revoke all on function public.finance_lock_all() from public, anon;
grant execute on function public.finance_lock_all() to authenticated, service_role;

revoke all on function public.finance_touch(text) from public, anon;
grant execute on function public.finance_touch(text) to authenticated, service_role;

revoke all on function public.finance_list(text, date, date) from public, anon;
grant execute on function public.finance_list(text, date, date) to authenticated, service_role;

revoke all on function public.finance_save_income(text, jsonb) from public, anon;
grant execute on function public.finance_save_income(text, jsonb) to authenticated, service_role;

revoke all on function public.finance_save_expense(text, jsonb) from public, anon;
grant execute on function public.finance_save_expense(text, jsonb) to authenticated, service_role;

revoke all on function public.finance_delete_income(text, uuid) from public, anon;
grant execute on function public.finance_delete_income(text, uuid) to authenticated, service_role;

revoke all on function public.finance_delete_expense(text, uuid) from public, anon;
grant execute on function public.finance_delete_expense(text, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Private receipt bucket. Readable only while a finance unlock session exists.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'finance-receipts',
  'finance-receipts',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "finance_receipts_select" on storage.objects;
create policy "finance_receipts_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'finance-receipts' and public.finance_storage_allowed());

drop policy if exists "finance_receipts_insert" on storage.objects;
create policy "finance_receipts_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'finance-receipts' and public.finance_storage_allowed());

drop policy if exists "finance_receipts_update" on storage.objects;
create policy "finance_receipts_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'finance-receipts' and public.finance_storage_allowed())
  with check (bucket_id = 'finance-receipts' and public.finance_storage_allowed());

drop policy if exists "finance_receipts_delete" on storage.objects;
create policy "finance_receipts_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'finance-receipts' and public.finance_storage_allowed());
