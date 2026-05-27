-- Optional vehicle registration on fleet driver profile (admin Add Driver flow).

alter table public.drivers add column if not exists vehicle_registration text;

comment on column public.drivers.vehicle_registration is 'Vehicle registration plate (optional).';
