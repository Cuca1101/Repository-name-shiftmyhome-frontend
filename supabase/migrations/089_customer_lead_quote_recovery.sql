-- Abandoned quote + payment recovery for customer_leads.
-- Resume tokens, recovery cadence tracking, payment_failed status.

ALTER TABLE public.customer_leads
  ADD COLUMN IF NOT EXISTS resume_token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS recovery_emails_sent_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_recovery_email_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_recovery_email_kind text,
  ADD COLUMN IF NOT EXISTS recovery_email_opened boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recovery_email_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS resume_link_clicked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resume_link_clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS resume_link_click_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_link_clicked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_link_clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_link_click_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS recovery_stopped_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_recovery_email_at timestamptz;

-- Backfill tokens for existing rows.
UPDATE public.customer_leads
SET resume_token = gen_random_uuid()
WHERE resume_token IS NULL;

ALTER TABLE public.customer_leads
  ALTER COLUMN resume_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customer_leads_resume_token_key
  ON public.customer_leads (resume_token);

CREATE INDEX IF NOT EXISTS customer_leads_next_recovery_email_idx
  ON public.customer_leads (next_recovery_email_at)
  WHERE next_recovery_email_at IS NOT NULL AND recovery_stopped_at IS NULL;

-- Allow payment_failed status.
ALTER TABLE public.customer_leads DROP CONSTRAINT IF EXISTS customer_leads_status_check;
ALTER TABLE public.customer_leads
  ADD CONSTRAINT customer_leads_status_check CHECK (
    status IN (
      'new_lead',
      'quote_started',
      'quote_viewed',
      'payment_started',
      'abandoned',
      'payment_failed',
      'converted_to_booking'
    )
  );

-- Mark stale leads abandoned after inactivity (default 15 min for recovery).
CREATE OR REPLACE FUNCTION public.mark_stale_customer_leads_abandoned(p_inactive_minutes int DEFAULT 15)
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
    next_recovery_email_at = COALESCE(
      next_recovery_email_at,
      COALESCE(abandoned_at, now()) + interval '15 minutes'
    ),
    updated_at = now()
  WHERE status IN ('new_lead', 'quote_started', 'quote_viewed', 'payment_started')
    AND recovery_stopped_at IS NULL
    AND converted_at IS NULL
    AND coalesce(nullif(trim(customer_email), ''), '') <> ''
    AND last_activity_at < now() - make_interval(mins => GREATEST(1, COALESCE(p_inactive_minutes, 15)))
    AND (wizard_step >= 3 OR status IN ('quote_viewed', 'payment_started'));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_stale_customer_leads_abandoned(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_stale_customer_leads_abandoned(int) TO service_role;

-- Ensure resume token exists (admin / send paths).
CREATE OR REPLACE FUNCTION public.ensure_customer_lead_resume_token(p_lead_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token uuid;
BEGIN
  UPDATE public.customer_leads
  SET resume_token = COALESCE(resume_token, gen_random_uuid()),
      updated_at = now()
  WHERE id = p_lead_id
  RETURNING resume_token INTO v_token;
  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_customer_lead_resume_token(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_customer_lead_resume_token(uuid) TO service_role;

-- Public: load quote draft by resume token (anon).
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
    'quote_ref', v_row.quote_ref,
    'quote_id', v_row.quote_id,
    'service_type', v_row.service_type,
    'wizard_step', v_row.wizard_step,
    'wizard_data', v_row.wizard_data,
    'estimated_total', v_row.estimated_total,
    'customer_name', v_row.customer_name,
    'customer_email', v_row.customer_email,
    'status', v_row.status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_get_resume_quote(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.public_get_resume_quote(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_get_resume_quote(uuid) TO service_role;

-- Public: track open / resume / payment clicks.
CREATE OR REPLACE FUNCTION public.public_track_recovery_event(p_token uuid, p_event text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event text := lower(trim(COALESCE(p_event, '')));
BEGIN
  IF p_token IS NULL OR v_event = '' THEN
    RETURN false;
  END IF;

  IF v_event = 'open' THEN
    UPDATE public.customer_leads
    SET
      recovery_email_opened = true,
      recovery_email_opened_at = COALESCE(recovery_email_opened_at, now()),
      updated_at = now()
    WHERE resume_token = p_token;
  ELSIF v_event = 'resume_click' THEN
    UPDATE public.customer_leads
    SET
      resume_link_clicked = true,
      resume_link_clicked_at = COALESCE(resume_link_clicked_at, now()),
      resume_link_click_count = COALESCE(resume_link_click_count, 0) + 1,
      updated_at = now()
    WHERE resume_token = p_token;
  ELSIF v_event = 'payment_click' THEN
    UPDATE public.customer_leads
    SET
      payment_link_clicked = true,
      payment_link_clicked_at = COALESCE(payment_link_clicked_at, now()),
      payment_link_click_count = COALESCE(payment_link_click_count, 0) + 1,
      updated_at = now()
    WHERE resume_token = p_token;
  ELSE
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_track_recovery_event(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.public_track_recovery_event(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_track_recovery_event(uuid, text) TO service_role;

-- Mark lead payment failed (from Stripe / client).
CREATE OR REPLACE FUNCTION public.mark_customer_lead_payment_failed(
  p_quote_ref text DEFAULT NULL,
  p_quote_id uuid DEFAULT NULL,
  p_session_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  UPDATE public.customer_leads
  SET
    status = 'payment_failed',
    payment_failed_at = COALESCE(payment_failed_at, now()),
    next_recovery_email_at = now(),
    updated_at = now()
  WHERE recovery_stopped_at IS NULL
    AND status IS DISTINCT FROM 'converted_to_booking'
    AND (
      (p_quote_id IS NOT NULL AND quote_id = p_quote_id)
      OR (p_quote_ref IS NOT NULL AND trim(p_quote_ref) <> '' AND quote_ref = trim(p_quote_ref))
      OR (p_session_id IS NOT NULL AND trim(p_session_id) <> '' AND session_id = trim(p_session_id))
    )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_customer_lead_payment_failed(text, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.mark_customer_lead_payment_failed(text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_customer_lead_payment_failed(text, uuid, text) TO service_role;

-- Stop recovery when booking converts.
CREATE OR REPLACE FUNCTION public.stop_customer_lead_recovery(
  p_quote_ref text DEFAULT NULL,
  p_quote_id uuid DEFAULT NULL,
  p_session_id text DEFAULT NULL
)
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
    status = 'converted_to_booking',
    converted_at = COALESCE(converted_at, now()),
    recovery_stopped_at = COALESCE(recovery_stopped_at, now()),
    next_recovery_email_at = NULL,
    updated_at = now()
  WHERE status IS DISTINCT FROM 'converted_to_booking'
    AND (
      (p_quote_id IS NOT NULL AND quote_id = p_quote_id)
      OR (p_quote_ref IS NOT NULL AND trim(p_quote_ref) <> '' AND quote_ref = trim(p_quote_ref))
      OR (p_session_id IS NOT NULL AND trim(p_session_id) <> '' AND session_id = trim(p_session_id))
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.stop_customer_lead_recovery(text, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.stop_customer_lead_recovery(text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stop_customer_lead_recovery(text, uuid, text) TO service_role;

-- Preserve abandoned / payment_failed during wizard activity upserts (until converted).
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
    ELSIF v_existing_status IN ('abandoned', 'payment_failed') AND v_status <> 'converted_to_booking' THEN
      v_status := v_existing_status;
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
      abandoned_at = CASE WHEN v_status = 'abandoned' THEN COALESCE(abandoned_at, now()) ELSE abandoned_at END,
      converted_at = CASE WHEN v_status = 'converted_to_booking' THEN COALESCE(converted_at, now()) ELSE converted_at END,
      recovery_stopped_at = CASE
        WHEN v_status = 'converted_to_booking' THEN COALESCE(recovery_stopped_at, now())
        ELSE recovery_stopped_at
      END,
      next_recovery_email_at = CASE
        WHEN v_status = 'converted_to_booking' THEN NULL
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
