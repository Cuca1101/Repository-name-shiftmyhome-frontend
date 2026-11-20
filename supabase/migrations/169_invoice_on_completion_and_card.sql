-- Cash invoice: only after the job is already completed and the cash payment clears the balance.
-- Card invoice: when a card collection brings the balance to zero.
-- Stripe card payments are emailed by the payment webhook and are not queued here.

begin;

create or replace function public.enqueue_cash_paid_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.method is distinct from 'cash' then
    return new;
  end if;
  if coalesce(new.outstanding_after, 0) > 0.009 then
    return new;
  end if;
  if not exists (
    select 1
    from public.quotes q
    where q.id = new.quote_id
      and (
        q.completed_at is not null
        or lower(coalesce(q.status, '')) = 'completed'
        or lower(coalesce(q.operational_status, '')) = 'completed'
      )
  ) then
    return new;
  end if;
  insert into public.job_customer_notify_queue (quote_id, event_key, status_raw)
  values (new.quote_id, 'cash_paid_invoice', 'cash');
  return new;
end;
$$;

drop trigger if exists trg_enqueue_cash_paid_invoice on public.driver_collected_payments;
create trigger trg_enqueue_cash_paid_invoice
  after insert on public.driver_collected_payments
  for each row
  execute function public.enqueue_cash_paid_invoice();

create or replace function public.enqueue_card_paid_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.method is distinct from 'card' then
    return new;
  end if;
  if coalesce(new.outstanding_after, 0) > 0.009 then
    return new;
  end if;
  insert into public.job_customer_notify_queue (quote_id, event_key, status_raw)
  values (new.quote_id, 'card_paid_invoice', 'card');
  return new;
end;
$$;

drop trigger if exists trg_enqueue_card_paid_invoice on public.driver_collected_payments;
create trigger trg_enqueue_card_paid_invoice
  after insert on public.driver_collected_payments
  for each row
  execute function public.enqueue_card_paid_invoice();

commit;
