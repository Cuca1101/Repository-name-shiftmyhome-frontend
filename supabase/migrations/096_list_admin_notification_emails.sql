-- Resolve admin notification recipients from Auth users with role=admin.

CREATE OR REPLACE FUNCTION public.list_admin_notification_emails()
RETURNS text[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    array_agg(DISTINCT lower(trim(u.email)) ORDER BY lower(trim(u.email)))
      FILTER (WHERE u.email IS NOT NULL AND position('@' in u.email) > 1),
    ARRAY[]::text[]
  )
  FROM auth.users u
  WHERE coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin'
     OR coalesce(u.raw_user_meta_data ->> 'role', '') = 'admin';
$$;

COMMENT ON FUNCTION public.list_admin_notification_emails() IS
  'Emails of Auth users with admin role — used for Resend admin notifications.';

REVOKE ALL ON FUNCTION public.list_admin_notification_emails() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_admin_notification_emails() TO service_role;
