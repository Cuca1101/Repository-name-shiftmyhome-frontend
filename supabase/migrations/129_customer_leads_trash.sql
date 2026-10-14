-- Customer Leads Trash: soft delete. The linked quote/booking is not removed.

ALTER TABLE public.customer_leads
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS customer_leads_deleted_at_idx
  ON public.customer_leads (deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

-- Do not abandon or schedule recovery for a lead sitting in Trash.
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
    AND deleted_at IS NULL
    AND recovery_stopped_at IS NULL
    AND converted_at IS NULL
    AND coalesce(nullif(trim(customer_email), ''), '') <> ''
    AND last_activity_at < now() - make_interval(mins => GREATEST(1, COALESCE(p_inactive_minutes, 15)))
    AND (wizard_step >= 3 OR status IN ('quote_viewed', 'payment_started'));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

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
  WHERE cl.deleted_at IS NULL
    AND cl.abandoned_notification_sent_at IS NULL
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
