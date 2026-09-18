-- Kommersielle ledende indikatorer for TMF: ordreinngang og tilbudsaktivitet.
--
-- Registrering er levering, og levering ligger typisk 2–4 kvartaler etter
-- ordre. Modellen har i dag ingen ledende variabel, og bommet derfor 44,8 % på
-- Volvo-volum i 2025 — markedet falt og andelen kollapset samtidig, uten at
-- noe i datagrunnlaget varslet det. Ordreinngang er signalet som ville gjort.
--
-- Bevisst lagres BARE et aggregert prosenttall per periode. Ingen volum, ingen
-- kunder, ingen ordrelinjer. Tallet beregnes lokalt i Volvos egne systemer og
-- føres inn manuelt, slik at ingen data eksporteres hit.

create table public.tmf_commercial_indicators (
  id            uuid primary key default gen_random_uuid(),
  -- 'order_intake' = ordreinngang, 'quote_activity' = tilbudsaktivitet.
  kind          text not null check (kind in ('order_intake', 'quote_activity')),
  -- Året tallet gjelder for. Sammen med kind er dette unikt.
  period_year   int not null check (period_year between 2000 and 2100),
  -- Hvor mange måneder av året tallet dekker, slik at YTD-tall kan tolkes.
  months_covered int not null default 12 check (months_covered between 1 and 12),
  -- Endring mot samme periode året før, i prosent. −100 til +200 er rikelig.
  yoy_pct       numeric not null check (yoy_pct between -100 and 200),
  note          text,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint tmf_commercial_indicators_kind_year_key unique (kind, period_year)
);

comment on table public.tmf_commercial_indicators is
  'Aggregerte YoY-prosenttall for ordreinngang og tilbudsaktivitet. Kun prosent - aldri volum eller kundedata.';
comment on column public.tmf_commercial_indicators.yoy_pct is
  'Endring mot samme periode aaret foer, i prosent. Beregnes lokalt og foeres inn manuelt.';

create index tmf_commercial_indicators_lookup_idx
  on public.tmf_commercial_indicators (kind, period_year desc);

create trigger tmf_commercial_indicators_set_updated_at
  before update on public.tmf_commercial_indicators
  for each row
  execute function public.set_updated_at();

alter table public.tmf_commercial_indicators enable row level security;

-- Tallene er en delt modellforutsetning, ikke personlige data: alle med
-- TMF-tilgang ser og vedlikeholder samme grunnlag. TMF er leder/super.
create policy "TMF roles can view commercial indicators"
  on public.tmf_commercial_indicators for select to authenticated
  using (public.jwt_app_role() in ('leder', 'super'));

create policy "TMF roles can insert commercial indicators"
  on public.tmf_commercial_indicators for insert to authenticated
  with check (public.jwt_app_role() in ('leder', 'super'));

create policy "TMF roles can update commercial indicators"
  on public.tmf_commercial_indicators for update to authenticated
  using (public.jwt_app_role() in ('leder', 'super'))
  with check (public.jwt_app_role() in ('leder', 'super'));

create policy "TMF roles can delete commercial indicators"
  on public.tmf_commercial_indicators for delete to authenticated
  using (public.jwt_app_role() in ('leder', 'super'));

grant select, insert, update, delete on public.tmf_commercial_indicators to authenticated;
