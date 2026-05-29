-- Explicit Data API grants for public schema tables (Supabase May/Oct 2026 policy).
-- https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
--
-- Grants control which roles can reach a table via PostgREST (supabase-js).
-- RLS policies (unchanged here) control which rows each role may touch.
--
-- Idempotent: safe on projects that still have legacy blanket anon grants.
-- Does not modify table data or reset the database.

-- ---------------------------------------------------------------------------
-- Schema usage (required before any table grant)
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

comment on schema public is
  'Application tables. Data API access is explicit per table (migration 061+); RLS enforces row scope.';

-- ---------------------------------------------------------------------------
-- 1) Remove legacy blanket anon privileges (Oct 2026 hardening + least privilege)
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('revoke all on table public.%I from anon', r.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Authenticated: admin + driver app (RLS scopes rows per session)
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format(
      'grant select, insert, update, delete on table public.%I to authenticated',
      r.tablename
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3) anon: public marketing CMS — read-only
-- ---------------------------------------------------------------------------

-- website_settings: homepage/about/nav/footer JSON for public site (RLS: select all rows).
grant select on table public.website_settings to anon;
comment on table public.website_settings is
  'Public site CMS singleton. anon: SELECT (marketing copy). authenticated: CRUD via admin RLS.';

grant select on table public.website_service_cards to anon;
comment on table public.website_service_cards is
  'Service cards on marketing site. anon: SELECT active cards. authenticated: admin CMS.';

grant select on table public.website_reviews to anon;
comment on table public.website_reviews is
  'Homepage testimonial cards. anon: SELECT. authenticated: admin CMS.';

grant select on table public.website_media to anon;
comment on table public.website_media is
  'CMS media library metadata (URLs). anon: SELECT for rendered pages. authenticated: admin uploads.';

grant select on table public.homepage_gallery_items to anon;
comment on table public.homepage_gallery_items is
  'Recent moves gallery. anon: SELECT active items. authenticated: admin gallery tab.';

-- ---------------------------------------------------------------------------
-- 4) anon: visitor funnel (insert-only; no direct read of PII tables)
-- ---------------------------------------------------------------------------

-- quotes: homepage contact form insert only (047); no anon SELECT (PII).
grant insert on table public.quotes to anon;
comment on table public.quotes is
  'Bookings and leads. anon: INSERT public leads only (RLS). authenticated: admin/driver per RLS. No anon SELECT.';

-- job_photos: customer upload + dedup read by quote ref (030, 033).
grant select, insert on table public.job_photos to anon;
comment on table public.job_photos is
  'Photo metadata. anon: INSERT/SELECT customer rows for valid SMH quote refs. authenticated: admin/driver.';

-- website_events: anonymous funnel analytics (032); not readable by anon.
grant insert on table public.website_events to anon;
comment on table public.website_events is
  'Marketing funnel events. anon: INSERT only. authenticated: admin analytics SELECT.';

-- website_leads: writes via upsert_website_lead() SECURITY DEFINER — no direct anon table grant.
comment on table public.website_leads is
  'Funnel lead snapshots (PII). No anon table grant; public site uses upsert_website_lead RPC. authenticated: admin.';

-- seo_settings: public reads via get_public_seo_settings() RPC — no anon table grant.
comment on table public.seo_settings is
  'SEO overrides. No anon table grant; marketing site uses get_public_seo_settings() RPC. authenticated: admin SEO dashboard.';

-- ---------------------------------------------------------------------------
-- 5) Sensitive / operational tables — authenticated only (explicit deny anon)
-- ---------------------------------------------------------------------------
-- (revoke in step 1 already removed anon; comments document intent for reviewers)

comment on table public.admin_activity_logs is
  'Admin audit trail. authenticated only; no anon Data API access.';

comment on table public.admin_config_secrets is
  'PIN hashes. authenticated table grant for RPC callers; no anon; verify via SECURITY DEFINER functions only.';

comment on table public.drivers is
  'Fleet driver profiles. authenticated only (admin session or linked driver user). No anon.';

comment on table public.driver_charges is
  'Driver charge ledger. authenticated only. No anon.';

comment on table public.driver_documents is
  'Compliance uploads. authenticated only. No anon.';

comment on table public.driver_live_positions is
  'GPS traces. authenticated only. No anon.';

comment on table public.driver_payout_audit_log is
  'Payout override audit. authenticated only. No anon.';

comment on table public.extra_charge_requests is
  'Extra item payment requests. authenticated only. No anon (use driver authenticated session).';

comment on table public.job_assignments is
  'Driver job list links. authenticated only. No anon.';

comment on table public.job_status_history is
  'Driver status timeline. authenticated only. No anon.';

comment on table public.jobs is
  'Operational jobs. authenticated only. No anon.';

comment on table public.journeys is
  'Multi-stop bundles. authenticated only. No anon.';

comment on table public.journey_stops is
  'Journey stop rows. authenticated only. No anon.';

comment on table public.journey_payout_audit_log is
  'Journey payout change audit. authenticated only. No anon.';

comment on table public.partners is
  'Transport partners. authenticated only. No anon.';

comment on table public.pricing_settings is
  'Pricing engine config. authenticated only. No anon.';

comment on table public.proof_of_delivery is
  'POD records. authenticated only. No anon.';

comment on table public.quote_inventory_items is
  'Quote line items. authenticated only. No anon.';

comment on table public.quote_pricing is
  'Quote pricing breakdown. authenticated only. No anon.';

comment on table public.quote_requirements is
  'Quote requirements. authenticated only. No anon.';

comment on table public.quote_stops is
  'Quote stops. authenticated only. No anon.';

comment on table public.items_library is
  'Admin inventory catalogue. authenticated only. No anon.';

comment on table public.job_items is
  'Job inventory lines. authenticated only. No anon.';

comment on table public.crew_options is
  'Crew/pricing options. authenticated only. No anon.';

comment on table public.service_types is
  'Service catalogue. authenticated only. No anon.';

comment on table public.reviews is
  'Legacy reviews table. authenticated only. No anon.';
