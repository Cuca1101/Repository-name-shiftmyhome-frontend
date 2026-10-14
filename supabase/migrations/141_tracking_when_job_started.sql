-- A started job can be tracked even when the booking is still unpaid.
-- Paid and deposit-paid bookings keep tracking before the driver starts.

create or replace function public.quote_customer_tracking_open(
  p_payment_status text,
  p_status text,
  p_operational_status text,
  p_assignment_status text
) returns boolean
language sql
immutable
as $$
  with keys as (
    select lower(replace(replace(trim(coalesce(v, '')), ' ', '_'), '-', '_')) as key
    from unnest(array[p_status, p_operational_status, p_assignment_status]) as v
  )
  select
    not exists (select 1 from keys where key = 'cancelled')
    and (
      lower(trim(coalesce(p_payment_status, ''))) in ('paid', 'deposit_paid')
      or exists (
        select 1 from keys
        where key in (
          'on_way', 'started', 'start', 'on_the_way', 'on_way_to_collection',
          'arrived', 'arrived_pickup', 'loading', 'loaded', 'pickup_completed',
          'in_transit', 'in_progress', 'on_way_to_delivery', 'arrived_delivery',
          'at_delivery', 'left_for_collection', 'at_collection', 'loading_started',
          'collection_finished', 'items_collected', 'left_for_delivery', 'unloading',
          'unloading_started', 'completed'
        )
      )
    );
$$;

revoke all on function public.quote_customer_tracking_open(text, text, text, text) from public, anon, authenticated;


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
  v_motion_state text;
  v_last_moved_at timestamptz;
  v_stationary_seconds integer;
  v_location jsonb;
  v_hist_moved_at timestamptz;
  v_asg text := '';
  v_on_duty boolean := false;
  v_quote_completed boolean := false;
  v_quote_cancelled boolean := false;
  v_share boolean := false;
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

  IF NOT public.quote_customer_tracking_open(
    v_q.payment_status,
    v_q.status,
    v_q.operational_status,
    (
      SELECT ja.status
      FROM public.job_assignments ja
      WHERE ja.quote_id = v_q.id
        AND (v_q.assigned_driver_id IS NULL OR ja.driver_id = v_q.assigned_driver_id)
      ORDER BY ja.updated_at DESC NULLS LAST
      LIMIT 1
    )
  ) THEN
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

  IF v_q.assigned_driver_id IS NOT NULL THEN
    SELECT lower(trim(COALESCE(ja.status, ''))) INTO v_asg
    FROM public.job_assignments ja
    WHERE ja.quote_id = v_q.id
      AND ja.driver_id = v_q.assigned_driver_id
    ORDER BY ja.updated_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  v_on_duty := v_loc.id IS NOT NULL
    AND lower(trim(COALESCE(v_loc.status, ''))) <> ''
    AND lower(trim(COALESCE(v_loc.status, ''))) <> 'off_duty';

  v_quote_completed := v_q.completed_at IS NOT NULL
    OR lower(COALESCE(v_q.operational_status, '')) = 'completed'
    OR lower(COALESCE(v_q.status, '')) = 'completed'
    OR COALESCE(v_asg, '') = 'completed';

  v_quote_cancelled := lower(COALESCE(v_q.operational_status, '')) = 'cancelled'
    OR lower(COALESCE(v_q.status, '')) = 'cancelled'
    OR COALESCE(v_asg, '') = 'cancelled';

  v_share := public.customer_may_see_driver_position(
    v_q.move_date,
    v_q.assigned_driver_id IS NOT NULL
      AND COALESCE(v_asg, '') NOT IN ('completed', 'cancelled', 'inactive', 'unassigned', 'removed'),
    v_on_duty,
    v_quote_completed,
    v_quote_cancelled,
    (timezone('Europe/London', now()))::date
  );

  v_has_coords := (
    v_share
    AND v_loc.id IS NOT NULL
    AND v_loc.latitude IS NOT NULL
    AND v_loc.longitude IS NOT NULL
  );

  v_live := (
    v_has_coords
    AND COALESCE(v_loc.sampled_at, v_loc.updated_at) IS NOT NULL
    AND COALESCE(v_loc.sampled_at, v_loc.updated_at) > now() - interval '3 minutes'
  );

  IF v_q.assigned_driver_id IS NOT NULL THEN
    SELECT max(h.recorded_at) INTO v_hist_moved_at
    FROM (
      SELECT
        s.recorded_at,
        public.gps_haversine_metres(
          lag(s.latitude::float8) OVER (ORDER BY s.recorded_at),
          lag(s.longitude::float8) OVER (ORDER BY s.recorded_at),
          s.latitude::float8,
          s.longitude::float8
        ) AS dist_m,
        CASE
          WHEN s.speed IS NULL THEN 0
          WHEN s.speed::float8 > 45 THEN s.speed::float8 / 2.23694
          ELSE s.speed::float8
        END AS speed_mps
      FROM (
        SELECT latitude, longitude, speed, recorded_at
        FROM public.driver_location_history
        WHERE driver_id = v_q.assigned_driver_id
          AND recorded_at > now() - interval '12 hours'
          AND (quote_id = v_q.id OR quote_id IS NULL)
        ORDER BY recorded_at DESC
        LIMIT 120
      ) s
    ) h
    WHERE h.dist_m IS NOT NULL
      AND (h.dist_m >= 40 OR h.speed_mps >= 1.4);
  END IF;

  v_last_moved_at := COALESCE(v_loc.last_moved_at, v_hist_moved_at, v_loc.updated_at);
  IF v_hist_moved_at IS NOT NULL
     AND (v_loc.last_moved_at IS NULL OR v_hist_moved_at > v_loc.last_moved_at) THEN
    v_last_moved_at := v_hist_moved_at;
  END IF;

  v_motion_state := lower(COALESCE(NULLIF(trim(v_loc.motion_state), ''), 'stationary'));
  IF v_hist_moved_at IS NOT NULL
     AND v_loc.updated_at IS NOT NULL
     AND v_hist_moved_at >= v_loc.updated_at - interval '20 seconds' THEN
    v_motion_state := 'moving';
  END IF;

  IF v_live THEN
    IF v_motion_state = 'moving' THEN
      v_location := jsonb_build_object(
        'latitude', v_loc.latitude,
        'longitude', v_loc.longitude,
        'updated_at', COALESCE(v_loc.sampled_at, v_loc.updated_at),
        'heading', v_loc.heading,
        'speed', v_loc.speed,
        'status', v_loc.status,
        'available', true,
        'live', true,
        'motion', jsonb_build_object(
          'state', 'moving',
          'label', 'Driver moving',
          'last_moved_at', v_last_moved_at,
          'stationary_minutes', NULL
        )
      );
    ELSE
      v_stationary_seconds := GREATEST(
        0,
        FLOOR(EXTRACT(EPOCH FROM (COALESCE(v_loc.updated_at, now()) - COALESCE(v_last_moved_at, v_loc.updated_at))))::int
      );
      v_location := jsonb_build_object(
        'latitude', v_loc.latitude,
        'longitude', v_loc.longitude,
        'updated_at', COALESCE(v_loc.sampled_at, v_loc.updated_at),
        'heading', v_loc.heading,
        'speed', v_loc.speed,
        'status', v_loc.status,
        'available', true,
        'live', true,
        'motion', jsonb_build_object(
          'state', 'stationary',
          'label', CASE
            WHEN v_stationary_seconds < 60 THEN 'Driver stopped'
            ELSE 'Driver stopped for ' || FLOOR(v_stationary_seconds / 60.0)::int || ' min'
          END,
          'last_moved_at', v_last_moved_at,
          'stationary_minutes', FLOOR(v_stationary_seconds / 60.0)::int,
          'stationary_seconds', v_stationary_seconds
        )
      );
    END IF;
  ELSIF v_has_coords
    AND lower(COALESCE(v_q.operational_status, v_q.status, '')) NOT IN ('completed', 'cancelled')
  THEN
    v_location := jsonb_build_object(
      'latitude', v_loc.latitude,
      'longitude', v_loc.longitude,
      'updated_at', COALESCE(v_loc.sampled_at, v_loc.updated_at),
      'heading', v_loc.heading,
      'speed', v_loc.speed,
      'status', v_loc.status,
      'available', true,
      'live', false,
      'message', 'Last known location',
      'motion', jsonb_build_object(
        'state', 'stale',
        'label', 'Last known location',
        'last_moved_at', v_last_moved_at,
        'stationary_minutes', NULL
      )
    );
  ELSE
    v_location := jsonb_build_object(
      'available', false,
      'message', 'Location temporarily unavailable',
      'motion', jsonb_build_object(
        'state', 'unavailable',
        'label', 'GPS unavailable'
      )
    );
  END IF;

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
    'cancelled', v_quote_cancelled,
    'assignment_status', NULLIF(v_asg, ''),
    'tracking_live', v_live,
    'driver', CASE WHEN v_driver.id IS NULL THEN NULL ELSE jsonb_build_object(
      'full_name', v_driver.full_name,
      'phone', v_driver.phone,
      'vehicle_registration', v_driver.vehicle_registration,
      'vehicle_type', v_driver.vehicle_type
    ) END,
    'location', v_location,
    'inventory', v_inventory,
    'inventory_text', v_q.inventory_text,
    'photos', v_photos,
    'waivers', v_waiver,
    'feedback_submitted', v_feedback_done,
    'tip_total_gbp', v_tip_paid,
    'completed', v_quote_completed
  );
END;
$$;



create or replace function public.customer_portal_get_booking(p_quote_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := public.customer_portal_email();
  v_customer_id uuid;
  v_q public.quotes%rowtype;
  v_token uuid;
  v_amendments jsonb;
begin
  if v_email = '' or p_quote_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  select id into v_customer_id from public.customers where email = v_email;

  select * into v_q
  from public.quotes q
  where q.id = p_quote_id
    and public.portal_quote_belongs_to_customer(v_customer_id, v_email, q.customer_id, q.email)
    and public.quote_is_customer_booking(
      q.payment_status, q.source, q.email, q.is_test, q.archived_for_go_live, q.quote_ref
    );

  if v_q.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if public.quote_customer_tracking_open(
    v_q.payment_status,
    v_q.status,
    v_q.operational_status,
    (
      select a.status
      from public.job_assignments a
      where a.quote_id = v_q.id
      order by a.updated_at desc nulls last
      limit 1
    )
  ) then
    v_token := public.ensure_job_tracking_token(v_q.id);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'status', a.status,
    'previous_total', a.previous_total,
    'next_total', a.next_total,
    'payment_delta', a.payment_delta,
    'existing_balance', a.existing_balance,
    'changes', a.changes,
    'approval_reasons', a.approval_reasons,
    'refund_due', a.refund_due,
    'created_at', a.created_at,
    'applied_at', a.applied_at,
    'paid_at', a.paid_at,
    'acted_as', a.acted_as,
    'acted_by', a.acted_by
  ) order by a.created_at desc), '[]'::jsonb)
  into v_amendments
  from public.customer_booking_amendments a
  where a.quote_id = v_q.id;

  return jsonb_build_object(
    'ok', true,
    'booking', public.customer_portal_booking_json(v_q, true),
    'tracking_token', v_token,
    'amendments', v_amendments
  );
end;
$$;

create or replace function public.admin_customer_portal_booking(p_customer_id uuid, p_quote_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customers%rowtype;
  v_q public.quotes%rowtype;
  v_token uuid;
  v_amendments jsonb;
  v_feedback jsonb;
begin
  if not public.auth_is_admin_session() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_customer_id is null or p_quote_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select * into v_customer from public.customers where id = p_customer_id;
  if v_customer.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select * into v_q
  from public.quotes q
  where q.id = p_quote_id
    and public.portal_quote_belongs_to_customer(v_customer.id, v_customer.email, q.customer_id, q.email)
    and public.quote_is_customer_booking(
      q.payment_status, q.source, q.email, q.is_test, q.archived_for_go_live, q.quote_ref
    );

  if v_q.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if public.quote_customer_tracking_open(
    v_q.payment_status,
    v_q.status,
    v_q.operational_status,
    (
      select a.status
      from public.job_assignments a
      where a.quote_id = v_q.id
      order by a.updated_at desc nulls last
      limit 1
    )
  ) then
    v_token := public.ensure_job_tracking_token(v_q.id);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'status', a.status,
    'previous_total', a.previous_total,
    'next_total', a.next_total,
    'payment_delta', a.payment_delta,
    'existing_balance', a.existing_balance,
    'changes', a.changes,
    'approval_reasons', a.approval_reasons,
    'refund_due', a.refund_due,
    'created_at', a.created_at,
    'applied_at', a.applied_at,
    'paid_at', a.paid_at,
    'acted_as', a.acted_as,
    'acted_by', a.acted_by
  ) order by a.created_at desc), '[]'::jsonb)
  into v_amendments
  from public.customer_booking_amendments a
  where a.quote_id = v_q.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', f.id,
    'rating', f.rating,
    'driver_rating', f.driver_rating,
    'review_text', f.review_text,
    'customer_name', f.customer_name,
    'submitted_at', f.submitted_at
  ) order by f.submitted_at desc), '[]'::jsonb)
  into v_feedback
  from public.job_customer_feedback f
  where f.quote_id = v_q.id;

  return jsonb_build_object(
    'ok', true,
    'customer', public.customer_profile_json(v_customer),
    'booking', public.customer_portal_booking_json(v_q, true),
    'tracking_token', v_token,
    'amendments', v_amendments,
    'feedback', v_feedback
  );
end;
$$;

