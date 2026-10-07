-- Include last-known GPS on the customer tracking portal even when the 3-minute
-- "live" window has expired, so Track My Driver can still show a map.
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
  v_has_coords boolean;
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

  v_has_coords := (
    v_loc.id IS NOT NULL
    AND v_loc.latitude IS NOT NULL
    AND v_loc.longitude IS NOT NULL
  );

  v_live := (
    v_has_coords
    AND v_loc.updated_at IS NOT NULL
    AND v_loc.updated_at > now() - interval '3 minutes'
    AND lower(COALESCE(v_status, '')) NOT IN ('completed', 'cancelled')
    AND lower(COALESCE(v_q.operational_status, '')) NOT IN ('completed', 'cancelled')
  );

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
        'available', true,
        'live', true
      )
      WHEN v_has_coords
        AND lower(COALESCE(v_q.operational_status, v_q.status, '')) NOT IN ('completed', 'cancelled')
      THEN jsonb_build_object(
        'latitude', v_loc.latitude,
        'longitude', v_loc.longitude,
        'updated_at', v_loc.updated_at,
        'heading', v_loc.heading,
        'speed', v_loc.speed,
        'status', v_loc.status,
        'available', true,
        'live', false,
        'message', 'Showing last known location — waiting for a fresh GPS update from the driver'
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
