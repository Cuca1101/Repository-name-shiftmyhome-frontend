/* Migration 085: public schema RLS hardening (Supabase Security Advisor).
   Run this entire file in Supabase SQL Editor. First executable line must be "begin;" below.
   Do NOT paste from markdown chat (single "-" bullets are not SQL comments).
   After apply: supabase/scripts/public-schema-rls-audit.sql */

begin;

-- =============================================================================
-- 1) Enable RLS on every public heap table that lacks it
-- =============================================================================
do $$
declare
  r record;
begin
  for r in
    select c.relname as tablename
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and not c.relrowsecurity
  loop
    execute format('alter table public.%I enable row level security', r.tablename);
    raise notice 'RLS enabled on public.%', r.tablename;
  end loop;
end $$;

-- =============================================================================
-- 2) admin_config_secrets - RLS on, no client policies (RPC-only via SECURITY DEFINER)
-- =============================================================================
alter table public.admin_config_secrets enable row level security;

revoke all on table public.admin_config_secrets from anon;
revoke all on table public.admin_config_secrets from authenticated;

comment on table public.admin_config_secrets is
  'PIN hashes. RLS enabled with zero client policies; verify_marketplace_settings_pin() only.';

-- =============================================================================
-- 3) Drop permissive policies (USING/WITH CHECK true) that bypass role scoping
-- =============================================================================

-- extra_charge_requests (052 left OR-policies alongside 067 driver policies)
drop policy if exists "Authenticated read extra charge requests" on public.extra_charge_requests;
drop policy if exists "Authenticated insert extra charge requests" on public.extra_charge_requests;
drop policy if exists "Authenticated update extra charge requests" on public.extra_charge_requests;
drop policy if exists "Anon insert extra charge requests" on public.extra_charge_requests;
drop policy if exists "Anon read extra charge requests" on public.extra_charge_requests;

-- driver_charges / driver_documents / audit logs
drop policy if exists "Authenticated read driver charges" on public.driver_charges;
drop policy if exists "Authenticated insert driver charges" on public.driver_charges;
drop policy if exists "Authenticated update driver charges" on public.driver_charges;

drop policy if exists "Authenticated read driver documents" on public.driver_documents;
drop policy if exists "Authenticated insert driver documents" on public.driver_documents;
drop policy if exists "Authenticated update driver documents" on public.driver_documents;
drop policy if exists "Authenticated delete driver documents" on public.driver_documents;

drop policy if exists "Authenticated read driver payout audit" on public.driver_payout_audit_log;
drop policy if exists "Authenticated insert driver payout audit" on public.driver_payout_audit_log;

drop policy if exists "Authenticated read journey payout audit" on public.journey_payout_audit_log;
drop policy if exists "Authenticated insert journey payout audit" on public.journey_payout_audit_log;

-- seo_settings
drop policy if exists "seo_settings_select_authenticated" on public.seo_settings;
drop policy if exists "seo_settings_insert_authenticated" on public.seo_settings;
drop policy if exists "seo_settings_update_authenticated" on public.seo_settings;
drop policy if exists "seo_settings_delete_authenticated" on public.seo_settings;

-- job_photos - broad authenticated policies (driver/admin policies remain from 062/068)
drop policy if exists "Authenticated read job photos" on public.job_photos;
drop policy if exists "Authenticated insert job photos" on public.job_photos;

-- website funnel analytics
drop policy if exists "website_events_select_authenticated" on public.website_events;

-- =============================================================================
-- 4) Admin-session helper policies (reusable pattern)
-- =============================================================================

-- extra_charge_requests - admin full access (067 driver policies retained)
drop policy if exists "Admin session manage extra charge requests" on public.extra_charge_requests;
create policy "Admin session manage extra charge requests"
  on public.extra_charge_requests
  for all
  to authenticated
  using (public.auth_is_admin_session())
  with check (public.auth_is_admin_session());

-- driver_charges
drop policy if exists "Admin session manage driver charges" on public.driver_charges;
create policy "Admin session manage driver charges"
  on public.driver_charges
  for all
  to authenticated
  using (public.auth_is_admin_session())
  with check (public.auth_is_admin_session());

-- driver_documents
drop policy if exists "Admin session manage driver documents" on public.driver_documents;
create policy "Admin session manage driver documents"
  on public.driver_documents
  for all
  to authenticated
  using (public.auth_is_admin_session())
  with check (public.auth_is_admin_session());

-- payout audit logs
drop policy if exists "Admin session read driver payout audit" on public.driver_payout_audit_log;
create policy "Admin session read driver payout audit"
  on public.driver_payout_audit_log
  for select
  to authenticated
  using (public.auth_is_admin_session());

drop policy if exists "Admin session insert driver payout audit" on public.driver_payout_audit_log;
create policy "Admin session insert driver payout audit"
  on public.driver_payout_audit_log
  for insert
  to authenticated
  with check (public.auth_is_admin_session());

drop policy if exists "Admin session read journey payout audit" on public.journey_payout_audit_log;
create policy "Admin session read journey payout audit"
  on public.journey_payout_audit_log
  for select
  to authenticated
  using (public.auth_is_admin_session());

drop policy if exists "Admin session insert journey payout audit" on public.journey_payout_audit_log;
create policy "Admin session insert journey payout audit"
  on public.journey_payout_audit_log
  for insert
  to authenticated
  with check (public.auth_is_admin_session());

-- seo_settings
drop policy if exists "Admin session manage seo settings" on public.seo_settings;
create policy "Admin session manage seo settings"
  on public.seo_settings
  for all
  to authenticated
  using (public.auth_is_admin_session())
  with check (public.auth_is_admin_session());

-- job_photos - admin full access
drop policy if exists "Admin session manage job photos" on public.job_photos;
create policy "Admin session manage job photos"
  on public.job_photos
  for all
  to authenticated
  using (public.auth_is_admin_session())
  with check (public.auth_is_admin_session());

-- website_events - admin read only (anon insert unchanged in 032)
drop policy if exists "Admin session read website events" on public.website_events;
create policy "Admin session read website events"
  on public.website_events
  for select
  to authenticated
  using (public.auth_is_admin_session());

-- =============================================================================
-- 5) Operational tables - admin-only (no anon Data API)
-- =============================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'journeys',
    'journey_stops',
    'partners',
    'quote_pricing',
    'quote_requirements',
    'quote_stops',
    'crew_options',
    'service_types',
    'proof_of_delivery',
    'admin_activity_logs'
  ]
  loop
    if exists (
      select 1 from pg_tables where schemaname = 'public' and tablename = t
    ) then
      execute format('drop policy if exists "Admin session manage %I" on public.%I', t, t);
      execute format(
        'create policy "Admin session manage %I" on public.%I for all to authenticated using (public.auth_is_admin_session()) with check (public.auth_is_admin_session())',
        t, t
      );
    end if;
  end loop;
end $$;

-- driver_live_positions (legacy name - prefer driver_locations)
do $$
begin
  if exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'driver_live_positions'
  ) then
    drop policy if exists "Admin session manage driver live positions" on public.driver_live_positions;
    create policy "Admin session manage driver live positions"
      on public.driver_live_positions
      for all
      to authenticated
      using (public.auth_is_admin_session())
      with check (public.auth_is_admin_session());
  end if;
end $$;

-- website_leads - admin only (public writes via upsert_website_lead SECURITY DEFINER)
do $$
begin
  if exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'website_leads'
  ) then
    drop policy if exists "Admin session manage website leads" on public.website_leads;
    create policy "Admin session manage website leads"
      on public.website_leads
      for all
      to authenticated
      using (public.auth_is_admin_session())
      with check (public.auth_is_admin_session());
  end if;
end $$;

-- =============================================================================
-- 6) jobs + job_items - admin CRUD; anon insert for quote wizard funnel only
-- =============================================================================
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'jobs') then
    drop policy if exists "Admin session manage jobs" on public.jobs;
    create policy "Admin session manage jobs"
      on public.jobs
      for all
      to authenticated
      using (public.auth_is_admin_session())
      with check (public.auth_is_admin_session());

    drop policy if exists "Anon insert new job requests" on public.jobs;
    create policy "Anon insert new job requests"
      on public.jobs
      for insert
      to anon
      with check (
        trim(coalesce(status, '')) in ('New', 'new')
        and length(trim(coalesce(full_name, ''))) > 0
        and length(trim(coalesce(phone, ''))) > 0
        and length(trim(coalesce(pickup_address, ''))) > 0
        and length(trim(coalesce(delivery_address, ''))) > 0
      );
  end if;

  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'job_items') then
    drop policy if exists "Admin session manage job items" on public.job_items;
    create policy "Admin session manage job items"
      on public.job_items
      for all
      to authenticated
      using (public.auth_is_admin_session())
      with check (public.auth_is_admin_session());

    drop policy if exists "Anon insert job items for new jobs" on public.job_items;
    create policy "Anon insert job items for new jobs"
      on public.job_items
      for insert
      to anon
      with check (
        exists (
          select 1
          from public.jobs j
          where j.id = job_items.job_id
            and trim(coalesce(j.status, '')) in ('New', 'new')
        )
      );
  end if;
end $$;

-- =============================================================================
-- 7) quotes - tighten authenticated delete/insert; extend anon insert for wizard
-- =============================================================================
drop policy if exists "Public can create home page quote requests" on public.quotes;
drop policy if exists "Public can create quote requests" on public.quotes;

drop policy if exists "Authenticated delete public quote leads" on public.quotes;
create policy "Authenticated delete public quote leads"
  on public.quotes
  for delete
  to authenticated
  using (
    public.auth_is_admin_session()
    and source in (
      'home_page_quote_form',
      'website',
      'public_quote_request',
      'quote_request'
    )
    and coalesce(payment_status::text, 'unpaid') = 'unpaid'
    and stripe_session_id is null
    and stripe_payment_intent_id is null
    and paid_at is null
    and amount_paid is null
  );

drop policy if exists "Authenticated insert public quote leads" on public.quotes;
create policy "Authenticated insert public quote leads"
  on public.quotes
  for insert
  to authenticated
  with check (
    public.auth_is_admin_session()
    and source in (
      'home_page_quote_form',
      'website',
      'public_quote_request',
      'quote_request'
    )
    and trim(coalesce(status, '')) in ('New', 'new')
    and length(trim(coalesce(full_name, ''))) > 0
    and length(trim(coalesce(email, ''))) > 0
    and length(trim(coalesce(phone, ''))) > 0
    and length(trim(coalesce(pickup_address, ''))) > 0
    and length(trim(coalesce(delivery_address, ''))) > 0
    and length(trim(coalesce(quote_ref, ''))) > 0
    and stripe_session_id is null
    and stripe_payment_intent_id is null
    and paid_at is null
    and amount_paid is null
    and assigned_driver_id is null
    and assigned_partner_id is null
    and bundled_journey_id is null
  );

drop policy if exists "Anon insert public quote leads" on public.quotes;
create policy "Anon insert public quote leads"
  on public.quotes
  for insert
  to anon
  with check (
    trim(coalesce(status, '')) in ('New', 'new')
    and length(trim(coalesce(full_name, ''))) > 0
    and length(trim(coalesce(email, ''))) > 0
    and length(trim(coalesce(phone, ''))) > 0
    and length(trim(coalesce(pickup_address, ''))) > 0
    and length(trim(coalesce(delivery_address, ''))) > 0
    and length(trim(coalesce(quote_ref, ''))) > 0
    and stripe_session_id is null
    and stripe_payment_intent_id is null
    and paid_at is null
    and amount_paid is null
    and assigned_driver_id is null
    and assigned_partner_id is null
    and bundled_journey_id is null
    and (
      source is null
      or source in (
        'home_page_quote_form',
        'website',
        'public_quote_request',
        'quote_request',
        'quote_wizard',
        'wizard'
      )
    )
  );

-- =============================================================================
-- 8) items_library - public catalogue read; admin write
-- =============================================================================
drop policy if exists "Anon read items library" on public.items_library;
create policy "Anon read items library"
  on public.items_library
  for select
  to anon
  using (true);

drop policy if exists "Admin session manage items library" on public.items_library;
create policy "Admin session manage items library"
  on public.items_library
  for all
  to authenticated
  using (public.auth_is_admin_session())
  with check (public.auth_is_admin_session());

-- Drivers read items library (064) - keep driver OR admin read via separate policy
drop policy if exists "Drivers read items library" on public.items_library;
create policy "Drivers read items library"
  on public.items_library
  for select
  to authenticated
  using (public.auth_is_driver_session() or public.auth_is_admin_session());

-- =============================================================================
-- 9) quote_inventory_items - admin CRUD + driver read assigned (065)
-- =============================================================================
do $$
begin
  if exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'quote_inventory_items'
  ) then
    alter table public.quote_inventory_items enable row level security;

    drop policy if exists "Admin session manage quote inventory items" on public.quote_inventory_items;
    create policy "Admin session manage quote inventory items"
      on public.quote_inventory_items
      for all
      to authenticated
      using (public.auth_is_admin_session())
      with check (public.auth_is_admin_session());

    drop policy if exists "drivers_select_assigned_quote_inventory" on public.quote_inventory_items;
    create policy "drivers_select_assigned_quote_inventory"
      on public.quote_inventory_items
      for select
      to authenticated
      using (public.driver_has_quote_assignment(quote_id));
  end if;
end $$;

-- =============================================================================
-- 10) reviews (legacy) - published public read; admin CRUD
-- =============================================================================
do $$
begin
  if exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'reviews'
  ) then
    drop policy if exists "Anon read published reviews" on public.reviews;
    create policy "Anon read published reviews"
      on public.reviews
      for select
      to anon
      using (coalesce(is_published, false) = true);

    drop policy if exists "Admin session manage reviews" on public.reviews;
    create policy "Admin session manage reviews"
      on public.reviews
      for all
      to authenticated
      using (public.auth_is_admin_session())
      with check (public.auth_is_admin_session());
  end if;
end $$;

-- =============================================================================
-- 11) Website CMS + gallery - public SELECT; admin-only writes
-- =============================================================================
drop policy if exists "website_settings_insert_authenticated" on public.website_settings;
drop policy if exists "website_settings_update_authenticated" on public.website_settings;
create policy "Admin session manage website settings"
  on public.website_settings
  for all
  to authenticated
  using (public.auth_is_admin_session())
  with check (public.auth_is_admin_session() and id = 'default');

drop policy if exists "website_service_cards_insert_authenticated" on public.website_service_cards;
drop policy if exists "website_service_cards_update_authenticated" on public.website_service_cards;
drop policy if exists "website_service_cards_delete_authenticated" on public.website_service_cards;
create policy "Admin session manage website service cards"
  on public.website_service_cards
  for all
  to authenticated
  using (public.auth_is_admin_session())
  with check (public.auth_is_admin_session());

drop policy if exists "website_reviews_insert_authenticated" on public.website_reviews;
drop policy if exists "website_reviews_update_authenticated" on public.website_reviews;
drop policy if exists "website_reviews_delete_authenticated" on public.website_reviews;
create policy "Admin session manage website reviews"
  on public.website_reviews
  for all
  to authenticated
  using (public.auth_is_admin_session())
  with check (public.auth_is_admin_session());

drop policy if exists "website_media_insert_authenticated" on public.website_media;
drop policy if exists "website_media_update_authenticated" on public.website_media;
drop policy if exists "website_media_delete_authenticated" on public.website_media;
create policy "Admin session manage website media"
  on public.website_media
  for all
  to authenticated
  using (public.auth_is_admin_session())
  with check (public.auth_is_admin_session());

drop policy if exists "homepage_gallery_items_insert_authenticated" on public.homepage_gallery_items;
drop policy if exists "homepage_gallery_items_update_authenticated" on public.homepage_gallery_items;
drop policy if exists "homepage_gallery_items_delete_authenticated" on public.homepage_gallery_items;
create policy "Admin session manage homepage gallery"
  on public.homepage_gallery_items
  for all
  to authenticated
  using (public.auth_is_admin_session())
  with check (public.auth_is_admin_session());

-- =============================================================================
-- 12) booking_workflow_status_v - security invoker so job_status_history RLS applies
-- =============================================================================
drop view if exists public.booking_workflow_status_v;

create view public.booking_workflow_status_v
with (security_invoker = true)
as
select distinct on (h.quote_id)
  h.quote_id,
  h.status as workflow_status,
  h.created_at as workflow_at,
  h.driver_id,
  h.job_assignment_id,
  h.latitude,
  h.longitude
from public.job_status_history h
where h.quote_id is not null
order by h.quote_id, h.created_at desc;

comment on view public.booking_workflow_status_v is
  'Latest job_status_history row per quote. security_invoker=true - RLS on underlying table applies.';

grant select on public.booking_workflow_status_v to authenticated;

-- =============================================================================
-- 13) Explicit anon grants required by public funnel (061 revoked blanket anon)
-- =============================================================================
grant insert on table public.jobs to anon;
grant insert on table public.job_items to anon;
grant select on table public.items_library to anon;

do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'reviews') then
    grant select on table public.reviews to anon;
  end if;
end $$;

commit;
