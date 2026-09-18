-- Job completion thank-you email flags + configurable Google review URL.
-- Tips remain in job_tips (090); tip amounts do not affect booking payment fields.

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS completion_email_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completion_email_sent_at timestamptz;

COMMENT ON COLUMN public.quotes.completion_email_sent IS
  'True after the job-completed thank-you email was sent (once unless admin force-resends).';
COMMENT ON COLUMN public.quotes.completion_email_sent_at IS
  'When the job-completed thank-you email was last sent successfully.';

CREATE INDEX IF NOT EXISTS quotes_completion_email_sent_at_idx
  ON public.quotes (completion_email_sent_at DESC)
  WHERE completion_email_sent = true;

-- Admin-editable Google Business review link (Website CMS → Reviews / Ops).
ALTER TABLE public.website_settings
  ADD COLUMN IF NOT EXISTS ops jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.website_settings.ops IS
  'Operational site settings (e.g. google_review_url for completion emails).';

UPDATE public.website_settings
SET ops = COALESCE(ops, '{}'::jsonb) || jsonb_build_object(
  'google_review_url',
  COALESCE(
    NULLIF(trim(ops->>'google_review_url'), ''),
    'https://g.page/r/CWmwRUPz2dC7EAE/review'
  )
)
WHERE id = 'default'
  AND (
    ops IS NULL
    OR ops = '{}'::jsonb
    OR NULLIF(trim(ops->>'google_review_url'), '') IS NULL
  );

-- Enqueue completion email when admin/driver marks quote Completed (not only job_status_history).
CREATE OR REPLACE FUNCTION public.enqueue_job_completed_notify_on_quote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_op text := lower(trim(COALESCE(NEW.operational_status, '')));
  v_old_op text := lower(trim(COALESCE(OLD.operational_status, '')));
  v_new_st text := lower(trim(COALESCE(NEW.status, '')));
  v_old_st text := lower(trim(COALESCE(OLD.status, '')));
  v_became_completed boolean := false;
BEGIN
  IF v_new_op = 'completed' AND v_old_op IS DISTINCT FROM 'completed' THEN
    v_became_completed := true;
  ELSIF v_new_st = 'completed' AND v_old_st IS DISTINCT FROM 'completed' THEN
    v_became_completed := true;
  END IF;

  IF NOT v_became_completed THEN
    RETURN NEW;
  END IF;

  -- Already sent (or claimed) — skip queue
  IF COALESCE(NEW.completion_email_sent, false) = true THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.job_customer_notifications n
    WHERE n.quote_id = NEW.id AND n.event_key = 'status_completed'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.job_customer_notify_queue (quote_id, event_key, status_raw)
  VALUES (NEW.id, 'status_completed', COALESCE(NEW.operational_status, NEW.status, 'Completed'));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_job_completed_notify_on_quote ON public.quotes;
CREATE TRIGGER trg_enqueue_job_completed_notify_on_quote
  AFTER UPDATE OF operational_status, status ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_job_completed_notify_on_quote();
