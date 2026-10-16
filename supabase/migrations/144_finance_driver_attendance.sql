-- Attendance is stored per finance driver and date.
-- Not set means no attendance choice. It is not the same as Did not work.
-- Existing daily records were entered as worked days, including days with £0 income.

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'finance_driver_days'
      and column_name = 'attendance'
  ) then
    alter table public.finance_driver_days add column attendance text;
    update public.finance_driver_days set attendance = 'worked' where attendance is null;
  end if;
end $$;

alter table public.finance_driver_days
  drop constraint if exists finance_driver_days_attendance_check;

alter table public.finance_driver_days
  add constraint finance_driver_days_attendance_check
  check (attendance is null or attendance in ('worked', 'absent'));

comment on column public.finance_driver_days.attendance is
  'worked or absent for this driver and date. Null means attendance was not set. Did not work stores absent and zero amounts.';

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
    'attendance', case
      when p_row.attendance = 'absent' then 'absent'
      when p_row.attendance = 'worked' then 'worked'
      else 'not_set'
    end,
    'created_at', p_row.created_at,
    'updated_at', p_row.updated_at
  );
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
  v_attendance text;
  v_client_key text;
  v_id_text text;
  v_driver_text text;
  v_new_name text;
  v_key text;
  v_row public.finance_driver_days;
  v_saved boolean := false;
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

  if p_payload ? 'attendance' then
    v_attendance := nullif(lower(btrim(coalesce(p_payload->>'attendance', ''))), '');
    if v_attendance = 'not_set' then
      v_attendance := null;
    elsif v_attendance is not null and v_attendance not in ('worked', 'absent') then
      raise exception 'Choose Worked or Did not work.';
    end if;
  else
    v_attendance := 'worked';
  end if;

  if v_attendance = 'absent' then
    v_source := '';
    v_income := 0;
    v_salary := 0;
    v_diesel := 0;
    v_other := 0;
    v_other_text := '';
  elsif v_other > 0 and v_other_text = '' then
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
    v_new_name := public.finance_clean_name(coalesce(p_payload->>'new_driver_name', p_payload->>'driver_name'));
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

  -- Amounts and attendance are taken only from this request. Another date is never copied.
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
        other_description = v_other_text,
        attendance = v_attendance
    where id = v_id_text::uuid
    returning * into v_row;
    if not found then
      raise exception 'That driver record was not found.';
    end if;
  else
    if v_client_key is not null then
      update public.finance_driver_days
      set activity_date = v_date,
          driver_id = v_driver_id,
          driver_name = v_driver_name,
          source_name = v_source,
          income_gbp = v_income,
          salary_gbp = v_salary,
          diesel_gbp = v_diesel,
          other_gbp = v_other,
          other_description = v_other_text,
          attendance = v_attendance
      where client_key = v_client_key
      returning * into v_row;
      v_saved := found;
    end if;
    if not v_saved then
      insert into public.finance_driver_days (
        activity_date, driver_id, driver_name, source_name,
        income_gbp, salary_gbp, diesel_gbp, other_gbp, other_description,
        attendance, client_key, created_by
      ) values (
        v_date, v_driver_id, v_driver_name, v_source,
        v_income, v_salary, v_diesel, v_other, v_other_text,
        v_attendance, v_client_key, auth.uid()
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
    if v_constraint = 'finance_driver_days_activity_date_driver_id_key' then
      update public.finance_driver_days
      set driver_name = v_driver_name,
          source_name = v_source,
          income_gbp = v_income,
          salary_gbp = v_salary,
          diesel_gbp = v_diesel,
          other_gbp = v_other,
          other_description = v_other_text,
          attendance = v_attendance,
          client_key = coalesce(v_client_key, client_key)
      where activity_date = v_date
        and driver_id = v_driver_id
      returning * into v_row;
      if found then
        return jsonb_build_object('ok', true, 'driver_day', public.finance_driver_day_json(v_row));
      end if;
    end if;
    if v_constraint = 'finance_driver_days_client_key_key' and v_client_key is not null then
      update public.finance_driver_days
      set activity_date = v_date,
          driver_id = v_driver_id,
          driver_name = v_driver_name,
          source_name = v_source,
          income_gbp = v_income,
          salary_gbp = v_salary,
          diesel_gbp = v_diesel,
          other_gbp = v_other,
          other_description = v_other_text,
          attendance = v_attendance
      where client_key = v_client_key
      returning * into v_row;
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
