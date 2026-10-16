-- Finance & Profit daily driver records.
-- Saved names live only in this module. They are not platform drivers, and nothing is
-- imported from bookings, jobs, customers or payments.
-- Existing finance_income and finance_expenses rows are kept and still count once.

create table if not exists public.finance_settings (
  id text primary key,
  deduction_percent numeric(5, 2) not null default 25
    check (deduction_percent >= 0 and deduction_percent <= 100),
  updated_at timestamptz not null default now()
);

insert into public.finance_settings (id, deduction_percent)
values ('default', 25)
on conflict (id) do nothing;

create table if not exists public.finance_drivers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_key text not null unique,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_driver_days (
  id uuid primary key default gen_random_uuid(),
  activity_date date not null,
  driver_id uuid not null references public.finance_drivers (id),
  driver_name text not null,
  source_name text not null default '',
  income_gbp numeric(12, 2) not null default 0 check (income_gbp >= 0 and income_gbp <= 1000000),
  salary_gbp numeric(12, 2) not null default 0 check (salary_gbp >= 0 and salary_gbp <= 1000000),
  diesel_gbp numeric(12, 2) not null default 0 check (diesel_gbp >= 0 and diesel_gbp <= 1000000),
  other_gbp numeric(12, 2) not null default 0 check (other_gbp >= 0 and other_gbp <= 1000000),
  other_description text not null default '',
  client_key text unique,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_driver_days_activity_date_driver_id_key unique (activity_date, driver_id)
);

create index if not exists finance_driver_days_activity_date_idx
  on public.finance_driver_days (activity_date desc);

comment on table public.finance_drivers is
  'Driver names saved in Finance & Profit. Not linked to platform driver accounts.';
comment on table public.finance_driver_days is
  'One manual daily record per saved finance driver. Amounts are entered for that date and are not copied from another date.';
comment on table public.finance_settings is
  'Deduction percentage applied once to a Finance & Profit period. It is not described as tax.';

alter table public.finance_settings enable row level security;
alter table public.finance_drivers enable row level security;
alter table public.finance_driver_days enable row level security;

revoke all on table public.finance_settings from public, anon, authenticated;
revoke all on table public.finance_drivers from public, anon, authenticated;
revoke all on table public.finance_driver_days from public, anon, authenticated;

grant all on table public.finance_settings to service_role;
grant all on table public.finance_drivers to service_role;
grant all on table public.finance_driver_days to service_role;

drop trigger if exists finance_drivers_set_updated_at on public.finance_drivers;
create trigger finance_drivers_set_updated_at
  before update on public.finance_drivers
  for each row execute function public.finance_set_updated_at();

drop trigger if exists finance_driver_days_set_updated_at on public.finance_driver_days;
create trigger finance_driver_days_set_updated_at
  before update on public.finance_driver_days
  for each row execute function public.finance_set_updated_at();

create or replace function public.finance_parse_nonneg(p_raw text)
returns numeric
language plpgsql
immutable
as $$
declare
  v_text text := btrim(coalesce(p_raw, ''));
  v_amount numeric;
begin
  if v_text = '' then
    return 0;
  end if;
  if v_text !~ '^\d+(\.\d{1,2})?$' then
    raise exception 'Enter an amount in pounds with up to 2 decimal places.';
  end if;
  v_amount := v_text::numeric;
  if v_amount < 0 or v_amount > 1000000 then
    raise exception 'Enter an amount from 0 up to 1000000.';
  end if;
  return round(v_amount, 2);
end;
$$;

create or replace function public.finance_driver_json(p_row public.finance_drivers)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', p_row.id,
    'name', p_row.name,
    'archived', p_row.archived_at is not null,
    'created_at', p_row.created_at,
    'updated_at', p_row.updated_at
  );
$$;

create or replace function public.finance_driver_day_json(p_row public.finance_driver_days)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', p_row.id,
    'activity_date', to_char(p_row.activity_date, 'YYYY-MM-DD'),
    'driver_id', p_row.driver_id,
    'driver_name', p_row.driver_name,
    'source_name', p_row.source_name,
    'income_gbp', trim(to_char(p_row.income_gbp, 'FM999999990.00')),
    'salary_gbp', trim(to_char(p_row.salary_gbp, 'FM999999990.00')),
    'diesel_gbp', trim(to_char(p_row.diesel_gbp, 'FM999999990.00')),
    'other_gbp', trim(to_char(p_row.other_gbp, 'FM999999990.00')),
    'other_description', coalesce(p_row.other_description, ''),
    'created_at', p_row.created_at,
    'updated_at', p_row.updated_at
  );
$$;

create or replace function public.finance_save_driver(p_token text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_key text;
  v_existing uuid;
  v_archived timestamptz;
  v_id_text text;
  v_row public.finance_drivers;
begin
  perform public.finance_guard(p_token);

  v_name := public.finance_clean_name(p_payload->>'name');
  if v_name is null or char_length(v_name) > 80 then
    raise exception 'Enter a driver name up to 80 characters.';
  end if;
  v_key := lower(v_name);
  v_id_text := nullif(btrim(coalesce(p_payload->>'id', '')), '');
  if v_id_text is not null and v_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'That driver was not found.';
  end if;

  select id, archived_at
    into v_existing, v_archived
  from public.finance_drivers
  where name_key = v_key
    and (v_id_text is null or id <> v_id_text::uuid);

  if v_existing is not null then
    if v_archived is not null then
      raise exception 'That driver is archived. Restore them in Manage drivers.';
    end if;
    raise exception 'A driver with that name already exists.';
  end if;

  if v_id_text is not null then
    update public.finance_drivers
    set name = v_name,
        name_key = v_key
    where id = v_id_text::uuid
    returning * into v_row;
    if not found then
      raise exception 'That driver was not found.';
    end if;
    update public.finance_driver_days
    set driver_name = v_name
    where driver_id = v_row.id
      and driver_name is distinct from v_name;
  else
    insert into public.finance_drivers (name, name_key)
    values (v_name, v_key)
    returning * into v_row;
  end if;

  return jsonb_build_object('ok', true, 'driver', public.finance_driver_json(v_row));
end;
$$;

create or replace function public.finance_set_driver_archived(p_token text, p_id uuid, p_archived boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.finance_drivers;
begin
  perform public.finance_guard(p_token);
  if p_id is null then
    raise exception 'That driver was not found.';
  end if;

  update public.finance_drivers
  set archived_at = case
    when coalesce(p_archived, true) then coalesce(archived_at, now())
    else null
  end
  where id = p_id
  returning * into v_row;

  if not found then
    raise exception 'That driver was not found.';
  end if;

  return jsonb_build_object('ok', true, 'driver', public.finance_driver_json(v_row));
end;
$$;

create or replace function public.finance_save_driver_day(p_token text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date;
  v_driver_id uuid;
  v_driver_name text;
  v_archived timestamptz;
  v_source text;
  v_income numeric;
  v_salary numeric;
  v_diesel numeric;
  v_other numeric;
  v_other_text text;
  v_client_key text;
  v_id_text text;
  v_driver_text text;
  v_new_name text;
  v_key text;
  v_row public.finance_driver_days;
  v_have boolean := false;
  v_constraint text;
begin
  perform public.finance_guard(p_token);

  v_date := public.finance_parse_date(p_payload->>'activity_date');
  v_source := coalesce(public.finance_clean_name(p_payload->>'source_name'), '');
  if char_length(v_source) > 80 then
    raise exception 'Enter an income source up to 80 characters.';
  end if;

  v_income := public.finance_parse_nonneg(p_payload->>'income_gbp');
  v_salary := public.finance_parse_nonneg(p_payload->>'salary_gbp');
  v_diesel := public.finance_parse_nonneg(p_payload->>'diesel_gbp');
  v_other := public.finance_parse_nonneg(p_payload->>'other_gbp');
  v_other_text := left(btrim(coalesce(p_payload->>'other_description', '')), 500);
  if v_other > 0 and v_other_text = '' then
    raise exception 'Enter a description for other expenses.';
  end if;

  v_client_key := nullif(btrim(coalesce(p_payload->>'client_key', '')), '');
  if v_client_key is not null and v_client_key !~ '^[0-9a-fA-F-]{36}$' then
    raise exception 'Could not save this driver record. Try again.';
  end if;

  v_id_text := nullif(btrim(coalesce(p_payload->>'id', '')), '');
  if v_id_text is not null and v_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'That driver record was not found.';
  end if;

  v_driver_text := nullif(btrim(coalesce(p_payload->>'driver_id', '')), '');
  if v_driver_text is not null and v_driver_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Choose a saved driver.';
  end if;

  if v_driver_text is not null then
    select id, name, archived_at
      into v_driver_id, v_driver_name, v_archived
    from public.finance_drivers
    where id = v_driver_text::uuid;
    if v_driver_id is null then
      raise exception 'Choose a saved driver.';
    end if;
    if v_id_text is null and v_archived is not null then
      raise exception 'Restore this driver before adding them to a day.';
    end if;
  else
    v_new_name := public.finance_clean_name(p_payload->>'new_driver_name');
    if v_new_name is null or char_length(v_new_name) > 80 then
      raise exception 'Enter a driver name up to 80 characters.';
    end if;
    v_key := lower(v_new_name);
    select id, name, archived_at
      into v_driver_id, v_driver_name, v_archived
    from public.finance_drivers
    where name_key = v_key;
    if v_driver_id is null then
      insert into public.finance_drivers (name, name_key)
      values (v_new_name, v_key)
      returning id, name into v_driver_id, v_driver_name;
    elsif v_archived is not null then
      raise exception 'That driver is archived. Restore them in Manage drivers.';
    end if;
  end if;

  -- Amounts are taken only from this request. Another date is never copied.
  if v_id_text is not null then
    update public.finance_driver_days
    set activity_date = v_date,
        driver_id = v_driver_id,
        driver_name = v_driver_name,
        source_name = v_source,
        income_gbp = v_income,
        salary_gbp = v_salary,
        diesel_gbp = v_diesel,
        other_gbp = v_other,
        other_description = v_other_text
    where id = v_id_text::uuid
    returning * into v_row;
    if not found then
      raise exception 'That driver record was not found.';
    end if;
  else
    if v_client_key is not null then
      select * into v_row from public.finance_driver_days where client_key = v_client_key;
      v_have := found;
    end if;
    if not v_have then
      insert into public.finance_driver_days (
        activity_date, driver_id, driver_name, source_name,
        income_gbp, salary_gbp, diesel_gbp, other_gbp, other_description,
        client_key, created_by
      ) values (
        v_date, v_driver_id, v_driver_name, v_source,
        v_income, v_salary, v_diesel, v_other, v_other_text,
        v_client_key, auth.uid()
      )
      returning * into v_row;
    end if;
  end if;

  if v_source <> '' then
    perform public.finance_remember_source(v_source);
  end if;

  return jsonb_build_object('ok', true, 'driver_day', public.finance_driver_day_json(v_row));
exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'finance_driver_days_client_key_key' and v_client_key is not null then
      select * into v_row from public.finance_driver_days where client_key = v_client_key;
      if found then
        return jsonb_build_object('ok', true, 'driver_day', public.finance_driver_day_json(v_row));
      end if;
    end if;
    if v_constraint = 'finance_drivers_name_key_key' then
      raise exception 'A driver with that name already exists.';
    end if;
    raise exception 'This driver is already on that day.';
end;
$$;

create or replace function public.finance_delete_driver_day(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_found uuid;
begin
  perform public.finance_guard(p_token);
  delete from public.finance_driver_days where id = p_id returning id into v_found;
  if v_found is null then
    raise exception 'That driver record was not found.';
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.finance_set_deduction(p_token text, p_percent numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_percent numeric;
begin
  perform public.finance_guard(p_token);
  if p_percent is null or p_percent < 0 or p_percent > 100 then
    raise exception 'Enter a deduction from 0 to 100.';
  end if;
  v_percent := round(p_percent, 2);

  insert into public.finance_settings (id, deduction_percent)
  values ('default', v_percent)
  on conflict (id) do update
    set deduction_percent = excluded.deduction_percent,
        updated_at = now();

  return jsonb_build_object('ok', true, 'deduction_percent', v_percent);
end;
$$;

create or replace function public.finance_list(p_token text, p_from date, p_to date)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_from date := p_from;
  v_to date := p_to;
  v_percent numeric;
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

  select s.deduction_percent into v_percent
  from public.finance_settings s
  where s.id = 'default';
  v_percent := coalesce(v_percent, 25);

  return jsonb_build_object(
    'ok', true,
    'deduction_percent', v_percent,
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
    'drivers', coalesce((
      select jsonb_agg(public.finance_driver_json(d) order by (d.archived_at is not null), d.name)
      from public.finance_drivers d
    ), '[]'::jsonb),
    'driver_days', coalesce((
      select jsonb_agg(public.finance_driver_day_json(d) order by d.activity_date desc, d.driver_name)
      from public.finance_driver_days d
      where d.activity_date between v_from and v_to
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

-- Additional expenses may omit the description. Existing rows are unchanged.
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
  v_description := left(btrim(coalesce(p_payload->>'description', '')), 500);
  v_payee := public.finance_clean_name(p_payload->>'payee_name');
  v_path := nullif(btrim(coalesce(p_payload->>'receipt_path', '')), '');
  v_file := nullif(left(btrim(coalesce(p_payload->>'receipt_name', '')), 180), '');
  v_client_key := nullif(btrim(coalesce(p_payload->>'client_key', '')), '');

  if char_length(v_description) > 500 then
    raise exception 'Enter a description up to 500 characters.';
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

revoke all on function public.finance_parse_nonneg(text) from public, anon, authenticated;
revoke all on function public.finance_driver_json(public.finance_drivers) from public, anon, authenticated;
revoke all on function public.finance_driver_day_json(public.finance_driver_days) from public, anon, authenticated;

revoke all on function public.finance_save_driver(text, jsonb) from public, anon;
grant execute on function public.finance_save_driver(text, jsonb) to authenticated, service_role;

revoke all on function public.finance_set_driver_archived(text, uuid, boolean) from public, anon;
grant execute on function public.finance_set_driver_archived(text, uuid, boolean) to authenticated, service_role;

revoke all on function public.finance_save_driver_day(text, jsonb) from public, anon;
grant execute on function public.finance_save_driver_day(text, jsonb) to authenticated, service_role;

revoke all on function public.finance_delete_driver_day(text, uuid) from public, anon;
grant execute on function public.finance_delete_driver_day(text, uuid) to authenticated, service_role;

revoke all on function public.finance_set_deduction(text, numeric) from public, anon;
grant execute on function public.finance_set_deduction(text, numeric) to authenticated, service_role;
