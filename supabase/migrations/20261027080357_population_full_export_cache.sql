-- Forhåndsbygd bestand-.xlsx.
--
-- Filen for siste snapshot ligger i privat bucket population-exports som
-- full/<snapshot_date>.xlsx, med peker full/latest.json. Ingen policy gir
-- authenticated eller anon SELECT/INSERT på bucketen: nedlasting skjer via
-- signert URL som service_role lager etter sidetilgang-sjekk.
--
-- population_full_exports er låsen og statusen for den delte filen. Bare
-- service_role. Ikke kjørt mot prod av agenten.

drop policy if exists "Users read own population export files" on storage.objects;

create table public.population_full_exports (
  snapshot_date date primary key,
  status text not null default 'building'
    check (status in ('building', 'ready', 'failed')),
  storage_path text,
  row_count integer,
  rows_fetched integer not null default 0 check (rows_fetched >= 0),
  truncated boolean not null default false,
  error_message text,
  updated_at timestamptz not null default now()
);

comment on table public.population_full_exports is
  'Status for forhåndsbygd bestand-.xlsx. Filen ligger i population-exports/full/.';

alter table public.population_full_exports enable row level security;

revoke all on table public.population_full_exports from public, anon, authenticated;
grant select, insert, update, delete on table public.population_full_exports to service_role;
