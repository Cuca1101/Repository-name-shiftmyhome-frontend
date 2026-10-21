-- New phone booking Trash. Delete hides the quote; permanent delete still uses the pending-booking policy.

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS quotes_phone_booking_deleted_at_idx
  ON public.quotes (deleted_at DESC)
  WHERE deleted_at IS NOT NULL
    AND source IN ('phone_booking', 'admin_phone_booking');

-- Portal booking checks stay in sync with Trash without editing every caller.
CREATE OR REPLACE FUNCTION public.quote_is_customer_booking(
  p_payment_status text,
  p_source text,
  p_email text,
  p_is_test boolean,
  p_archived boolean,
  p_quote_ref text
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT (
      lower(coalesce(p_payment_status, '')) IN ('paid', 'deposit_paid')
      OR lower(coalesce(p_source, '')) IN ('phone_booking', 'admin_phone_booking')
    )
    AND position('@' IN lower(trim(coalesce(p_email, '')))) > 1
    AND lower(trim(coalesce(p_email, ''))) <> 'phone-booking@shiftmyhome.local'
    AND coalesce(p_is_test, false) = false
    AND coalesce(p_archived, false) = false
    AND coalesce(p_quote_ref, '') !~* '(DEMO|TEST)'
    AND (
      coalesce(trim(p_quote_ref), '') = ''
      OR NOT EXISTS (
        SELECT 1
        FROM public.quotes qx
        WHERE qx.quote_ref = p_quote_ref
          AND qx.deleted_at IS NOT NULL
      )
    );
$$;
