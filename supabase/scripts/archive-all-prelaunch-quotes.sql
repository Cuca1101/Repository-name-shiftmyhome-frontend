-- Archive every quote not yet flagged (including Stripe-linked test payments).
-- Does NOT clear stripe_payment_intent_id / payment_status — admin visibility only.

UPDATE public.quotes q
SET
  operational_status = 'Cancelled',
  cancelled_at = COALESCE(q.cancelled_at, now()),
  status = CASE
    WHEN q.status IN ('Booked', 'deposit_paid', 'paid') THEN 'Cancelled'
    ELSE q.status
  END,
  admin_cancellation_reason = COALESCE(
    NULLIF(trim(q.admin_cancellation_reason), ''),
    'PRE-LAUNCH TEST DATA ARCHIVED'
  ),
  marketplace_visibility = 'cancelled',
  is_test = true,
  archived_for_go_live = true,
  assigned_driver_id = NULL,
  assigned_driver_name = NULL,
  assigned_partner_id = NULL,
  assigned_partner_company = NULL
WHERE COALESCE(q.archived_for_go_live, false) = false;

UPDATE public.journeys j
SET
  status = 'cancelled',
  marketplace_visibility = 'hidden_from_partners'
WHERE COALESCE(j.status, '') <> 'cancelled'
   OR COALESCE(j.marketplace_visibility, '') <> 'hidden_from_partners';

UPDATE public.jobs job
SET status = 'Cancelled'
WHERE job.status IS DISTINCT FROM 'Cancelled';

SELECT jsonb_build_object(
  'quotes_total', (SELECT count(*)::int FROM public.quotes),
  'quotes_archived', (SELECT count(*)::int FROM public.quotes WHERE archived_for_go_live = true),
  'quotes_stripe_still', (
    SELECT count(*)::int FROM public.quotes
    WHERE COALESCE(stripe_payment_intent_id, '') <> ''
  ),
  'available_jobs_visible', (
    SELECT count(*)::int FROM public.quotes q
    WHERE q.payment_status IN ('paid', 'deposit_paid')
      AND q.cancelled_at IS NULL
      AND COALESCE(q.archived_for_go_live, false) = false
      AND COALESCE(q.is_test, false) = false
      AND lower(COALESCE(q.operational_status, '')) NOT IN ('cancelled', 'completed')
      AND COALESCE(q.marketplace_visibility, '') NOT IN ('visible_in_marketplace', 'assigned', 'cancelled', 'completed')
      AND q.bundled_journey_id IS NULL
      AND q.assigned_driver_id IS NULL
      AND q.assigned_partner_id IS NULL
  ),
  'marketplace_visible', (
    SELECT count(*)::int FROM public.quotes
    WHERE marketplace_visibility = 'visible_in_marketplace'
      AND archived_for_go_live = false
  ),
  'journeys_visible', (
    SELECT count(*)::int FROM public.journeys
    WHERE NOT (status = 'cancelled' AND marketplace_visibility = 'hidden_from_partners')
  )
) AS verification;
