-- Driver status sync: optional link to job_assignments row.

ALTER TABLE public.job_status_history
  ADD COLUMN IF NOT EXISTS job_assignment_id uuid REFERENCES public.job_assignments (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS job_status_history_assignment_id_idx
  ON public.job_status_history (job_assignment_id)
  WHERE job_assignment_id IS NOT NULL;

COMMENT ON COLUMN public.job_status_history.job_assignment_id IS
  'Optional job_assignments.id when mobile sync includes assignment context.';
