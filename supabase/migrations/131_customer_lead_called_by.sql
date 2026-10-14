-- Who in admin marked a customer lead as called.

begin;

alter table public.customer_leads
  add column if not exists called_by text;

comment on column public.customer_leads.called_by is
  'Admin email that last marked this lead as called.';

commit;
