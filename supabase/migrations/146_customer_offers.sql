-- Customer "Make an offer" negotiation, stored against a quote snapshot.
-- Customers write only through the customer-offer Edge Function (service role).

alter table public.customer_leads
  add column if not exists pending_offer boolean not null default false;

comment on column public.customer_leads.pending_offer is
  'True when this lead has an offer waiting on admin or on the customer.';

create table if not exists public.customer_offers (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.customer_leads(id) on delete set null,
  quote_ref text,
  session_id text,
  status text not null default 'pending',
  original_total numeric not null,
  proposed_amount numeric not null,
  agreed_amount numeric,
  counter_amount numeric,
  message text,
  date_flexibility text,
  customer_name text,
  customer_phone text,
  customer_email text,
  move_snapshot jsonb not null default '{}'::jsonb,
  quote_lead jsonb not null default '{}'::jsonb,
  snapshot_hash text not null,
  history jsonb not null default '[]'::jsonb,
  view_token text not null,
  expires_at timestamptz not null,
  active_payment_intent_id text,
  booked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_offers_status_check check (
    status in (
      'pending',
      'accepted',
      'declined',
      'countered',
      'counter_accepted',
      'counter_declined',
      'expired',
      'superseded',
      'booked'
    )
  ),
  constraint customer_offers_amounts_check check (
    original_total >= 0
    and proposed_amount > 0
    and (agreed_amount is null or agreed_amount > 0)
    and (counter_amount is null or counter_amount > 0)
  )
);

create unique index if not exists customer_offers_view_token_key
  on public.customer_offers (view_token);

create index if not exists customer_offers_lead_id_idx
  on public.customer_offers (lead_id, created_at desc);

create index if not exists customer_offers_status_idx
  on public.customer_offers (status, expires_at);

comment on table public.customer_offers is
  'Customer budget offers for one snapshotted move. Agreed prices are read back on the server at checkout.';

alter table public.customer_offers enable row level security;

drop policy if exists customer_offers_admin_select on public.customer_offers;
create policy customer_offers_admin_select
  on public.customer_offers
  for select
  to authenticated
  using (public.auth_is_admin_session());

revoke all on table public.customer_offers from public, anon, authenticated;
grant select on table public.customer_offers to authenticated;
