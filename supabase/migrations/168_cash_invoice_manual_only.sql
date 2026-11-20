-- Cash invoice email is sent only when an admin presses the button.
-- Collecting cash still updates the balance. It does not queue an email.

begin;

drop trigger if exists trg_enqueue_cash_paid_invoice on public.driver_collected_payments;

commit;
