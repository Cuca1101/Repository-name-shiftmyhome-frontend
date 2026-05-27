-- Driver charge status management + admin audit (does not affect customer billing).

ALTER TABLE public.driver_charges
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_by text,
  ADD COLUMN IF NOT EXISTS removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS removed_by text,
  ADD COLUMN IF NOT EXISTS removed_reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_changed_by text,
  ADD COLUMN IF NOT EXISTS status_previous text,
  ADD COLUMN IF NOT EXISTS status_change_note text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.driver_charges.status IS 'pending | paid | not_paid | removed (legacy: applied→not_paid, waived/cancelled→removed)';
COMMENT ON COLUMN public.driver_charges.paid_at IS 'When admin marked charge as paid (evidence).';
COMMENT ON COLUMN public.driver_charges.removed_reason IS 'Required reason when status is removed.';

-- Map legacy statuses to new model (idempotent).
UPDATE public.driver_charges SET status = 'not_paid' WHERE status IN ('applied', 'disputed');
UPDATE public.driver_charges SET status = 'removed' WHERE status IN ('waived', 'cancelled');
