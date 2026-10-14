-- Call notes and callback reminders on customer leads. Does not change bookings or payment.

begin;

alter table public.customer_leads
  add column if not exists called_at timestamptz,
  add column if not exists call_note text,
  add column if not exists callback_at timestamptz,
  add column if not exists callback_dismissed_at timestamptz;

create index if not exists customer_leads_callback_at_idx
  on public.customer_leads (callback_at)
  where callback_at is not null and deleted_at is null;

comment on column public.customer_leads.called_at is
  'When an admin last marked this lead as called.';
comment on column public.customer_leads.call_note is
  'What the customer said on the last call.';
comment on column public.customer_leads.callback_at is
  'When to call the customer again. The admin list shows a notice once this time is reached.';
comment on column public.customer_leads.callback_dismissed_at is
  'When the admin closed the callback notice. A later callback_at shows the notice again.';

commit;
