-- After a new cash collection clears the balance, queue the cash invoice.
-- The confirmation function, the amount, and the driver screen stay as they are.
-- A repeated idempotency key returns before this insert, so it does not queue again.

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

commit;
