-- Post-payment customer tracking, notifications, tips & feedback.
-- Secure token portal (no quote UUID exposure). Idempotent event emails.

-- ---------------------------------------------------------------------------
-- Tracking tokens
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_tracking_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_tracking_tokens_quote_unique UNIQUE (quote_id),
  CONSTRAINT job_tracking_tokens_token_unique UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS job_tracking_tokens_token_live_idx
  ON public.job_tracking_tokens (token)
  WHERE revoked_at IS NULL;

ALTER TABLE public.job_tracking_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_tracking_tokens_select_authenticated" ON public.job_tracking_tokens;
CREATE POLICY "job_tracking_tokens_select_authenticated"
  ON public.job_tracking_tokens FOR SELECT TO authenticated USING (true);

GRANT SELECT ON TABLE public.job_tracking_tokens TO authenticated;
GRANT ALL ON TABLE public.job_tracking_tokens TO service_role;

-- ---------------------------------------------------------------------------
-- Notification log (idempotency)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_customer_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  event_label text,
  channel text NOT NULL DEFAULT 'email',
  recipient_email text,
  provider_message_id text,
  delivery_status text NOT NULL DEFAULT 'sent',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_customer_notifications_event_unique UNIQUE (quote_id, event_key)
);

CREATE INDEX IF NOT EXISTS job_customer_notifications_quote_idx
  ON public.job_customer_notifications (quote_id, sent_at DESC);

ALTER TABLE public.job_customer_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_customer_notifications_select_authenticated" ON public.job_customer_notifications;
CREATE POLICY "job_customer_notifications_select_authenticated"
  ON public.job_customer_notifications FOR SELECT TO authenticated USING (true);

GRANT SELECT ON TABLE public.job_customer_notifications TO authenticated;
GRANT ALL ON TABLE public.job_customer_notifications TO service_role;

-- ---------------------------------------------------------------------------
-- Feedback (one per booking)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_customer_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  tracking_token uuid NOT NULL,
  rating int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  driver_rating int CHECK (driver_rating IS NULL OR (driver_rating >= 1 AND driver_rating <= 5)),
  review_text text,
  customer_name text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_customer_feedback_quote_unique UNIQUE (quote_id)
);

CREATE INDEX IF NOT EXISTS job_customer_feedback_quote_idx ON public.job_customer_feedback (quote_id);

ALTER TABLE public.job_customer_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_customer_feedback_select_authenticated" ON public.job_customer_feedback;
CREATE POLICY "job_customer_feedback_select_authenticated"
  ON public.job_customer_feedback FOR SELECT TO authenticated USING (true);

GRANT SELECT ON TABLE public.job_customer_feedback TO authenticated;
GRANT ALL ON TABLE public.job_customer_feedback TO service_role;

-- ---------------------------------------------------------------------------
-- Tips
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  tracking_token uuid,
  amount_gbp numeric(10,2) NOT NULL CHECK (amount_gbp > 0),
  currency text NOT NULL DEFAULT 'gbp',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
  stripe_session_id text,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  customer_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_tips_quote_idx ON public.job_tips (quote_id, created_at DESC);
CREATE INDEX IF NOT EXISTS job_tips_driver_idx ON public.job_tips (driver_id) WHERE status = 'paid';

ALTER TABLE public.job_tips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_tips_select_authenticated" ON public.job_tips;
CREATE POLICY "job_tips_select_authenticated"
  ON public.job_tips FOR SELECT TO authenticated USING (true);

GRANT SELECT ON TABLE public.job_tips TO authenticated;
GRANT ALL ON TABLE public.job_tips TO service_role;

-- Quote tip summary columns (admin / driver earnings)
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS tip_total_gbp numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tip_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_feedback_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_feedback_rating int;

-- ---------------------------------------------------------------------------
-- Ensure tracking token (paid bookings only for customer emails)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_job_tracking_token(p_quote_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token uuid;
BEGIN
  IF p_quote_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.job_tracking_tokens (quote_id)
  VALUES (p_quote_id)
  ON CONFLICT (quote_id) DO UPDATE
    SET updated_at = now(),
        revoked_at = CASE
          WHEN lower(COALESCE((SELECT payment_status FROM public.quotes WHERE id = p_quote_id), '')) IN ('cancelled')
            THEN job_tracking_tokens.revoked_at
          WHEN EXISTS (
            SELECT 1 FROM public.quotes q
            WHERE q.id = p_quote_id
              AND (
                lower(COALESCE(q.operational_status, '')) = 'cancelled'
                OR lower(COALESCE(q.status, '')) = 'cancelled'
              )
          ) THEN now()
          ELSE NULL
        END,
        expires_at = GREATEST(job_tracking_tokens.expires_at, now() + interval '90 days')
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_job_tracking_token(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_job_tracking_token(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.revoke_job_tracking_token(p_quote_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.job_tracking_tokens
  SET revoked_at = COALESCE(revoked_at, now()), updated_at = now()
  WHERE quote_id = p_quote_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_job_tracking_token(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_job_tracking_token(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Public: get tracking payload by token (safe fields only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_get_job_tracking(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tok public.job_tracking_tokens%ROWTYPE;
  v_q public.quotes%ROWTYPE;
  v_driver public.drivers%ROWTYPE;
  v_loc public.driver_locations%ROWTYPE;
  v_status text;
  v_live boolean;
  v_inventory jsonb;
  v_photos jsonb;
  v_waiver jsonb;
  v_feedback_done boolean;
  v_tip_paid numeric;
BEGIN
  IF p_token IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  SELECT * INTO v_tok FROM public.job_tracking_tokens WHERE token = p_token LIMIT 1;
  IF v_tok.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  IF v_tok.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'revoked');
  END IF;
  IF v_tok.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  SELECT * INTO v_q FROM public.quotes WHERE id = v_tok.quote_id LIMIT 1;
  IF v_q.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- Paid gate for live portal (deposit_paid or paid)
  IF lower(COALESCE(v_q.payment_status, '')) NOT IN ('paid', 'deposit_paid') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_paid');
  END IF;

  IF v_q.assigned_driver_id IS NOT NULL THEN
    SELECT * INTO v_driver FROM public.drivers WHERE id = v_q.assigned_driver_id LIMIT 1;
    SELECT * INTO v_loc FROM public.driver_locations WHERE driver_id = v_q.assigned_driver_id LIMIT 1;
  END IF;

  v_status := COALESCE(
    NULLIF(trim(v_q.status), ''),
    NULLIF(trim(v_q.operational_status), ''),
    'assigned'
  );

  v_live := (
    v_loc.id IS NOT NULL
    AND v_loc.updated_at IS NOT NULL
    AND v_loc.updated_at > now() - interval '3 minutes'
    AND v_loc.latitude IS NOT NULL
    AND v_loc.longitude IS NOT NULL
    AND lower(COALESCE(v_status, '')) NOT IN ('completed', 'cancelled')
    AND lower(COALESCE(v_q.operational_status, '')) NOT IN ('completed', 'cancelled')
  );

  -- Inventory from quote.inventory jsonb when present
  IF v_q.inventory IS NOT NULL AND jsonb_typeof(v_q.inventory::jsonb) = 'array' THEN
    v_inventory := v_q.inventory::jsonb;
  ELSIF v_q.inventory IS NOT NULL AND jsonb_typeof(to_jsonb(v_q.inventory)) = 'array' THEN
    v_inventory := to_jsonb(v_q.inventory);
  ELSE
    v_inventory := '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'photo_type', p.photo_type,
    'stop_type', p.stop_type,
    'storage_path', p.storage_path,
    'file_name', p.file_name,
    'mime_type', p.mime_type,
    'uploaded_by', p.uploaded_by,
    'created_at', p.created_at,
    'driver_id', p.driver_id,
    'metadata', p.metadata
  ) ORDER BY p.created_at), '[]'::jsonb)
  INTO v_photos
  FROM public.job_photos p
  WHERE p.quote_id = v_q.id
     OR (v_q.quote_ref IS NOT NULL AND p.quote_ref = v_q.quote_ref);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'photo_type', p.photo_type,
    'storage_path', p.storage_path,
    'mime_type', p.mime_type,
    'created_at', p.created_at,
    'metadata', p.metadata,
    'file_name', p.file_name
  ) ORDER BY p.created_at DESC), '[]'::jsonb)
  INTO v_waiver
  FROM public.job_photos p
  WHERE (p.quote_id = v_q.id OR (v_q.quote_ref IS NOT NULL AND p.quote_ref = v_q.quote_ref))
    AND p.photo_type IN ('waiver_signature', 'pod_signature');

  SELECT EXISTS(SELECT 1 FROM public.job_customer_feedback f WHERE f.quote_id = v_q.id)
  INTO v_feedback_done;

  SELECT COALESCE(SUM(t.amount_gbp), 0) INTO v_tip_paid
  FROM public.job_tips t
  WHERE t.quote_id = v_q.id AND t.status = 'paid';

  RETURN jsonb_build_object(
    'ok', true,
    'token', v_tok.token,
    'quote_ref', v_q.quote_ref,
    'customer_name', v_q.full_name,
    'move_date', v_q.move_date,
    'arrival_window', v_q.arrival_window,
    'pickup_address', v_q.pickup_address,
    'delivery_address', v_q.delivery_address,
    'estimated_total', v_q.estimated_total,
    'amount_paid', v_q.amount_paid,
    'payment_status', v_q.payment_status,
    'status_raw', v_status,
    'operational_status', v_q.operational_status,
    'completed_at', v_q.completed_at,
    'cancelled', lower(COALESCE(v_q.operational_status, v_q.status, '')) IN ('cancelled', 'Cancelled'),
    'tracking_live', v_live AND NOT (lower(COALESCE(v_q.operational_status, '')) IN ('completed', 'cancelled')),
    'driver', CASE WHEN v_driver.id IS NULL THEN NULL ELSE jsonb_build_object(
      'full_name', v_driver.full_name,
      'phone', v_driver.phone,
      'vehicle_registration', v_driver.vehicle_registration,
      'vehicle_type', v_driver.vehicle_type
    ) END,
    'location', CASE
      WHEN v_live THEN jsonb_build_object(
        'latitude', v_loc.latitude,
        'longitude', v_loc.longitude,
        'updated_at', v_loc.updated_at,
        'heading', v_loc.heading,
        'speed', v_loc.speed,
        'status', v_loc.status,
        'available', true
      )
      ELSE jsonb_build_object(
        'available', false,
        'updated_at', v_loc.updated_at,
        'message', 'Location temporarily unavailable'
      )
    END,
    'inventory', v_inventory,
    'inventory_text', v_q.inventory_text,
    'photos', v_photos,
    'waivers', v_waiver,
    'feedback_submitted', v_feedback_done,
    'tip_total_gbp', v_tip_paid,
    'completed', lower(COALESCE(v_q.operational_status, v_q.status, '')) IN ('completed')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_get_job_tracking(uuid) TO anon, authenticated, service_role;

-- Signed URL helper is edge-side; portal uses edge function for photo URLs.

-- ---------------------------------------------------------------------------
-- Queue + trigger: notify on job_status_history insert
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_customer_notify_queue (
  id bigserial PRIMARY KEY,
  quote_id uuid NOT NULL,
  event_key text NOT NULL,
  status_raw text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error text
);

CREATE INDEX IF NOT EXISTS job_customer_notify_queue_pending_idx
  ON public.job_customer_notify_queue (created_at)
  WHERE processed_at IS NULL;

GRANT ALL ON TABLE public.job_customer_notify_queue TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.job_customer_notify_queue_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_job_customer_status_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_status text := lower(trim(COALESCE(NEW.status, '')));
BEGIN
  IF NEW.quote_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Map mobile statuses → notification event keys (idempotent per quote)
  IF v_status IN ('on_way', 'started', 'start') THEN
    v_key := 'status_on_way';
  ELSIF v_status IN ('arrived', 'arrived_pickup') THEN
    v_key := 'status_arrived_pickup';
  ELSIF v_status IN ('pickup_completed', 'loaded') THEN
    v_key := 'status_pickup_completed';
  ELSIF v_status IN ('in_transit') THEN
    v_key := 'status_in_transit';
  ELSIF v_status IN ('arrived_delivery') THEN
    v_key := 'status_arrived_delivery';
  ELSIF v_status IN ('completed') THEN
    v_key := 'status_completed';
  ELSE
    RETURN NEW;
  END IF;

  -- Skip if already notified for this event
  IF EXISTS (
    SELECT 1 FROM public.job_customer_notifications n
    WHERE n.quote_id = NEW.quote_id AND n.event_key = v_key
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.job_customer_notify_queue (quote_id, event_key, status_raw)
  VALUES (NEW.quote_id, v_key, NEW.status);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_job_customer_status_notify ON public.job_status_history;
CREATE TRIGGER trg_enqueue_job_customer_status_notify
  AFTER INSERT ON public.job_status_history
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_job_customer_status_notify();

-- Revoke tracking when cancelled
CREATE OR REPLACE FUNCTION public.revoke_tracking_on_quote_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(COALESCE(NEW.operational_status, '')) = 'cancelled'
     OR lower(COALESCE(NEW.status, '')) = 'cancelled' THEN
    PERFORM public.revoke_job_tracking_token(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_revoke_tracking_on_quote_cancel ON public.quotes;
CREATE TRIGGER trg_revoke_tracking_on_quote_cancel
  AFTER UPDATE OF operational_status, status ON public.quotes
  FOR EACH ROW
  WHEN (
    lower(COALESCE(NEW.operational_status, '')) = 'cancelled'
    OR lower(COALESCE(NEW.status, '')) = 'cancelled'
  )
  EXECUTE FUNCTION public.revoke_tracking_on_quote_cancel();
