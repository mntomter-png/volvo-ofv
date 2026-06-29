-- Forbedre påbygg-segment: OFV returnerer ikke bodywork for lastebiler (type
-- 13000), men vi har model_name og certificateVariantDesignation. Utvid
-- ofv_pabygg_segment og legg til certificate_variant_designation.

alter table public.registrations
  add column if not exists certificate_variant_designation text;

alter table public.population
  add column if not exists certificate_variant_designation text;

alter table public.registrations drop column if exists pabygg_segment;
alter table public.population drop column if exists pabygg_segment;

create or replace function public.ofv_pabygg_segment(
  bodywork_code int,
  usage_name text,
  model_name text default null,
  certificate_variant text default null
)
returns text
language sql
immutable
as $$
  select coalesce(
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
    case
      when usage_name ilike '%trekk%' then 'Long Haul'
      when usage_name ilike '%tankbil%' then 'Long Haul'
      when usage_name ilike '%lukket godsrom%' then 'Distribution'
      when usage_name ilike '%plan%' or usage_name ilike '%kasse%' then 'Distribution'
      else null
    end,
    case
      when lower(coalesce(model_name, '') || ' ' || coalesce(certificate_variant, ''))
        ~ '(fmx|anlegg|tipp|kran|betong|construction)' then 'Construction'
      when lower(coalesce(model_name, '') || ' ' || coalesce(certificate_variant, ''))
        ~ '(^fh| fh|trekk|long haul|interregional|tractor)' then 'Long Haul'
      when lower(coalesce(model_name, '') || ' ' || coalesce(certificate_variant, ''))
        ~ '(^fe | fe| fl| fm|distribu|skap|gardin|city|regional)' then 'Distribution'
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
      certificate_variant_designation
    )
  ) stored;

alter table public.population
  add column pabygg_segment text
  generated always as (
    public.ofv_pabygg_segment(
      bodywork_code,
      usage_name,
      model_name,
      certificate_variant_designation
    )
  ) stored;

create index if not exists registrations_pabygg_segment_idx
  on public.registrations (pabygg_segment);
create index if not exists population_pabygg_segment_idx
  on public.population (pabygg_segment);

grant execute on function public.ofv_pabygg_segment(int, text, text, text) to authenticated;
