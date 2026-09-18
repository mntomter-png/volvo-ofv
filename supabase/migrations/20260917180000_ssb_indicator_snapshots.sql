-- Punkt-i-tid-øyeblikksbilder av SSB-indikatorer.
--
-- `ssb_indicators` holder alltid siste reviderte verdi. Backtest av SSB-bidraget
-- blir derfor kunstig god, fordi prognosen «vet» hva SSB senere reviderte tallet
-- til. Denne tabellen tar vare på hva vi faktisk visste hver måned, slik at vi
-- kan kjøre en ærlig punkt-i-tid-backtest når vi har nok historikk.

create table public.ssb_indicator_snapshots (
  id             uuid primary key default gen_random_uuid(),
  -- Måneden øyeblikksbildet gjelder for (alltid den 1.).
  snapshot_month date not null,
  indicator_key  text not null,
  period         text not null,
  value          numeric not null,
  tmf_driver     text not null check (tmf_driver in ('construction', 'distribution', 'long_haul', 'macro')),
  captured_at    timestamptz not null default now(),
  unique (snapshot_month, indicator_key, period),
  constraint ssb_indicator_snapshots_month_is_first
    check (date_trunc('month', snapshot_month) = snapshot_month)
);

create index ssb_indicator_snapshots_month_idx
  on public.ssb_indicator_snapshots (snapshot_month desc);

create index ssb_indicator_snapshots_lookup_idx
  on public.ssb_indicator_snapshots (snapshot_month desc, indicator_key, period);

alter table public.ssb_indicator_snapshots enable row level security;

create policy "Role-based read ssb_indicator_snapshots"
  on public.ssb_indicator_snapshots for select to authenticated
  using (public.jwt_can_read_ssb_indicators());

grant select on public.ssb_indicator_snapshots to authenticated;
