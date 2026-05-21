-- One-shot go-live cleanup (run as postgres via: npx supabase db query --linked -f supabase/scripts/run-go-live-cleanup.sql)
-- Archives all quotes without Stripe link; hides journeys; optional funnel demo purge.

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS archived_for_go_live boolean NOT NULL DEFAULT false;

DO $$
DECLARE
  v_batch integer := 500;
  v_pass integer := 0;
  v_total_quotes bigint := 0;
  v_total_journeys bigint := 0;
  v_q bigint;
  v_j bigint;
  v_result jsonb;
BEGIN
  LOOP
    v_pass := v_pass + 1;
    EXIT WHEN v_pass > 100;

    v_result := public.admin_live_launch_cleanup(v_batch);
    v_q := COALESCE((v_result->>'quotes_archived')::bigint, 0);
    v_j := COALESCE((v_result->>'journeys_archived')::bigint, 0);
    v_total_quotes := v_total_quotes + v_q;
    v_total_journeys := v_total_journeys + v_j;

    EXIT WHEN v_q = 0 AND v_j = 0;
  END LOOP;

  RAISE NOTICE 'go-live cleanup passes=%, quotes_archived=%, journeys_archived=%',
    v_pass, v_total_quotes, v_total_journeys;
END;
$$;

-- Website funnel demo/abandoned cleanup (migration 035)
DO $$
DECLARE
  v_result jsonb;
  v_pass integer := 0;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'admin_cleanup_website_funnel'
  ) THEN
    LOOP
      v_pass := v_pass + 1;
      EXIT WHEN v_pass > 60;
      v_result := public.admin_cleanup_website_funnel(7, true, true, true);
      EXIT WHEN COALESCE((v_result->>'events_deleted')::int, 0) = 0
        AND COALESCE((v_result->>'leads_deleted')::int, 0) = 0;
    END LOOP;
    RAISE NOTICE 'funnel cleanup done, passes=%', v_pass;
  END IF;
END;
$$;

-- Cancel job cards linked to archived quotes
UPDATE public.jobs j
SET status = 'Cancelled'
WHERE j.status IS DISTINCT FROM 'Cancelled'
  AND EXISTS (
    SELECT 1
    FROM public.quotes q
    WHERE q.archived_for_go_live = true
      AND j.price_inputs IS NOT NULL
      AND (j.price_inputs->>'quoteRef') = q.quote_ref
  );

-- Waive driver charges on archived quotes
UPDATE public.driver_charges dc
SET status = 'waived',
    notes = COALESCE(NULLIF(trim(dc.notes), ''), 'Waived — pre-launch test cleanup'),
    resolved_at = COALESCE(dc.resolved_at, now())
WHERE dc.quote_id IN (SELECT id FROM public.quotes WHERE archived_for_go_live = true)
  AND dc.status NOT IN ('waived', 'cancelled');

-- Verification summary (visible in query output)
SELECT 'stats' AS section, public.admin_live_launch_cleanup_stats() AS payload;

SELECT 'inbox_counts' AS section, jsonb_build_object(
  'total_quotes', (SELECT count(*)::int FROM public.quotes),
  'stripe_protected', (
    SELECT count(*)::int FROM public.quotes q WHERE public.quote_is_protected_for_launch(q.id)
  ),
  'archived_for_go_live', (
    SELECT count(*)::int FROM public.quotes WHERE archived_for_go_live = true
  ),
  'available_jobs_visible', (
    SELECT count(*)::int FROM public.quotes q
    WHERE q.payment_status IN ('paid', 'deposit_paid')
      AND q.cancelled_at IS NULL
      AND COALESCE(q.archived_for_go_live, false) = false
      AND COALESCE(q.is_test, false) = false
      AND COALESCE(q.operational_status, '') NOT IN ('Cancelled', 'cancelled', 'completed', 'Completed')
      AND COALESCE(q.marketplace_visibility, '') NOT IN ('visible_in_marketplace', 'assigned', 'cancelled', 'completed')
      AND (q.assigned_driver_id IS NULL OR trim(q.assigned_driver_id::text) = '')
      AND (q.assigned_partner_id IS NULL OR trim(q.assigned_partner_id::text) = '')
      AND (q.bundled_journey_id IS NULL)
  ),
  'marketplace_visible', (
    SELECT count(*)::int FROM public.quotes q
    WHERE q.marketplace_visibility = 'visible_in_marketplace'
      AND COALESCE(q.archived_for_go_live, false) = false
      AND q.cancelled_at IS NULL
  ),
  'journeys_planner_visible', (
    SELECT count(*)::int FROM public.journeys j
    WHERE NOT (
      j.status = 'cancelled' AND j.marketplace_visibility = 'hidden_from_partners'
    )
  )
) AS payload;
