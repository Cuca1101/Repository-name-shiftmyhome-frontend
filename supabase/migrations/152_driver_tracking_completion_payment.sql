-- Stale GPS must not replace a newer live position.
-- A completed booking must not be reopened by a late Start or Arrived history row.
-- Drivers can record a collected payment and checklist ticks without editing
-- pricing, Stripe, or the rest of the quote.

begin;

create or replace function public.driver_locations_keep_newer_sample()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and old.sampled_at is not null
     and new.sampled_at is not null
     and new.sampled_at < old.sampled_at then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists zzz_driver_locations_keep_newer_sample on public.driver_locations;
create trigger zzz_driver_locations_keep_newer_sample
  before update on public.driver_locations
  for each row
  execute function public.driver_locations_keep_newer_sample();

create or replace function public.job_status_history_block_stale_reopen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quotes%rowtype;
  s text;
begin
  if public.auth_is_admin_session() then
    return new;
  end if;

  s := lower(trim(coalesce(new.status, '')));
  if s in (
    'gps',
    'location',
    'available_location',
    'active_job_location',
    'correction',
    'note',
    'contact'
  ) then
    return new;
  end if;

  if new.quote_id is null then
    return new;
  end if;

  select * into q from public.quotes where id = new.quote_id;
  if not found then
    return new;
  end if;

  if public.quote_row_is_completed(q.status, q.operational_status, q.completed_at)
     and s is distinct from 'completed' then
    raise exception 'completed_job_locked'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists job_status_history_block_stale_reopen on public.job_status_history;
create trigger job_status_history_block_stale_reopen
  before insert on public.job_status_history
  for each row
  execute function public.job_status_history_block_stale_reopen();

create table if not exists public.driver_collected_payments (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  driver_id uuid not null references public.drivers (id) on delete cascade,
  amount numeric not null check (amount > 0),
  method text not null check (method in ('cash', 'card', 'bank_transfer')),
  collected_at timestamptz not null default now(),
  idempotency_key text not null unique,
  outstanding_after numeric not null
);

alter table public.driver_collected_payments enable row level security;

drop policy if exists driver_collected_payments_select_own on public.driver_collected_payments;
create policy driver_collected_payments_select_own
  on public.driver_collected_payments
  for select
  to authenticated
  using (driver_id = public.auth_driver_id() or public.auth_is_admin_session());

grant select on public.driver_collected_payments to authenticated;

create or replace function public.quotes_guard_driver_column_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.auth_is_admin_session() or not public.auth_is_driver_session() then
    return new;
  end if;

  if old.id is distinct from new.id or old.quote_ref is distinct from new.quote_ref then
    raise exception 'Driver cannot change quote identity';
  end if;

  if old.assigned_driver_id is distinct from new.assigned_driver_id
    or old.assigned_driver_name is distinct from new.assigned_driver_name
    or old.assigned_partner_id is distinct from new.assigned_partner_id
    or old.assigned_partner_company is distinct from new.assigned_partner_company
    or old.assigned_at is distinct from new.assigned_at
    or old.assigned_by is distinct from new.assigned_by
  then
    raise exception 'Driver cannot change assignment fields';
  end if;

  if coalesce(current_setting('smh.driver_collect_payment', true), '') is distinct from 'on'
     and (
       old.estimated_total is distinct from new.estimated_total
       or old.amount_paid is distinct from new.amount_paid
       or old.remaining_balance is distinct from new.remaining_balance
       or old.pricing is distinct from new.pricing
       or old.payment_status is distinct from new.payment_status
       or old.payment_type is distinct from new.payment_type
       or old.paid_at is distinct from new.paid_at
       or old.stripe_session_id is distinct from new.stripe_session_id
       or old.stripe_payment_intent_id is distinct from new.stripe_payment_intent_id
       or old.marketplace_payout_price is distinct from new.marketplace_payout_price
       or old.marketplace_visibility is distinct from new.marketplace_visibility
       or old.driver_payout_amount is distinct from new.driver_payout_amount
       or old.partner_payout_amount is distinct from new.partner_payout_amount
       or old.platform_profit_amount is distinct from new.platform_profit_amount
       or old.platform_margin_percent is distinct from new.platform_margin_percent
       or old.payout_status is distinct from new.payout_status
       or old.payout_notes is distinct from new.payout_notes
       or old.payout_paid_amount is distinct from new.payout_paid_amount
       or old.payout_paid_at is distinct from new.payout_paid_at
       or old.admin_notes_log is distinct from new.admin_notes_log
       or old.admin_completion_note is distinct from new.admin_completion_note
       or old.admin_cancellation_reason is distinct from new.admin_cancellation_reason
       or old.bundled_journey_id is distinct from new.bundled_journey_id
       or old.partner_dashboard_hidden is distinct from new.partner_dashboard_hidden
     )
  then
    raise exception 'Driver cannot change pricing, payment, or admin fields';
  end if;

  if new.operational_status is distinct from old.operational_status
     and lower(trim(coalesce(new.operational_status, ''))) not in (
       'assigned',
       'in_progress',
       'in progress',
       'on way',
       'on_way',
       'arrived',
       'in transit',
       'in_transit',
       'completed',
       'cancelled',
       'left for collection',
       'at collection',
       'loading',
       'items collected',
       'collection finished',
       'left for delivery',
       'at delivery',
       'unloading',
       ''
     ) then
    raise exception 'Driver operational_status must be a workflow status';
  end if;

  return new;
end;
$$;

create or replace function public.record_driver_collected_payment(
  p_quote_id uuid,
  p_amount numeric,
  p_method text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver uuid;
  v_existing public.driver_collected_payments%rowtype;
  v_quote public.quotes%rowtype;
  v_total numeric;
  v_paid numeric;
  v_outstanding numeric;
  v_next_paid numeric;
  v_next_outstanding numeric;
  v_status text;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 then
    return jsonb_build_object('ok', false, 'error', 'Missing idempotency key');
  end if;
  if p_method not in ('cash', 'card', 'bank_transfer') then
    return jsonb_build_object('ok', false, 'error', 'Unknown payment method');
  end if;
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'error', 'Amount must be greater than zero');
  end if;

  v_driver := public.auth_driver_id();
  if v_driver is null then
    return jsonb_build_object('ok', false, 'error', 'No driver profile');
  end if;
  if not public.driver_has_quote_assignment(p_quote_id) then
    return jsonb_build_object('ok', false, 'error', 'This job is not assigned to you');
  end if;

  select * into v_existing
  from public.driver_collected_payments
  where idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'id', v_existing.id,
      'amount_paid', v_existing.amount,
      'outstanding', v_existing.outstanding_after,
      'payment_status', 'recorded'
    );
  end if;

  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Booking not found');
  end if;

  v_total := greatest(
    coalesce(v_quote.agreed_price, 0),
    coalesce(v_quote.estimated_total, 0),
    coalesce(v_quote.calculated_total, 0)
  );
  v_paid := coalesce(v_quote.amount_paid, 0);
  if v_quote.remaining_balance is not null and v_quote.remaining_balance >= 0 then
    v_outstanding := v_quote.remaining_balance;
  else
    v_outstanding := greatest(0, v_total - v_paid);
  end if;

  if p_amount > v_outstanding + 0.05 then
    return jsonb_build_object('ok', false, 'error', 'Amount is more than the outstanding balance');
  end if;

  v_next_paid := round((v_paid + p_amount)::numeric, 2);
  v_next_outstanding := round(greatest(0, v_outstanding - p_amount)::numeric, 2);
  -- payment_status paid/deposit_paid is the online-payment inbox. Cash or
  -- bank collected by the driver updates the balance columns only. Clearing
  -- the remainder of an online deposit may become paid, because that booking
  -- was already in the paid lists.
  v_status := v_quote.payment_status;
  if v_next_outstanding <= 0.009
     and (
       lower(coalesce(v_quote.payment_status, '')) in ('paid', 'deposit_paid')
       or coalesce(v_quote.stripe_payment_intent_id, '') <> ''
       or coalesce(v_quote.stripe_session_id, '') <> ''
     ) then
    v_status := 'paid';
  end if;

  insert into public.driver_collected_payments (
    quote_id, driver_id, amount, method, idempotency_key, outstanding_after
  ) values (
    p_quote_id, v_driver, round(p_amount, 2), p_method, p_idempotency_key, v_next_outstanding
  );

  perform set_config('smh.driver_collect_payment', 'on', true);
  update public.quotes
  set amount_paid = v_next_paid,
      remaining_balance = v_next_outstanding,
      payment_status = v_status,
      payment_type = case
        when v_quote.payment_type is null
          or btrim(v_quote.payment_type) = ''
          or lower(btrim(v_quote.payment_type)) in ('cash', 'card', 'bank_transfer')
          then p_method
        else v_quote.payment_type
      end,
      paid_at = case
        when v_status = 'paid' and v_quote.payment_status is distinct from 'paid' and paid_at is null then now()
        else paid_at
      end
  where id = p_quote_id;

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'amount_paid', v_next_paid,
    'outstanding', v_next_outstanding,
    'payment_status', v_status
  );
exception
  when unique_violation then
    select * into v_existing
    from public.driver_collected_payments
    where idempotency_key = p_idempotency_key;
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'id', v_existing.id,
      'outstanding', v_existing.outstanding_after,
      'payment_status', 'recorded'
    );
end;
$$;

revoke all on function public.record_driver_collected_payment(uuid, numeric, text, text) from public;
grant execute on function public.record_driver_collected_payment(uuid, numeric, text, text) to authenticated;

alter table public.quote_inventory_items
  add column if not exists driver_loaded boolean not null default false,
  add column if not exists driver_unloaded boolean not null default false;

create or replace function public.set_driver_inventory_tick(
  p_quote_id uuid,
  p_item_id uuid,
  p_loaded boolean,
  p_unloaded boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.auth_driver_id() is null then
    raise exception 'No driver profile';
  end if;
  if not public.driver_has_quote_assignment(p_quote_id) then
    raise exception 'This job is not assigned to you';
  end if;

  update public.quote_inventory_items
  set driver_loaded = coalesce(p_loaded, false),
      driver_unloaded = coalesce(p_unloaded, false)
  where id = p_item_id
    and quote_id = p_quote_id;

  if not found then
    raise exception 'Inventory item not found';
  end if;
end;
$$;

revoke all on function public.set_driver_inventory_tick(uuid, uuid, boolean, boolean) from public;
grant execute on function public.set_driver_inventory_tick(uuid, uuid, boolean, boolean) to authenticated;

commit;
