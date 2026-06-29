-- Salgsregion (Volvo-forhandlernett, Region 1-5) utledet fra postnummer.
-- Speiler getRegionFromPostalCode() i src/lib/ofv/segmentation.ts: først
-- distrikt-baserte postnummerintervaller, deretter et numerisk fallback.

create or replace function public.ofv_region_from_postal(postal text)
returns smallint
language sql
immutable
as $$
  select case
    when postal is null
      or regexp_replace(postal, '\D', '', 'g') = '' then null
    else (
      select case
        -- Region 1
        when code between 0 and 1295 then 1
        when code between 1300 and 1399 then 1
        when code between 1400 and 1460 then 1
        when code between 1461 and 1488 then 1
        when code between 1489 and 1539 then 1
        when code between 1540 and 1556 then 1
        when code between 1900 and 1971 then 1
        when code between 2000 and 2099 then 1
        when code between 2150 and 2170 then 1
        when code between 2600 and 2609 then 1
        when code = 2611 then 1
        when code between 2613 and 2615 then 1
        when code between 2617 and 2699 then 1
        when code between 2711 and 2770 then 1
        when code between 2800 and 2899 then 1
        when code between 2900 and 2985 then 1
        when code between 3000 and 3069 then 1
        when code = 3075 then 1
        when code between 3400 and 3499 then 1
        when code between 3500 and 3543 then 1
        when code between 3545 and 3599 then 1
        -- Region 2
        when code between 1557 and 1599 then 2
        when code between 1600 and 1899 then 2
        when code between 1972 and 1999 then 2
        when code between 2100 and 2134 then 2
        when code between 2200 and 2499 then 2
        when code between 2500 and 2599 then 2
        when code = 2610 then 2
        when code = 2612 then 2
        when code = 2616 then 2
        when code between 2700 and 2710 then 2
        when code between 2771 and 2799 then 2
        when code between 2986 and 2999 then 2
        when code between 3070 and 3074 then 2
        when code between 3076 and 3099 then 2
        when code between 3100 and 3299 then 2
        when code between 3300 and 3399 then 2
        when code = 3544 then 2
        when code between 3600 and 3699 then 2
        when code between 3700 and 3999 then 2
        -- Region 3
        when code between 4000 and 5999 then 3
        when code between 6700 and 6999 then 3
        -- Region 4
        when code between 6000 and 6699 then 4
        when code between 7000 and 7999 then 4
        when code between 8600 and 8899 then 4
        -- Region 5
        when code between 8000 and 8599 then 5
        when code between 8900 and 9999 then 5
        else null
      end
      from (select regexp_replace(postal, '\D', '', 'g')::int as code) t
    )
  end::smallint;
$$;

-- Generert, lagret kolonne på begge tabellene (auto-utfylles for eksisterende
-- og nye rader). Bruker brukerens (operatørens) postnummer.
alter table public.registrations
  add column if not exists sales_region smallint
  generated always as (public.ofv_region_from_postal(primary_user_postal_code)) stored;

alter table public.population
  add column if not exists sales_region smallint
  generated always as (public.ofv_region_from_postal(primary_user_postal_code)) stored;

create index if not exists registrations_sales_region_idx
  on public.registrations (sales_region);
create index if not exists population_sales_region_idx
  on public.population (sales_region);

-- Aggregeringer med region-filter (p_region) for nyregistreringer.
drop function if exists public.reg_summary_by_month(int, text, text);

create or replace function public.reg_summary_by_month(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_region int default null
)
returns table(month date, count int)
language sql stable security invoker
as $$
  select date_trunc('month', transaction_time)::date as month, count(*)::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg > 16000
    and extract(year from transaction_time) = p_year
    and (p_segment is null or usage_name = p_segment)
    and (p_make is null or make_name = p_make)
    and (p_region is null or sales_region = p_region)
  group by 1 order by 1;
$$;

drop function if exists public.reg_summary_by_make(int, text, text);
drop function if exists public.reg_summary_by_make(int, text, text, int);

create or replace function public.reg_summary_by_make(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_month int default null,
  p_region int default null
)
returns table(make_name text, count int)
language sql stable security invoker
as $$
  select make_name, count(*)::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg > 16000
    and make_name is not null
    and extract(year from transaction_time) = p_year
    and (p_segment is null or usage_name = p_segment)
    and (p_make is null or make_name = p_make)
    and (p_month is null or extract(month from transaction_time) = p_month)
    and (p_region is null or sales_region = p_region)
  group by make_name order by count(*) desc;
$$;

-- Regionfordeling (alltid alle regioner, uavhengig av valgt region).
create or replace function public.reg_summary_by_region(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_month int default null
)
returns table(region smallint, count int, volvo_count int)
language sql stable security invoker
as $$
  select sales_region as region,
         count(*)::int,
         count(*) filter (where make_name = 'Volvo')::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg > 16000
    and sales_region is not null
    and extract(year from transaction_time) = p_year
    and (p_segment is null or usage_name = p_segment)
    and (p_make is null or make_name = p_make)
    and (p_month is null or extract(month from transaction_time) = p_month)
  group by sales_region order by sales_region;
$$;

grant execute on function public.ofv_region_from_postal(text) to authenticated;
grant execute on function public.reg_summary_by_month(int, text, text, int) to authenticated;
grant execute on function public.reg_summary_by_make(int, text, text, int, int) to authenticated;
grant execute on function public.reg_summary_by_region(int, text, text, int) to authenticated;
