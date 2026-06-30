-- Påbygg-segment fra ekte OFV-påbyggdata.
--
-- OFV leverer påbygg via `additionalBodyworks` (fanges nå i transform.ts som
-- bodywork_code/bodywork_name). Vi bruker dette som autoritativ kilde og følger
-- Volvos offisielle påbygghierarki (_dPåbyggshierarki):
--   Construction = krokløft (9), tipp (10), betongblander (15), betongpumpe (16)
--   Distribution = skap (3,4,5) og gardin (6) = lukket godsrom
--   Long Haul    = svingskive/dolly (79) og trekkbil (uten eget påbygg)
--   Annet        = tank, kran, tømmer, renovasjon, plan, kapell m.fl.
--
-- Modellnavn-gjettingen er fjernet; segmentet utledes nå fra faktisk påbygg
-- eller OFVs bruksområde.

alter table public.registrations drop column if exists pabygg_segment;
alter table public.population drop column if exists pabygg_segment;

create or replace function public.ofv_pabygg_segment(
  bodywork_code int,
  usage_name text,
  model_name text default null,
  certificate_variant text default null,
  number_of_axles int default null
)
returns text
language sql
immutable
as $$
  select case
    -- 1) Faktisk påbygg-kode (additionalBodyworks) er autoritativt.
    when bodywork_code is not null then case bodywork_code
      when 3 then 'Distribution'   -- Skap
      when 4 then 'Distribution'   -- Isolert skap med kjøleaggregat
      when 5 then 'Distribution'   -- Isolert skap uten kjøleaggregat
      when 6 then 'Distribution'   -- Gardin
      when 9 then 'Construction'   -- Krokløft
      when 10 then 'Construction'  -- Tipp
      when 15 then 'Construction'  -- Betongblander
      when 16 then 'Construction'  -- Pumpebil for betong
      when 79 then 'Long Haul'     -- Med svingskive (dolly)
      else 'Annet'                 -- Tank, kran, tømmer, plan, kapell, m.fl.
    end
    -- 2) Uten eget påbygg: trekkbil = trekkvogn/svingskive => Long Haul.
    when usage_name ilike '%trekk%' then 'Long Haul'
    -- 3) Lukket godsrom uten egen påbygg-kode => Distribution.
    when usage_name ilike '%lukket godsrom%' then 'Distribution'
    else 'Annet'
  end;
$$;

alter table public.registrations
  add column pabygg_segment text
  generated always as (
    public.ofv_pabygg_segment(
      bodywork_code,
      usage_name,
      model_name,
      certificate_variant_designation,
      number_of_axles
    )
  ) stored;

alter table public.population
  add column pabygg_segment text
  generated always as (
    public.ofv_pabygg_segment(
      bodywork_code,
      usage_name,
      model_name,
      certificate_variant_designation,
      number_of_axles
    )
  ) stored;

create index if not exists registrations_pabygg_segment_idx
  on public.registrations (pabygg_segment);
create index if not exists population_pabygg_segment_idx
  on public.population (pabygg_segment);

grant execute on function
  public.ofv_pabygg_segment(int, text, text, text, int) to authenticated;
