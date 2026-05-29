-- Store pricing engine breakdown on driver extra-item requests.

ALTER TABLE public.extra_charge_requests
  ADD COLUMN IF NOT EXISTS pricing_breakdown jsonb;

COMMENT ON COLUMN public.extra_charge_requests.pricing_breakdown IS
  'Pricing engine snapshot: breakdown_lines, item_lines, volume band (from Items Library + pricePerCubicMetre).';
