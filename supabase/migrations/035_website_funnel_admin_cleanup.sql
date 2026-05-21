-- Admin-only cleanup for website_events and non-converted website_leads.
-- Does not delete paid bookings, jobs, or leads linked to paid/deposit quotes.
-- Does not require quotes.is_test (optional column checked at runtime only).

CREATE OR REPLACE FUNCTION public.website_lead_is_protected(p_lead public.website_leads)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    p_lead.status IN ('payment_completed', 'payment_started')
    OR (
      p_lead.quote_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.quotes q
        WHERE q.id = p_lead.quote_id
          AND (
            q.payment_status IN ('paid', 'deposit_paid')
            OR q.paid_at IS NOT NULL
            OR q.completed_at IS NOT NULL
          )
      )
    );
$$;

/**
 * Safe demo/test booking detection on quotes (no direct is_test reference).
 * Never returns true for paid bookings or Stripe-linked quotes.
 */
CREATE OR REPLACE FUNCTION public.quote_row_is_demo_booking(p_quote_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_ref text;
  v_name text;
  v_email text;
  v_payment_status text;
  v_paid_at timestamptz;
  v_stripe_pi text;
  v_stripe_sess text;
  v_cancel_reason text;
  v_is_test boolean;
  v_has_is_test boolean;
  v_has_cancel_reason boolean;
BEGIN
  IF p_quote_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT
    q.quote_ref,
    q.full_name,
    q.email,
    q.payment_status,
    q.paid_at,
    q.stripe_payment_intent_id,
    q.stripe_session_id
  INTO v_ref, v_name, v_email, v_payment_status, v_paid_at, v_stripe_pi, v_stripe_sess
  FROM public.quotes q
  WHERE q.id = p_quote_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF COALESCE(v_payment_status, '') IN ('paid', 'deposit_paid') OR v_paid_at IS NOT NULL THEN
    RETURN false;
  END IF;

  IF COALESCE(v_stripe_pi, '') <> '' OR COALESCE(v_stripe_sess, '') <> '' THEN
    RETURN false;
  END IF;

  IF COALESCE(v_ref, '') ~* '(DEMO|TEST)' THEN
    RETURN true;
  END IF;

  IF COALESCE(v_name, '') ILIKE '%demo%' OR COALESCE(v_name, '') ILIKE '%test%' THEN
    RETURN true;
  END IF;

  IF COALESCE(v_email, '') ILIKE '%demo%' OR COALESCE(v_email, '') ILIKE '%@test.%' THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quotes'
      AND column_name = 'admin_cancellation_reason'
  ) INTO v_has_cancel_reason;

  IF v_has_cancel_reason THEN
    EXECUTE
      'SELECT COALESCE(admin_cancellation_reason, '''') FROM public.quotes WHERE id = $1'
    INTO v_cancel_reason
    USING p_quote_id;

    IF v_cancel_reason ILIKE '%DEMO%' OR v_cancel_reason ILIKE '%TEST BOOKING%' THEN
      RETURN true;
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quotes'
      AND column_name = 'is_test'
  ) INTO v_has_is_test;

  IF v_has_is_test THEN
    EXECUTE
      'SELECT COALESCE(is_test, false) FROM public.quotes WHERE id = $1'
    INTO v_is_test
    USING p_quote_id;

    IF v_is_test THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.website_lead_is_demo(p_lead public.website_leads)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF COALESCE(p_lead.customer_email, '') ILIKE '%demo%' THEN
    RETURN true;
  END IF;

  IF COALESCE(p_lead.customer_email, '') ILIKE '%@test.%' THEN
    RETURN true;
  END IF;

  IF COALESCE(p_lead.customer_name, '') ILIKE '%demo%' THEN
    RETURN true;
  END IF;

  IF COALESCE(p_lead.quote_ref, '') ~* '(DEMO|TEST)' THEN
    RETURN true;
  END IF;

  IF COALESCE(p_lead.session_id, '') ILIKE '%demo%' THEN
    RETURN true;
  END IF;

  IF p_lead.quote_id IS NOT NULL AND public.quote_row_is_demo_booking(p_lead.quote_id) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.website_event_is_demo(e public.website_events)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_quote_id uuid;
BEGIN
  IF COALESCE(e.quote_ref, '') ~* '(DEMO|TEST)' THEN
    RETURN true;
  END IF;

  IF COALESCE(e.session_id, '') ILIKE '%demo%' THEN
    RETURN true;
  END IF;

  IF COALESCE(e.quote_ref, '') <> '' THEN
    SELECT q.id INTO v_quote_id
    FROM public.quotes q
    WHERE q.quote_ref = e.quote_ref
    LIMIT 1;

    IF v_quote_id IS NOT NULL AND public.quote_row_is_demo_booking(v_quote_id) THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_website_funnel_cleanup_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_events bigint := 0;
  v_abandoned bigint := 0;
  v_oldest timestamptz;
BEGIN
  SELECT count(*)::bigint INTO v_events FROM public.website_events;
  SELECT min(created_at) INTO v_oldest FROM public.website_events;

  SELECT count(*)::bigint INTO v_abandoned
  FROM public.website_leads wl
  WHERE NOT public.website_lead_is_protected(wl)
    AND (
      wl.status = 'visited'
      OR wl.abandoned_at IS NOT NULL
      OR wl.status IN ('quote_started', 'step_completed')
    );

  RETURN jsonb_build_object(
    'events_total', v_events,
    'abandoned_sessions_total', v_abandoned,
    'oldest_event_at', v_oldest
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_cleanup_website_funnel(
  p_older_than_days integer DEFAULT 30,
  p_clear_events boolean DEFAULT false,
  p_clear_abandoned boolean DEFAULT false,
  p_clear_demo boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days integer := GREATEST(COALESCE(p_older_than_days, 30), 1);
  v_cutoff timestamptz := now() - make_interval(days => v_days);
  v_batch integer := 400;
  v_deleted integer;
  v_events_deleted bigint := 0;
  v_leads_deleted bigint := 0;
  v_iterations integer := 0;
  v_max_iterations integer := 60;
BEGIN
  IF NOT COALESCE(p_clear_events, false)
     AND NOT COALESCE(p_clear_abandoned, false)
     AND NOT COALESCE(p_clear_demo, false) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'No cleanup actions selected.'
    );
  END IF;

  IF COALESCE(p_clear_events, false) THEN
    v_iterations := 0;
    LOOP
      v_iterations := v_iterations + 1;
      EXIT WHEN v_iterations > v_max_iterations;

      DELETE FROM public.website_events we
      WHERE we.id IN (
        SELECT e.id
        FROM public.website_events e
        WHERE e.created_at < v_cutoff
          AND (
            e.quote_ref IS NULL
            OR NOT EXISTS (
              SELECT 1
              FROM public.quotes q
              WHERE q.quote_ref = e.quote_ref
                AND (
                  q.payment_status IN ('paid', 'deposit_paid')
                  OR q.paid_at IS NOT NULL
                )
            )
          )
        LIMIT v_batch
      );

      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      v_events_deleted := v_events_deleted + v_deleted;
      EXIT WHEN v_deleted = 0;
    END LOOP;
  END IF;

  IF COALESCE(p_clear_abandoned, false) THEN
    v_iterations := 0;
    LOOP
      v_iterations := v_iterations + 1;
      EXIT WHEN v_iterations > v_max_iterations;

      DELETE FROM public.website_leads wl
      WHERE wl.id IN (
        SELECT l.id
        FROM public.website_leads l
        WHERE l.last_activity_at < v_cutoff
          AND NOT public.website_lead_is_protected(l)
          AND l.status NOT IN ('quote_completed', 'payment_started', 'payment_completed')
          AND (
            l.status = 'visited'
            OR l.abandoned_at IS NOT NULL
            OR l.status IN ('quote_started', 'step_completed')
          )
          AND NOT public.website_lead_is_demo(l)
        LIMIT v_batch
      );

      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      v_leads_deleted := v_leads_deleted + v_deleted;
      EXIT WHEN v_deleted = 0;
    END LOOP;
  END IF;

  IF COALESCE(p_clear_demo, false) THEN
    v_iterations := 0;
    LOOP
      v_iterations := v_iterations + 1;
      EXIT WHEN v_iterations > v_max_iterations;

      DELETE FROM public.website_leads wl
      WHERE wl.id IN (
        SELECT l.id
        FROM public.website_leads l
        WHERE public.website_lead_is_demo(l)
          AND NOT public.website_lead_is_protected(l)
        LIMIT v_batch
      );

      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      v_leads_deleted := v_leads_deleted + v_deleted;
      EXIT WHEN v_deleted = 0;
    END LOOP;

    v_iterations := 0;
    LOOP
      v_iterations := v_iterations + 1;
      EXIT WHEN v_iterations > v_max_iterations;

      DELETE FROM public.website_events we
      WHERE we.id IN (
        SELECT e.id
        FROM public.website_events e
        WHERE public.website_event_is_demo(e)
          AND (
            e.quote_ref IS NULL
            OR NOT EXISTS (
              SELECT 1
              FROM public.quotes q
              WHERE q.quote_ref = e.quote_ref
                AND (
                  q.payment_status IN ('paid', 'deposit_paid')
                  OR q.paid_at IS NOT NULL
                )
            )
          )
        LIMIT v_batch
      );

      GET DIAGNOSTICS v_deleted = ROW_COUNT;
      v_events_deleted := v_events_deleted + v_deleted;
      EXIT WHEN v_deleted = 0;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'older_than_days', v_days,
    'events_deleted', v_events_deleted,
    'leads_deleted', v_leads_deleted
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_website_funnel_cleanup_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cleanup_website_funnel(integer, boolean, boolean, boolean) TO authenticated;
