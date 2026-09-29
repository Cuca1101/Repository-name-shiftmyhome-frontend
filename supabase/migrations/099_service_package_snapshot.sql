-- Package chosen at payment time. Later Price Engine edits must not rewrite this snapshot.
alter table public.quotes
  add column if not exists service_package_snapshot jsonb;

comment on column public.quotes.service_package_snapshot is
  'Service package id, fee, allowances and settings captured when the quote was paid or converted. Admin package edits do not change this row.';
