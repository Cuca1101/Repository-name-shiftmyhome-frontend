-- After the driver presses Start, quotes_sync_driver_workflow_status sets
-- operational_status to "On way". The column guard then rejected every later
-- driver update, including Arrive and Complete, because "On way" and
-- "In transit" were not in its allow-list. The guard runs before that sync
-- trigger, so it must allow the status already stored on the row.

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

  if old.estimated_total is distinct from new.estimated_total
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
       ''
     ) then
    raise exception 'Driver operational_status must be a workflow status';
  end if;

  return new;
end;
$$;
