-- Public check for the "Continue your saved quote" prompt.
-- Returns a status only. Does not expose customer details or change any row.

CREATE OR REPLACE FUNCTION public.public_saved_quote_resume_status(
  p_quote_ref text,
  p_session_id text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref text := nullif(trim(coalesce(p_quote_ref, '')), '');
BEGIN
  IF v_ref IS NULL THEN
    RETURN jsonb_build_object('state', 'unknown');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.quotes q
    WHERE q.quote_ref = v_ref
      AND q.deleted_at IS NULL
      AND lower(coalesce(q.payment_status, '')) IN ('paid', 'deposit_paid')
  ) OR EXISTS (
    SELECT 1
    FROM public.customer_leads l
    WHERE l.quote_ref = v_ref
      AND l.status = 'converted_to_booking'
  ) THEN
    RETURN jsonb_build_object('state', 'booked');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.quotes q
    WHERE q.quote_ref = v_ref
      AND q.deleted_at IS NOT NULL
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.quotes q
    WHERE q.quote_ref = v_ref
      AND q.deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('state', 'closed');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.customer_leads l
    WHERE l.quote_ref = v_ref
  ) OR EXISTS (
    SELECT 1
    FROM public.quotes q
    WHERE q.quote_ref = v_ref
      AND q.deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('state', 'resumable');
  END IF;

  RETURN jsonb_build_object('state', 'unknown');
END;
$$;

REVOKE ALL ON FUNCTION public.public_saved_quote_resume_status(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.public_saved_quote_resume_status(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.public_saved_quote_resume_status(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_saved_quote_resume_status(text, text) TO service_role;
