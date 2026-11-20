-- An admin can put a job completed by mistake back with the same driver
-- or another driver. The booking, payment and earlier history stay.
-- A cancelled booking stays cancelled. A driver cannot reopen it.

begin;

do $$
declare
  r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'driver_workflow_resets'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%reason%'
  loop
    execute format('alter table public.driver_workflow_resets drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.driver_workflow_resets
  add constraint driver_workflow_resets_reason_check
  check (reason in ('manual', 'reassignment', 'unassign', 'reopen'));

alter table public.job_assignments drop constraint if exists job_assignments_workflow_reset_kind_check;
alter table public.job_assignments
  add constraint job_assignments_workflow_reset_kind_check
  check (
    workflow_reset_kind is null
    or workflow_reset_kind in ('manual', 'reassignment', 'unassign', 'reopen')
  );

create or replace function public.reopen_completed_driver_job(
  p_quote_id uuid,
  p_driver_id uuid default null,
  p_actor text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes%rowtype;
  v_asg public.job_assignments%rowtype;
  v_has_asg boolean := false;
  v_actor text;
  v_version integer;
  v_driver uuid;
  v_prior_driver uuid;
begin
  if not public.auth_is_admin_session() then
    return jsonb_build_object('ok', false, 'error', 'not_authorised');
  end if;
  if p_quote_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_quote');
  end if;

  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_quote.cancelled_at is not null
     or lower(trim(coalesce(v_quote.status, ''))) = 'cancelled'
     or lower(trim(coalesce(v_quote.operational_status, ''))) = 'cancelled' then
    return jsonb_build_object('ok', false, 'error', 'cancelled');
  end if;

  if not public.quote_row_is_completed(v_quote.status, v_quote.operational_status, v_quote.completed_at) then
    return jsonb_build_object('ok', false, 'error', 'not_completed');
  end if;

  select * into v_asg from public.job_assignments where quote_id = p_quote_id for update;
  v_has_asg := found;
  v_prior_driver := case when v_has_asg then v_asg.driver_id else v_quote.assigned_driver_id end;
  v_driver := coalesce(p_driver_id, v_prior_driver);
  if v_driver is null then
    return jsonb_build_object('ok', false, 'error', 'missing_driver');
  end if;

  v_version := coalesce(v_quote.workflow_version, 1) + 1;
  v_actor := coalesce(
    nullif(trim(coalesce(p_actor, '')), ''),
    nullif(trim(coalesce(auth.jwt() ->> 'email', '')), ''),
    auth.uid()::text
  );

  update public.quote_inventory_items
  set driver_loaded = false,
      driver_unloaded = false
  where quote_id = p_quote_id;

  update public.quotes
  set workflow_version = v_version,
      claimed_workflow_version = null,
      workflow_reset_at = now(),
      workflow_reset_by = v_actor,
      workflow_reset_reason = 'reopen',
      status = 'Booked',
      operational_status = 'Assigned',
      completed_at = null,
      assigned_driver_id = v_driver,
      marketplace_visibility = 'assigned'
  where id = p_quote_id;

  if v_has_asg then
    update public.job_assignments
    set workflow_version = v_version,
        claimed_workflow_version = null,
        workflow_reset_kind = 'reopen',
        driver_id = v_driver,
        status = 'active',
        completed_at = null,
        updated_at = now()
    where quote_id = p_quote_id;
  else
    insert into public.job_assignments (
      quote_id, driver_id, status, workflow_version, completed_at, scheduled_date, updated_at
    ) values (
      p_quote_id, v_driver, 'active', v_version, null, now(), now()
    );
  end if;

  insert into public.driver_workflow_resets (
    quote_id, previous_version, workflow_version, reason, actor_label, actor_user_id, driver_id
  ) values (
    p_quote_id,
    v_version - 1,
    v_version,
    'reopen',
    v_actor,
    auth.uid(),
    v_driver
  );

  return jsonb_build_object(
    'ok', true,
    'workflow_version', v_version,
    'prior_driver_id', v_prior_driver,
    'driver_id', v_driver,
    'error', null
  );
end;
$$;

revoke all on function public.reopen_completed_driver_job(uuid, uuid, text) from public;
grant execute on function public.reopen_completed_driver_job(uuid, uuid, text) to authenticated;

commit;
