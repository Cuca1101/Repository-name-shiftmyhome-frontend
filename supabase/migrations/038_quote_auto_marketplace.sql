-- Auto-marketplace scheduling fields (admin automation only).

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS auto_marketplace_hold boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_marketplace_eligible_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_marketplace_sent_at timestamptz;

COMMENT ON COLUMN public.quotes.auto_marketplace_hold IS 'When true, system auto-send to marketplace will skip this job.';
COMMENT ON COLUMN public.quotes.auto_marketplace_eligible_at IS 'When the job first became eligible for auto-marketplace delay countdown.';
COMMENT ON COLUMN public.quotes.auto_marketplace_sent_at IS 'When the job was auto-sent to marketplace by admin automation.';

CREATE INDEX IF NOT EXISTS quotes_auto_marketplace_eligible_idx
  ON public.quotes (auto_marketplace_eligible_at)
  WHERE auto_marketplace_eligible_at IS NOT NULL AND auto_marketplace_sent_at IS NULL;
