-- Forbedre trekker/jevnlast- og påbygg-segmentering.
--
-- Bakgrunn: OFV Statistikk-API-et returnerer ikke bodywork_code eller
-- akselkonfigurasjon (4x2/6x4 osv.) for tunge lastebiler. Tidligere logikk
-- defaultet derfor nær alt til 'trekker' og undertelte 'Construction'.
--
-- Nytt: usage_name (OFVs bruksområde) er det mest pålitelige signalet vi har:
--   'Trekkbil' => trekker, alle andre lastebil-/tankbil-typer => jevnlast.
-- number_of_axles og modellnavn brukes kun som fallback når usage mangler.

-- ── Trekker / jevnlast ───────────────────────────────────────────────────────
-- Slipp genererte kolonner før vi endrer funksjonssignaturen.
alter table public.registrations drop column if exists trekker_jevnlast;
alter table public.population drop column if exists trekker_jevnlast;

drop function if exists public.ofv_trekker_jevnlast(text, text);

create or replace function public.ofv_trekker_jevnlast(
  usage_name text,
  model_name text,
  certificate_variant text,
  number_of_axles int
)
returns text
language sql
immutable
as $$
  select case
    -- OFVs bruksområde er autoritativt: trekkbil = trekkvogn.
    when usage_name ilike '%trekk%' then 'trekker'
    -- Alle øvrige bruksområder (lastebil med plan/skap/tank/berging osv.)
    -- er oppbygde kjøretøy med last på selve bilen = jevnlast.
    when coalesce(usage_name, '') <> '' then 'jevnlast'
    -- Fallback når usage mangler: modell/akselhint.
    when lower(coalesce(model_name, '') || ' ' || coalesce(certificate_variant, ''))
      ~ '(4x2|6x2|trekk|tractor)' then 'trekker'
    when lower(coalesce(model_name, '') || ' ' || coalesce(certificate_variant, ''))
      ~ '(fmx|arocs|kerax|6x4|8x4|8x6|rigid|anlegg|kran|tipp)' then 'jevnlast'
    when coalesce(number_of_axles, 0) >= 4 then 'jevnlast'
    else 'trekker'
  end;
$$;

alter table public.registrations
  add column trekker_jevnlast text
  generated always as (
    public.ofv_trekker_jevnlast(
      usage_name,
      model_name,
      certificate_variant_designation,
      number_of_axles
    )
  ) stored;

alter table public.population
  add column trekker_jevnlast text
  generated always as (
    public.ofv_trekker_jevnlast(
      usage_name,
      model_name,
      certificate_variant_designation,
      number_of_axles
    )
  ) stored;

create index if not exists registrations_trekker_jevnlast_idx
  on public.registrations (trekker_jevnlast);
create index if not exists population_trekker_jevnlast_idx
  on public.population (trekker_jevnlast);

-- ── Påbygg-segment ───────────────────────────────────────────────────────────
alter table public.registrations drop column if exists pabygg_segment;
alter table public.population drop column if exists pabygg_segment;

drop function if exists public.ofv_pabygg_segment(int, text, text, text);

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
  select coalesce(
    -- 1) OFV påbygg-kode (foreløpig alltid null for lastebiler, men beholdt
    --    slik at klassifiseringen blir riktig hvis OFV begynner å levere den).
    case bodywork_code
      when -1 then 'Long Haul'
      when 1 then 'Distribution'
      when 3 then 'Distribution'
      when 4 then 'Distribution'
      when 5 then 'Distribution'
      when 6 then 'Distribution'
      when 8 then 'Distribution'
      when 9 then 'Construction'
      when 10 then 'Construction'
      when 11 then 'Long Haul'
      when 12 then 'Long Haul'
      when 15 then 'Construction'
      when 16 then 'Construction'
      when 21 then 'Construction'
      when 26 then 'Construction'
      when 28 then 'Construction'
      when 30 then 'Distribution'
      when 32 then 'Distribution'
      when 79 then 'Long Haul'
      else null
    end,
    -- 2) OFVs bruksområde.
    case
      when usage_name ilike '%trekk%' then 'Long Haul'
      when usage_name ilike '%tankbil%' then 'Long Haul'
      when usage_name ilike '%lukket godsrom%' then 'Distribution'
      when usage_name ilike '%plan%'
        or usage_name ilike '%kasse%'
        or usage_name ilike '%rom for gods%' then 'Distribution'
      when usage_name ilike '%berging%' then 'Annet'
      else null
    end,
    -- 3) Modell-/sertifikathint (utvidet med flere merkers anleggsmodeller).
    case
      when lower(coalesce(model_name, '') || ' ' || coalesce(certificate_variant, ''))
        ~ '(fmx|arocs|kerax|ginaf|construction|anlegg|tipp|krok|betong|kran|bore|dumper)'
        then 'Construction'
      when lower(coalesce(model_name, '') || ' ' || coalesce(certificate_variant, ''))
        ~ '(^fh| fh|trekk|long haul|interregional|tractor)'
        then 'Long Haul'
      when lower(coalesce(model_name, '') || ' ' || coalesce(certificate_variant, ''))
        ~ '(^fe | fe| fl| fm|distribu|skap|gardin|city|regional|kjøl|thermo)'
        then 'Distribution'
      else null
    end,
    'Annet'
  );
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
  public.ofv_trekker_jevnlast(text, text, text, int) to authenticated;
grant execute on function
  public.ofv_pabygg_segment(int, text, text, text, int) to authenticated;
