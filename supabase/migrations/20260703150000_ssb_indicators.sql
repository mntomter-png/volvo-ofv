-- SSB-indikatorer for TMF (Total Market Forecast).
-- Data hentes fra SSB PxWebApi v2 og synkes periodisk.

alter type public.sync_type add value if not exists 'ssb';

create table public.ssb_indicators (
  id            uuid primary key default gen_random_uuid(),
  indicator_key text not null,
  label         text not null,
  period        text not null,
  value         numeric not null,
  unit          text,
  tmf_driver    text not null check (tmf_driver in ('construction', 'distribution', 'long_haul', 'macro')),
  ssb_table_id  text not null,
  synced_at     timestamptz not null default now(),
  unique (indicator_key, period)
);

create index ssb_indicators_driver_period_idx
  on public.ssb_indicators (tmf_driver, period desc);

create index ssb_indicators_key_period_idx
  on public.ssb_indicators (indicator_key, period desc);

create index ssb_indicators_synced_at_idx
  on public.ssb_indicators (synced_at desc);

alter table public.ssb_indicators enable row level security;

create or replace function public.jwt_can_read_ssb_indicators()
returns boolean
language sql
stable
as $$
  select public.jwt_app_role() in ('leder', 'super', 'admin');
$$;

create policy "Role-based read ssb_indicators"
  on public.ssb_indicators for select to authenticated
  using (public.jwt_can_read_ssb_indicators());

grant select on public.ssb_indicators to authenticated;
grant execute on function public.jwt_can_read_ssb_indicators() to authenticated;
