-- Tighten abandoned admin candidates: require contact fields before notify path.

CREATE OR REPLACE FUNCTION public.list_admin_abandoned_notification_candidates(
  p_inactive_minutes int DEFAULT 30,
  p_limit int DEFAULT 40
)
RETURNS SETOF public.customer_leads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT cl.*
  FROM public.customer_leads cl
  LEFT JOIN public.quotes q ON q.id = cl.quote_id
  WHERE cl.abandoned_notification_sent_at IS NULL
    AND cl.converted_at IS NULL
    AND cl.status IS DISTINCT FROM 'converted_to_booking'
    AND cl.recovery_stopped_at IS NULL
    AND cl.last_activity_at < now() - make_interval(mins => GREATEST(1, COALESCE(p_inactive_minutes, 30)))
    AND coalesce(nullif(trim(cl.customer_name), ''), '') <> ''
    AND coalesce(nullif(trim(cl.customer_phone), ''), '') <> ''
    AND coalesce(nullif(trim(cl.customer_email), ''), '') <> ''
    AND (
      cl.wizard_step >= 2
      OR cl.status IN ('quote_started', 'quote_viewed', 'payment_started', 'abandoned', 'payment_failed')
    )
    AND COALESCE(lower(trim(q.payment_status)), '') NOT IN ('paid', 'deposit_paid')
    AND q.paid_at IS NULL
  ORDER BY cl.last_activity_at ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 40), 100));
END;
$$;
