-- Track post-payment confirmation email (sent once via stripe-webhook).

begin;

alter table public.extra_charge_requests
  add column if not exists paid_confirmation_email_sent_at timestamptz,
  add column if not exists paid_confirmation_email_intent_id text;

comment on column public.extra_charge_requests.paid_confirmation_email_sent_at is
  'When customer received paid confirmation email (items + amount) after Stripe payment.';
comment on column public.extra_charge_requests.paid_confirmation_email_intent_id is
  'Payment intent id used for idempotent paid confirmation email.';

commit;
