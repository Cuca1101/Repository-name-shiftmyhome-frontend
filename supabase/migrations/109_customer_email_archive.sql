-- Exact copies of customer emails and the invoice PDF that was attached.
-- Preview and download read these rows. They do not send mail or build a new invoice.

alter table public.job_customer_notifications
  add column if not exists provider_status text;

comment on column public.job_customer_notifications.provider_status is
  'Provider outcome: sent, delivered, or failed. Null on rows logged before this column. Does not replace delivery_status, which still blocks a second send.';

create table if not exists public.customer_email_archive (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  notification_id uuid references public.job_customer_notifications(id) on delete set null,
  event_key text not null,
  subject text,
  recipient_email text,
  html_snapshot text,
  text_snapshot text,
  provider_message_id text,
  provider_status text,
  invoice_bucket text,
  invoice_path text,
  invoice_filename text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists customer_email_archive_quote_idx
  on public.customer_email_archive (quote_id, sent_at desc);

create index if not exists customer_email_archive_provider_idx
  on public.customer_email_archive (provider_message_id)
  where provider_message_id is not null;

alter table public.customer_email_archive enable row level security;

drop policy if exists "customer_email_archive_select_admin" on public.customer_email_archive;
create policy "customer_email_archive_select_admin"
  on public.customer_email_archive
  for select
  to authenticated
  using (public.auth_is_admin_session());

grant select on table public.customer_email_archive to authenticated;
grant all on table public.customer_email_archive to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'booking-invoices',
  'booking-invoices',
  false,
  10485760,
  array['application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
