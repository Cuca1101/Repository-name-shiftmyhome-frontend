-- Customer lead session rotation + reopen abandoned/payment_failed on new activity.
-- Does not delete or reset existing customer_leads rows.
-- Idempotent: safe to re-run in Supabase SQL Editor.

-- Ensure resume_token always has a default (guards partial prior applies).
ALTER TABLE public.customer_leads
  ALTER COLUMN resume_token SET DEFAULT gen_random_uuid();

-- Resume payload must include session_id so the browser re-binds the same lead.
CREATE OR REPLACE FUNCTION public.public_get_resume_quote(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.customer_leads%ROWTYPE;
BEGIN
  IF p_token IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_row
  FROM public.customer_leads
  WHERE resume_token = p_token
  LIMIT 1;

  IF v_row.id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_row.status = 'converted_to_booking' OR v_row.recovery_stopped_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'already_converted',
      'quote_ref', v_row.quote_ref
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'lead_id', v_row.id,
    'lead_ref', v_row.lead_ref,
    'session_id', v_row.session_id,
    'quote_ref', v_row.quote_ref,
    'quote_id', v_row.quote_id,
    'service_type', v_row.service_type,
    'wizard_step', v_row.wizard_step,
    'wizard_data', v_row.wizard_data,
    'estimated_total', v_row.estimated_total,
    'customer_name', v_row.customer_name,
    'customer_email', v_row.customer_email,
    'status', v_row.status,
    'source_page_url', v_row.source_page_url
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_get_resume_quote(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.public_get_resume_quote(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_get_resume_quote(uuid) TO service_role;

-- Upsert: new session_id → INSERT new lead.
-- Same session continuing a quote → UPDATE that lead.
-- Abandoned / payment_failed reopen on active funnel activity (resume / continue).
-- Converted stays locked.
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
      lead_ref, quote_ref, quote_id, session_id, status, entry_point, source_page_url,
      service_type, customer_name, customer_phone, customer_email, pickup_address, delivery_address,
      move_date, route_label, estimated_total, total_volume_m3, wizard_step, wizard_data,
      last_activity_at, created_at, updated_at
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
      CASE WHEN p_payload ? 'move_date' AND length(trim(p_payload->>'move_date')) >= 10
        THEN (trim(p_payload->>'move_date'))::date ELSE NULL END,
      NULLIF(trim(p_payload->>'route_label'), ''),
      CASE WHEN p_payload ? 'estimated_total' THEN (p_payload->>'estimated_total')::numeric ELSE NULL END,
      CASE WHEN p_payload ? 'total_volume_m3' THEN (p_payload->>'total_volume_m3')::numeric ELSE NULL END,
      COALESCE((p_payload->>'wizard_step')::int, 1),
      COALESCE(p_payload->'wizard_data', '{}'::jsonb),
      now(), now(), now()
    )
    RETURNING * INTO v_row;
  ELSE
    v_existing_status := v_row.status;
    IF v_existing_status = 'converted_to_booking' THEN
      v_status := 'converted_to_booking';
    ELSIF v_status = 'converted_to_booking' THEN
      v_status := 'converted_to_booking';
    ELSIF v_existing_status IN ('abandoned', 'payment_failed') THEN
      IF v_status IN ('abandoned', 'payment_failed') THEN
        IF v_existing_status = 'payment_failed' OR v_status = 'payment_failed' THEN
          v_status := 'payment_failed';
        ELSE
          v_status := 'abandoned';
        END IF;
      END IF;
      -- else: reopen to incoming active status (quote_started / quote_viewed / …)
    END IF;

    UPDATE public.customer_leads
    SET
      quote_ref = COALESCE(NULLIF(trim(p_payload->>'quote_ref'), ''), quote_ref),
      quote_id = COALESCE(NULLIF(trim(p_payload->>'quote_id'), '')::uuid, quote_id),
      status = v_status,
      entry_point = COALESCE(NULLIF(trim(p_payload->>'entry_point'), ''), entry_point),
      source_page_url = COALESCE(NULLIF(trim(p_payload->>'source_page_url'), ''), source_page_url),
      service_type = COALESCE(NULLIF(trim(p_payload->>'service_type'), ''), service_type),
      customer_name = COALESCE(NULLIF(trim(p_payload->>'customer_name'), ''), customer_name),
      customer_phone = COALESCE(NULLIF(trim(p_payload->>'customer_phone'), ''), customer_phone),
      customer_email = COALESCE(NULLIF(trim(p_payload->>'customer_email'), ''), customer_email),
      pickup_address = COALESCE(NULLIF(trim(p_payload->>'pickup_address'), ''), pickup_address),
      delivery_address = COALESCE(NULLIF(trim(p_payload->>'delivery_address'), ''), delivery_address),
      move_date = CASE WHEN p_payload ? 'move_date' AND length(trim(p_payload->>'move_date')) >= 10
        THEN (trim(p_payload->>'move_date'))::date ELSE move_date END,
      route_label = COALESCE(NULLIF(trim(p_payload->>'route_label'), ''), route_label),
      estimated_total = CASE WHEN p_payload ? 'estimated_total' THEN (p_payload->>'estimated_total')::numeric ELSE estimated_total END,
      total_volume_m3 = CASE WHEN p_payload ? 'total_volume_m3' THEN (p_payload->>'total_volume_m3')::numeric ELSE total_volume_m3 END,
      wizard_step = COALESCE((p_payload->>'wizard_step')::int, wizard_step),
      wizard_data = CASE WHEN p_payload ? 'wizard_data' THEN COALESCE(p_payload->'wizard_data', wizard_data) ELSE wizard_data END,
      last_activity_at = now(),
      abandoned_at = CASE
        WHEN v_status = 'abandoned' THEN COALESCE(abandoned_at, now())
        WHEN v_status IN ('new_lead', 'quote_started', 'quote_viewed', 'payment_started') THEN NULL
        ELSE abandoned_at
      END,
      converted_at = CASE WHEN v_status = 'converted_to_booking' THEN COALESCE(converted_at, now()) ELSE converted_at END,
      recovery_stopped_at = CASE
        WHEN v_status = 'converted_to_booking' THEN COALESCE(recovery_stopped_at, now())
        ELSE recovery_stopped_at
      END,
      next_recovery_email_at = CASE
        WHEN v_status = 'converted_to_booking' THEN NULL
        WHEN v_status IN ('new_lead', 'quote_started', 'quote_viewed', 'payment_started')
          AND v_existing_status IN ('abandoned', 'payment_failed') THEN NULL
        ELSE next_recovery_email_at
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
