-- Customer Leads: quote wizard / homepage capture alongside existing quotes + website_leads funnel.
-- Idempotent: safe to re-run in Supabase SQL Editor.

CREATE SEQUENCE IF NOT EXISTS public.customer_lead_ref_seq START 1;

CREATE OR REPLACE FUNCTION public.allocate_customer_lead_ref()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'SMH-LEAD-' || lpad(nextval('public.customer_lead_ref_seq')::text, 6, '0');
$$;

CREATE TABLE IF NOT EXISTS public.customer_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_ref text NOT NULL,
  quote_ref text,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  session_id text NOT NULL,
  status text NOT NULL DEFAULT 'new_lead',
  entry_point text NOT NULL DEFAULT 'quote_wizard',
  source_page_url text,
  service_type text,
  customer_name text,
  customer_phone text,
  customer_email text,
  pickup_address text,
  delivery_address text,
  move_date date,
  route_label text,
  estimated_total numeric,
  total_volume_m3 numeric,
  wizard_step int NOT NULL DEFAULT 1,
  wizard_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  abandoned_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_leads_status_check CHECK (
    status IN (
      'new_lead',
      'quote_started',
      'quote_viewed',
      'payment_started',
      'abandoned',
      'converted_to_booking'
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_leads_lead_ref_key ON public.customer_leads (lead_ref);
CREATE UNIQUE INDEX IF NOT EXISTS customer_leads_session_id_key ON public.customer_leads (session_id);
CREATE INDEX IF NOT EXISTS customer_leads_quote_ref_idx ON public.customer_leads (quote_ref);
CREATE INDEX IF NOT EXISTS customer_leads_status_idx ON public.customer_leads (status);
CREATE INDEX IF NOT EXISTS customer_leads_last_activity_idx ON public.customer_leads (last_activity_at DESC);

ALTER TABLE public.customer_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_leads_select_authenticated" ON public.customer_leads;
CREATE POLICY "customer_leads_select_authenticated"
  ON public.customer_leads FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "customer_leads_update_authenticated" ON public.customer_leads;
CREATE POLICY "customer_leads_update_authenticated"
  ON public.customer_leads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, UPDATE ON TABLE public.customer_leads TO authenticated;

-- Mark stale leads abandoned (30 min inactivity, not converted).
CREATE OR REPLACE FUNCTION public.mark_stale_customer_leads_abandoned(p_inactive_minutes int DEFAULT 30)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE public.customer_leads
  SET
    status = 'abandoned',
    abandoned_at = COALESCE(abandoned_at, now()),
    updated_at = now()
  WHERE status IN ('new_lead', 'quote_started', 'quote_viewed', 'payment_started')
    AND last_activity_at < now() - make_interval(mins => GREATEST(1, COALESCE(p_inactive_minutes, 30)));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_stale_customer_leads_abandoned(int) TO authenticated;

-- Public upsert (anon + authenticated) — no direct table INSERT for anon.
DROP FUNCTION IF EXISTS public.upsert_customer_lead(text, jsonb);

CREATE OR REPLACE FUNCTION public.upsert_customer_lead(p_session_id text, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.customer_leads%ROWTYPE;
  v_lead_ref text;
  v_status text;
  v_existing_status text;
BEGIN
  IF p_session_id IS NULL OR length(trim(p_session_id)) = 0 THEN
    RETURN NULL;
  END IF;

  v_status := COALESCE(NULLIF(trim(p_payload->>'status'), ''), 'new_lead');

  SELECT * INTO v_row FROM public.customer_leads WHERE session_id = trim(p_session_id) LIMIT 1;

  IF v_row.id IS NULL THEN
    v_lead_ref := public.allocate_customer_lead_ref();
    INSERT INTO public.customer_leads (
      lead_ref,
      quote_ref,
      quote_id,
      session_id,
      status,
      entry_point,
      source_page_url,
      service_type,
      customer_name,
      customer_phone,
      customer_email,
      pickup_address,
      delivery_address,
      move_date,
      route_label,
      estimated_total,
      total_volume_m3,
      wizard_step,
      wizard_data,
      last_activity_at,
      created_at,
      updated_at
    ) VALUES (
      v_lead_ref,
      NULLIF(trim(p_payload->>'quote_ref'), ''),
      NULLIF(trim(p_payload->>'quote_id'), '')::uuid,
      trim(p_session_id),
      v_status,
      COALESCE(NULLIF(trim(p_payload->>'entry_point'), ''), 'quote_wizard'),
      NULLIF(trim(p_payload->>'source_page_url'), ''),
      NULLIF(trim(p_payload->>'service_type'), ''),
      NULLIF(trim(p_payload->>'customer_name'), ''),
      NULLIF(trim(p_payload->>'customer_phone'), ''),
      NULLIF(trim(p_payload->>'customer_email'), ''),
      NULLIF(trim(p_payload->>'pickup_address'), ''),
      NULLIF(trim(p_payload->>'delivery_address'), ''),
      CASE
        WHEN p_payload ? 'move_date' AND length(trim(p_payload->>'move_date')) >= 10
        THEN (trim(p_payload->>'move_date'))::date
        ELSE NULL
      END,
      NULLIF(trim(p_payload->>'route_label'), ''),
      CASE WHEN p_payload ? 'estimated_total' THEN (p_payload->>'estimated_total')::numeric ELSE NULL END,
      CASE WHEN p_payload ? 'total_volume_m3' THEN (p_payload->>'total_volume_m3')::numeric ELSE NULL END,
      COALESCE((p_payload->>'wizard_step')::int, 1),
      COALESCE(p_payload->'wizard_data', '{}'::jsonb),
      now(),
      now(),
      now()
    )
    RETURNING * INTO v_row;
  ELSE
    v_existing_status := v_row.status;
    IF v_existing_status = 'converted_to_booking' THEN
      v_status := 'converted_to_booking';
    ELSIF v_status = 'converted_to_booking' THEN
      v_status := 'converted_to_booking';
    ELSIF v_existing_status = 'abandoned' AND v_status <> 'converted_to_booking' THEN
      v_status := 'abandoned';
    END IF;

    UPDATE public.customer_leads
    SET
      quote_ref = COALESCE(NULLIF(trim(p_payload->>'quote_ref'), ''), quote_ref),
      quote_id = COALESCE(
        NULLIF(trim(p_payload->>'quote_id'), '')::uuid,
        quote_id
      ),
      status = v_status,
      entry_point = COALESCE(NULLIF(trim(p_payload->>'entry_point'), ''), entry_point),
      source_page_url = COALESCE(NULLIF(trim(p_payload->>'source_page_url'), ''), source_page_url),
      service_type = COALESCE(NULLIF(trim(p_payload->>'service_type'), ''), service_type),
      customer_name = COALESCE(NULLIF(trim(p_payload->>'customer_name'), ''), customer_name),
      customer_phone = COALESCE(NULLIF(trim(p_payload->>'customer_phone'), ''), customer_phone),
      customer_email = COALESCE(NULLIF(trim(p_payload->>'customer_email'), ''), customer_email),
      pickup_address = COALESCE(NULLIF(trim(p_payload->>'pickup_address'), ''), pickup_address),
      delivery_address = COALESCE(NULLIF(trim(p_payload->>'delivery_address'), ''), delivery_address),
      move_date = CASE
        WHEN p_payload ? 'move_date' AND length(trim(p_payload->>'move_date')) >= 10
        THEN (trim(p_payload->>'move_date'))::date
        ELSE move_date
      END,
      route_label = COALESCE(NULLIF(trim(p_payload->>'route_label'), ''), route_label),
      estimated_total = CASE
        WHEN p_payload ? 'estimated_total' THEN (p_payload->>'estimated_total')::numeric
        ELSE estimated_total
      END,
      total_volume_m3 = CASE
        WHEN p_payload ? 'total_volume_m3' THEN (p_payload->>'total_volume_m3')::numeric
        ELSE total_volume_m3
      END,
      wizard_step = COALESCE((p_payload->>'wizard_step')::int, wizard_step),
      wizard_data = CASE
        WHEN p_payload ? 'wizard_data' THEN COALESCE(p_payload->'wizard_data', wizard_data)
        ELSE wizard_data
      END,
      last_activity_at = now(),
      abandoned_at = CASE WHEN v_status = 'abandoned' THEN COALESCE(abandoned_at, now()) ELSE abandoned_at END,
      converted_at = CASE
        WHEN v_status = 'converted_to_booking' THEN COALESCE(converted_at, now())
        ELSE converted_at
      END,
      updated_at = now()
    WHERE id = v_row.id
    RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'lead_ref', v_row.lead_ref,
    'quote_ref', v_row.quote_ref,
    'status', v_row.status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_customer_lead(text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_customer_lead_ref() TO anon, authenticated;
