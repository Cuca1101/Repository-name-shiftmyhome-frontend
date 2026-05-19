-- Visitor geo / device analytics for website_leads + website_events (admin-only).
-- Idempotent: safe to re-run in Supabase SQL Editor.

-- ---------------------------------------------------------------------------
-- website_leads: visitor context columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.website_leads
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS ip_hash text,
  ADD COLUMN IF NOT EXISTS ip_masked text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS device_type text,
  ADD COLUMN IF NOT EXISTS browser_name text,
  ADD COLUMN IF NOT EXISTS referrer text;

CREATE INDEX IF NOT EXISTS website_leads_country_idx ON public.website_leads (country);
CREATE INDEX IF NOT EXISTS website_leads_city_idx ON public.website_leads (city);

CREATE UNIQUE INDEX IF NOT EXISTS website_leads_session_id_key ON public.website_leads (session_id);

-- ---------------------------------------------------------------------------
-- website_events: granular funnel events (one row per event)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.website_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  event_name text NOT NULL,
  page_path text,
  referrer text,
  quote_ref text,
  funnel_step int,
  ip_address text,
  ip_hash text,
  ip_masked text,
  city text,
  region text,
  country text,
  user_agent text,
  device_type text,
  browser_name text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS website_events_session_idx ON public.website_events (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS website_events_created_idx ON public.website_events (created_at DESC);
CREATE INDEX IF NOT EXISTS website_events_event_name_idx ON public.website_events (event_name);

ALTER TABLE public.website_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "website_events_select_authenticated" ON public.website_events;
CREATE POLICY "website_events_select_authenticated"
  ON public.website_events FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "website_events_insert_anon" ON public.website_events;
CREATE POLICY "website_events_insert_anon"
  ON public.website_events FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- upsert_website_lead (drop + recreate — avoids 42P13 when parameter defaults differ)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.upsert_website_lead(text, jsonb);

CREATE OR REPLACE FUNCTION public.upsert_website_lead(p_session_id text, p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_timeline jsonb;
  v_event jsonb;
BEGIN
  IF p_session_id IS NULL OR length(trim(p_session_id)) = 0 THEN
    RETURN NULL;
  END IF;

  v_event := p_payload->'timeline_event';

  INSERT INTO public.website_leads (
    session_id,
    status,
    funnel_event,
    landing_path,
    city_route,
    referrer,
    quote_ref,
    quote_id,
    service_type,
    current_step,
    estimated_total,
    customer_name,
    customer_email,
    customer_phone,
    pickup_address,
    delivery_address,
    pickup_postcode,
    delivery_postcode,
    ip_address,
    ip_hash,
    ip_masked,
    city,
    region,
    country,
    user_agent,
    device_type,
    browser_name,
    abandoned_at,
    recovery_scheduled_at,
    recovered_booking,
    last_activity_at,
    created_at,
    updated_at,
    lead_timeline
  )
  VALUES (
    trim(p_session_id),
    COALESCE(nullif(p_payload->>'status', ''), 'visited'),
    nullif(p_payload->>'funnel_event', ''),
    nullif(p_payload->>'landing_path', ''),
    nullif(p_payload->>'city_route', ''),
    nullif(p_payload->>'referrer', ''),
    nullif(p_payload->>'quote_ref', ''),
    nullif(p_payload->>'quote_id', '')::uuid,
    nullif(p_payload->>'service_type', ''),
    nullif(p_payload->>'current_step', '')::int,
    nullif(p_payload->>'estimated_total', '')::numeric,
    nullif(p_payload->>'customer_name', ''),
    nullif(p_payload->>'customer_email', ''),
    nullif(p_payload->>'customer_phone', ''),
    nullif(p_payload->>'pickup_address', ''),
    nullif(p_payload->>'delivery_address', ''),
    nullif(p_payload->>'pickup_postcode', ''),
    nullif(p_payload->>'delivery_postcode', ''),
    nullif(p_payload->>'ip_address', ''),
    nullif(p_payload->>'ip_hash', ''),
    nullif(p_payload->>'ip_masked', ''),
    nullif(p_payload->>'city', ''),
    nullif(p_payload->>'region', ''),
    nullif(p_payload->>'country', ''),
    nullif(p_payload->>'user_agent', ''),
    nullif(p_payload->>'device_type', ''),
    nullif(p_payload->>'browser_name', ''),
    nullif(p_payload->>'abandoned_at', '')::timestamptz,
    nullif(p_payload->>'recovery_scheduled_at', '')::timestamptz,
    COALESCE((p_payload->>'recovered_booking')::boolean, false),
    COALESCE(nullif(p_payload->>'last_activity_at', '')::timestamptz, now()),
    now(),
    now(),
    CASE WHEN v_event IS NOT NULL AND v_event <> 'null'::jsonb
      THEN jsonb_build_array(v_event) ELSE '[]'::jsonb END
  )
  ON CONFLICT (session_id) DO UPDATE SET
    status = COALESCE(nullif(p_payload->>'status', ''), website_leads.status),
    funnel_event = COALESCE(nullif(p_payload->>'funnel_event', ''), website_leads.funnel_event),
    landing_path = COALESCE(nullif(p_payload->>'landing_path', ''), website_leads.landing_path),
    city_route = COALESCE(nullif(p_payload->>'city_route', ''), website_leads.city_route),
    referrer = COALESCE(nullif(p_payload->>'referrer', ''), website_leads.referrer),
    quote_ref = COALESCE(nullif(p_payload->>'quote_ref', ''), website_leads.quote_ref),
    quote_id = COALESCE(nullif(p_payload->>'quote_id', '')::uuid, website_leads.quote_id),
    service_type = COALESCE(nullif(p_payload->>'service_type', ''), website_leads.service_type),
    current_step = COALESCE(nullif(p_payload->>'current_step', '')::int, website_leads.current_step),
    estimated_total = COALESCE(nullif(p_payload->>'estimated_total', '')::numeric, website_leads.estimated_total),
    customer_name = COALESCE(nullif(p_payload->>'customer_name', ''), website_leads.customer_name),
    customer_email = COALESCE(nullif(p_payload->>'customer_email', ''), website_leads.customer_email),
    customer_phone = COALESCE(nullif(p_payload->>'customer_phone', ''), website_leads.customer_phone),
    pickup_address = COALESCE(nullif(p_payload->>'pickup_address', ''), website_leads.pickup_address),
    delivery_address = COALESCE(nullif(p_payload->>'delivery_address', ''), website_leads.delivery_address),
    pickup_postcode = COALESCE(nullif(p_payload->>'pickup_postcode', ''), website_leads.pickup_postcode),
    delivery_postcode = COALESCE(nullif(p_payload->>'delivery_postcode', ''), website_leads.delivery_postcode),
    ip_address = COALESCE(nullif(p_payload->>'ip_address', ''), website_leads.ip_address),
    ip_hash = COALESCE(nullif(p_payload->>'ip_hash', ''), website_leads.ip_hash),
    ip_masked = COALESCE(nullif(p_payload->>'ip_masked', ''), website_leads.ip_masked),
    city = COALESCE(nullif(p_payload->>'city', ''), website_leads.city),
    region = COALESCE(nullif(p_payload->>'region', ''), website_leads.region),
    country = COALESCE(nullif(p_payload->>'country', ''), website_leads.country),
    user_agent = COALESCE(nullif(p_payload->>'user_agent', ''), website_leads.user_agent),
    device_type = COALESCE(nullif(p_payload->>'device_type', ''), website_leads.device_type),
    browser_name = COALESCE(nullif(p_payload->>'browser_name', ''), website_leads.browser_name),
    abandoned_at = COALESCE(nullif(p_payload->>'abandoned_at', '')::timestamptz, website_leads.abandoned_at),
    recovery_scheduled_at = COALESCE(nullif(p_payload->>'recovery_scheduled_at', '')::timestamptz, website_leads.recovery_scheduled_at),
    recovered_booking = COALESCE((p_payload->>'recovered_booking')::boolean, website_leads.recovered_booking),
    last_activity_at = COALESCE(nullif(p_payload->>'last_activity_at', '')::timestamptz, now()),
    updated_at = now(),
    lead_timeline = CASE
      WHEN v_event IS NOT NULL AND v_event <> 'null'::jsonb
      THEN COALESCE(website_leads.lead_timeline, '[]'::jsonb) || jsonb_build_array(v_event)
      ELSE website_leads.lead_timeline
    END
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_website_lead(text, jsonb) TO anon, authenticated;
