-- Fix PIN verification: pgcrypto schema, RLS bypass for definer read, grants.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Secrets table is never read from the client; verification is RPC-only.
ALTER TABLE public.admin_config_secrets DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.verify_marketplace_settings_pin(pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  stored_hash text;
  pin_clean text;
BEGIN
  pin_clean := trim(coalesce(pin, ''));
  IF pin_clean = '' THEN
    RETURN false;
  END IF;

  SELECT marketplace_settings_pin_hash INTO stored_hash
  FROM public.admin_config_secrets
  WHERE id = 'default';

  IF stored_hash IS NULL OR trim(stored_hash) = '' THEN
    RETURN false;
  END IF;

  stored_hash := trim(stored_hash);

  -- crypt() lives in extensions on Supabase; search_path includes extensions.
  RETURN stored_hash = crypt(pin_clean, stored_hash);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_marketplace_settings_pin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_marketplace_settings_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_marketplace_settings_pin(text) TO service_role;

COMMENT ON FUNCTION public.verify_marketplace_settings_pin IS
  'Verify admin marketplace settings PIN. Test in SQL editor: SELECT public.verify_marketplace_settings_pin(''1234'');';
