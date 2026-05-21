-- Required for go-live archive flags (cleanup RPC + admin filters).

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS quotes_is_test_idx
  ON public.quotes (is_test)
  WHERE is_test = true;
