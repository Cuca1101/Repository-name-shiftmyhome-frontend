-- Server-side verification for protected marketplace admin settings (PIN never stored in plain text).
-- Set PIN hash after deploy, e.g.:
--   UPDATE public.admin_config_secrets
--   SET marketplace_settings_pin_hash = crypt('YOUR_PIN', gen_salt('bf')),
--       updated_at = now()
--   WHERE id = 'default';

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.admin_config_secrets (
  id text PRIMARY KEY DEFAULT 'default',
  marketplace_settings_pin_hash text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_config_secrets_singleton CHECK (id = 'default')
);

INSERT INTO public.admin_config_secrets (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.admin_config_secrets ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.admin_config_secrets IS 'Admin secrets (PIN hashes). No client read policies; verify via RPC only.';

CREATE OR REPLACE FUNCTION public.verify_marketplace_settings_pin(pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_hash text;
BEGIN
  IF pin IS NULL OR length(trim(pin)) = 0 THEN
    RETURN false;
  END IF;

  SELECT marketplace_settings_pin_hash INTO stored_hash
  FROM public.admin_config_secrets
  WHERE id = 'default';

  IF stored_hash IS NULL OR stored_hash = '' THEN
    RETURN false;
  END IF;

  RETURN stored_hash = crypt(trim(pin), stored_hash);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_marketplace_settings_pin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_marketplace_settings_pin(text) TO authenticated;
