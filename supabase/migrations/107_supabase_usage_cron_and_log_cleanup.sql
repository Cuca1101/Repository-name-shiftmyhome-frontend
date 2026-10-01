-- Cut empty cron HTTP calls and keep only recent diagnostic logs.
-- Does not delete quotes, customer_leads, bookings, or storage objects.

CREATE OR REPLACE FUNCTION public.prune_supabase_diagnostic_logs(p_keep_days int DEFAULT 3)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, cron
AS $$
DECLARE
  v_keep interval := make_interval(days => GREATEST(1, LEAST(COALESCE(p_keep_days, 3), 30)));
  v_http bigint := 0;
  v_cron bigint := 0;
BEGIN
  IF to_regclass('net._http_response') IS NOT NULL THEN
    DELETE FROM net._http_response
    WHERE created < now() - v_keep;
    GET DIAGNOSTICS v_http = ROW_COUNT;
  END IF;

  IF to_regclass('cron.job_run_details') IS NOT NULL THEN
    DELETE FROM cron.job_run_details
    WHERE start_time < now() - v_keep;
    GET DIAGNOSTICS v_cron = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'http_response_deleted', v_http,
    'job_run_details_deleted', v_cron,
    'kept_days', GREATEST(1, LEAST(COALESCE(p_keep_days, 3), 30))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.prune_supabase_diagnostic_logs(int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prune_supabase_diagnostic_logs(int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_supabase_diagnostic_logs(int) TO postgres, service_role;

-- Notify cron: call the edge function only when a customer email is waiting.
-- cron.alter_job keeps the existing schedule and the secret already stored in the job.
DO $wrap_notify$
DECLARE
  v_job_id bigint;
  v_command text;
  v_next text;
BEGIN
  SELECT jobid, command
  INTO v_job_id, v_command
  FROM cron.job
  WHERE jobname = 'process-job-customer-notify-every-2-min';

  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'process-job-customer-notify-every-2-min is missing';
  END IF;

  IF v_command ILIKE '%job_customer_notify_queue%' THEN
    RETURN;
  END IF;

  v_next := format(
$fmt$
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.job_customer_notify_queue
    WHERE processed_at IS NULL
  ) THEN
    EXECUTE %L;
  END IF;
END
$do$;
$fmt$,
    v_command
  );

  PERFORM cron.alter_job(v_job_id, NULL, v_next, NULL, NULL, NULL);
END
$wrap_notify$;

-- Recovery cron: mark stale leads in SQL on the same 10-minute schedule.
-- HTTP runs only for a due recovery email or a due admin abandoned alert.
DO $wrap_recovery$
DECLARE
  v_job_id bigint;
  v_command text;
  v_next text;
BEGIN
  SELECT jobid, command
  INTO v_job_id, v_command
  FROM cron.job
  WHERE jobname = 'process-quote-recovery-every-10-min';

  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'process-quote-recovery-every-10-min is missing';
  END IF;

  IF v_command ILIKE '%mark_stale_customer_leads_abandoned%' THEN
    RETURN;
  END IF;

  v_next := format(
$fmt$
DO $do$
BEGIN
  PERFORM public.mark_stale_customer_leads_abandoned(15);
  IF EXISTS (
    SELECT 1
    FROM public.customer_leads
    WHERE next_recovery_email_at <= now()
      AND status IN ('abandoned', 'payment_failed')
      AND recovery_stopped_at IS NULL
      AND coalesce(nullif(trim(customer_email), ''), '') <> ''
  ) OR EXISTS (
    SELECT 1 FROM public.list_admin_abandoned_notification_candidates(30, 1)
  ) THEN
    EXECUTE %L;
  END IF;
END
$do$;
$fmt$,
    v_command
  );

  PERFORM cron.alter_job(v_job_id, NULL, v_next, NULL, NULL, NULL);
END
$wrap_recovery$;

DO $un$
BEGIN
  PERFORM cron.unschedule('prune-diagnostic-logs-daily');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END
$un$;

SELECT cron.schedule(
  'prune-diagnostic-logs-daily',
  '15 3 * * *',
  $$SELECT public.prune_supabase_diagnostic_logs(3)$$
);

SELECT public.prune_supabase_diagnostic_logs(3);
