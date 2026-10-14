-- Phone booking quotes: customer pay link + send tracking.
-- quote_pay_token is the secret in /quote/view/:token. Only Edge Functions (service role) read it for customers.

alter table public.quotes
  add column if not exists quote_pay_token text,
  add column if not exists quote_sent_at timestamptz,
  add column if not exists quote_sent_count integer not null default 0,
  add column if not exists quote_sent_total numeric;

create unique index if not exists quotes_quote_pay_token_key
  on public.quotes (quote_pay_token)
  where quote_pay_token is not null;

comment on column public.quotes.quote_pay_token is 'Secret token for the customer quote page /quote/view/:token (phone quotes).';
comment on column public.quotes.quote_sent_at is 'Last time the phone quote email was sent to the customer.';
comment on column public.quotes.quote_sent_count is 'How many times the phone quote email was sent.';
comment on column public.quotes.quote_sent_total is 'Final price shown in the last quote email sent.';
