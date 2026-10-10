-- Move timeline: keep the original driver event, and store when it happened
-- separately from when the server received it. Missing old fields stay null.

alter table public.job_status_history
  add column if not exists occurred_at timestamptz,
  add column if not exists source text,
  add column if not exists stop_type text,
  add column if not exists corrects_event_id uuid,
  add column if not exists correction_reason text,
  add column if not exists actor_name text,
  add column if not exists accuracy_m double precision,
  add column if not exists notes text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'job_status_history_source_check'
      and conrelid = 'public.job_status_history'::regclass
  ) then
    alter table public.job_status_history
      add constraint job_status_history_source_check
      check (source is null or source in ('manual', 'gps'));
  end if;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'job_status_history_corrects_event_id_fkey'
      and conrelid = 'public.job_status_history'::regclass
  ) then
    alter table public.job_status_history
      add constraint job_status_history_corrects_event_id_fkey
      foreign key (corrects_event_id) references public.job_status_history (id);
  end if;
exception
  when duplicate_object then null;
end $$;

comment on column public.job_status_history.occurred_at is
  'When the driver action happened on the device. Null on older rows.';
comment on column public.job_status_history.created_at is
  'When the server stored the row. Kept even if the device synced later.';
comment on column public.job_status_history.source is
  'manual = driver button. gps = arrival confirmed from a GPS fix. Null if not stored.';

drop policy if exists "Drivers insert own job status history" on public.job_status_history;
create policy "Drivers insert own job status history"
  on public.job_status_history
  for insert
  to authenticated
  with check (
    public.auth_is_driver_session()
    and driver_id = public.auth_driver_id()
    and (
      quote_id is null
      or public.driver_has_quote_assignment(quote_id)
    )
    and lower(trim(status)) in (
      'on_way',
      'in_progress',
      'arrived',
      'arrived_pickup',
      'arrived_delivery',
      'pickup_completed',
      'loaded',
      'loading_started',
      'unloading_completed',
      'in_transit',
      'completed',
      'cancelled',
      'gps',
      'location',
      'started',
      'start',
      'available_location',
      'active_job_location',
      'customer_not_available',
      'unable_to_contact'
    )
  );

create or replace function public.public_get_job_move_timeline(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_quote_id uuid;
begin
  if p_token is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  select t.quote_id
    into v_quote_id
  from public.job_tracking_tokens t
  where t.token = p_token
    and t.revoked_at is null
    and t.expires_at >= now()
  limit 1;

  if v_quote_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  return jsonb_build_object(
    'ok', true,
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', h.id,
        'status', h.status,
        'occurred_at', h.occurred_at,
        'created_at', h.created_at,
        'source', h.source,
        'stop_type', h.stop_type,
        'latitude', h.latitude,
        'longitude', h.longitude,
        'accuracy_m', h.accuracy_m,
        'notes', h.notes,
        'driver_id', h.driver_id,
        'driver_name', coalesce(nullif(trim(h.driver_name), ''), nullif(trim(d.full_name), '')),
        'corrects_event_id', h.corrects_event_id,
        'correction_reason', h.correction_reason,
        'actor_name', h.actor_name
      ) order by coalesce(h.occurred_at, h.created_at), h.created_at)
      from public.job_status_history h
      left join public.drivers d on d.id = h.driver_id
      where h.quote_id = v_quote_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.public_get_job_move_timeline(uuid) from public;
grant execute on function public.public_get_job_move_timeline(uuid) to anon, authenticated, service_role;
