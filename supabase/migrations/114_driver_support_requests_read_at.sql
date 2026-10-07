-- Separate read/unread from workflow status (new / in_progress / resolved).
-- Unread = read_at IS NULL. Marking read does not change workflow status.

ALTER TABLE public.driver_support_requests
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_by text;

COMMENT ON COLUMN public.driver_support_requests.read_at IS
  'When an admin opened/viewed this message. NULL = unread. Independent of status.';
COMMENT ON COLUMN public.driver_support_requests.read_by IS
  'Admin identifier (email/id) who marked the message read, if available.';

CREATE INDEX IF NOT EXISTS driver_support_requests_unread_idx
  ON public.driver_support_requests (created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS driver_support_requests_driver_unread_idx
  ON public.driver_support_requests (driver_id, created_at DESC)
  WHERE read_at IS NULL;
