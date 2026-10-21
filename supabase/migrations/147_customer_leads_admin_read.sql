-- Unread Customer Leads for the admin nav badge.
-- Existing rows are marked seen so the count starts with leads that arrive after this change.

alter table public.customer_leads
  add column if not exists admin_read_at timestamptz;

comment on column public.customer_leads.admin_read_at is
  'When an admin opened this lead. Null means it is still unread.';

update public.customer_leads
set admin_read_at = coalesce(admin_read_at, now())
where admin_read_at is null;

create index if not exists customer_leads_admin_unread_idx
  on public.customer_leads (created_at desc)
  where admin_read_at is null and deleted_at is null;
