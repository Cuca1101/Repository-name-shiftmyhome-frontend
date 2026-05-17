-- Allow anonymous visitors to submit the public Quote request form (ContactSection).
-- Inserts use source = 'home_page_quote_form' (see quotesRepository.insertHomePageQuoteLead).
-- Does not grant UPDATE/DELETE or admin field writes on insert.

alter table public.quotes enable row level security;

drop policy if exists "Public can create quote requests" on public.quotes;
drop policy if exists "Public can create home page quote requests" on public.quotes;

create policy "Public can create home page quote requests"
  on public.quotes
  for insert
  to anon
  with check (
    source = 'home_page_quote_form'
    and status = 'New'
    and length(trim(coalesce(full_name, ''))) > 0
    and length(trim(coalesce(email, ''))) > 0
    and length(trim(coalesce(phone, ''))) > 0
    and length(trim(coalesce(pickup_address, ''))) > 0
    and length(trim(coalesce(delivery_address, ''))) > 0
    and length(trim(coalesce(quote_ref, ''))) > 0
    and coalesce(payment_status::text, 'unpaid') = 'unpaid'
    and assigned_driver_id is null
    and assigned_partner_id is null
    and bundled_journey_id is null
    and stripe_session_id is null
    and stripe_payment_intent_id is null
    and paid_at is null
    and amount_paid is null
    and operational_status is null
    and marketplace_visibility is null
    and marketplace_payout_price is null
    and coalesce(partner_dashboard_hidden, false) = false
    and assigned_at is null
    and assigned_by is null
    and completed_at is null
    and cancelled_at is null
  );
