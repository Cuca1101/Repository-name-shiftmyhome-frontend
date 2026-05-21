-- Pre-launch admin cleanup: archive non-protected quotes/journeys (never deletes paid/Stripe-linked rows).
-- Complements client-side ProductionDataCleanupModal; requires authenticated admin (RLS bypass via SECURITY DEFINER).

CREATE OR REPLACE FUNCTION public.quote_is_protected_for_launch(p_quote_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_payment_status text;
  v_paid_at timestamptz;
  v_stripe_pi text;
  v_stripe_sess text;
BEGIN
  IF p_quote_id IS NULL THEN
    RETURN true;
  END IF;

  SELECT
    q.payment_status,
    q.paid_at,
    q.stripe_payment_intent_id,
    q.stripe_session_id
  INTO v_payment_status, v_paid_at, v_stripe_pi, v_stripe_sess
  FROM public.quotes q
  WHERE q.id = p_quote_id;

  IF NOT FOUND THEN
    RETURN true;
  END IF;

  IF COALESCE(v_payment_status, '') IN ('paid', 'deposit_paid') OR v_paid_at IS NOT NULL THEN
    RETURN true;
  END IF;

  IF COALESCE(v_stripe_pi, '') <> '' OR COALESCE(v_stripe_sess, '') <> '' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_live_launch_cleanup_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quotes bigint := 0;
  v_journeys bigint := 0;
  v_protected bigint := 0;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quotes'
      AND column_name = 'is_test'
  ) THEN
    SELECT count(*)::bigint INTO v_quotes
    FROM public.quotes q
    WHERE NOT public.quote_is_protected_for_launch(q.id)
      AND COALESCE(q.is_test, false) = false;
  ELSE
    SELECT count(*)::bigint INTO v_quotes
    FROM public.quotes q
    WHERE NOT public.quote_is_protected_for_launch(q.id);
  END IF;

  SELECT count(*)::bigint INTO v_protected
  FROM public.quotes q
  WHERE public.quote_is_protected_for_launch(q.id);

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'journeys'
  ) THEN
    SELECT count(*)::bigint INTO v_journeys FROM public.journeys j;
  END IF;

  RETURN jsonb_build_object(
    'quotes_to_archive', v_quotes,
    'quotes_protected', v_protected,
    'journeys_to_archive', v_journeys
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_live_launch_cleanup(p_batch_size integer DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch integer := LEAST(GREATEST(COALESCE(p_batch_size, 200), 1), 500);
  v_archived bigint := 0;
  v_journeys bigint := 0;
  v_ts timestamptz := now();
  v_has_is_test boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quotes'
      AND column_name = 'is_test'
  ) INTO v_has_is_test;

  IF v_has_is_test THEN
    EXECUTE $sql$
      UPDATE public.quotes q
      SET
        operational_status = 'Cancelled',
        cancelled_at = COALESCE(q.cancelled_at, $1),
        admin_cancellation_reason = COALESCE(
          NULLIF(trim(q.admin_cancellation_reason), ''),
          'PRE-LAUNCH TEST DATA ARCHIVED'
        ),
        marketplace_visibility = 'cancelled',
        is_test = true,
        assigned_driver_id = NULL,
        assigned_driver_name = NULL,
        assigned_partner_id = NULL,
        assigned_partner_company = NULL
      WHERE q.id IN (
        SELECT q2.id
        FROM public.quotes q2
        WHERE NOT public.quote_is_protected_for_launch(q2.id)
          AND COALESCE(q2.is_test, false) = false
        LIMIT $2
      )
    $sql$
    USING v_ts, v_batch;
  ELSE
    UPDATE public.quotes q
    SET
      operational_status = 'Cancelled',
      cancelled_at = COALESCE(q.cancelled_at, v_ts),
      admin_cancellation_reason = COALESCE(
        NULLIF(trim(q.admin_cancellation_reason), ''),
        'PRE-LAUNCH TEST DATA ARCHIVED'
      ),
      marketplace_visibility = 'cancelled',
      assigned_driver_id = NULL,
      assigned_driver_name = NULL,
      assigned_partner_id = NULL,
      assigned_partner_company = NULL
    WHERE q.id IN (
      SELECT q2.id
      FROM public.quotes q2
      WHERE NOT public.quote_is_protected_for_launch(q2.id)
      LIMIT v_batch
    );
  END IF;

  GET DIAGNOSTICS v_archived = ROW_COUNT;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'journeys'
  ) THEN
    UPDATE public.journeys j
    SET
      status = 'cancelled',
      marketplace_visibility = 'hidden_from_partners'
    WHERE j.id IN (
      SELECT j2.id
      FROM public.journeys j2
      WHERE COALESCE(j2.status, '') NOT IN ('cancelled')
         OR COALESCE(j2.marketplace_visibility, '') <> 'hidden_from_partners'
      LIMIT v_batch
    );
    GET DIAGNOSTICS v_journeys = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'quotes_archived', v_archived,
    'journeys_archived', v_journeys
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.quote_is_protected_for_launch(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_live_launch_cleanup_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_live_launch_cleanup(integer) TO authenticated;
