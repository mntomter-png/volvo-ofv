-- Slagvolum (displacement) og trekker/jevnlast-klassifisering.
-- Speiler classifyDisplacementBucket() og classifyTrekkerJevnlast() i segmentation.ts.

alter table public.registrations
  add column if not exists total_cylinder_capacity_cm3 integer;

alter table public.population
  add column if not exists total_cylinder_capacity_cm3 integer;

create or replace function public.ofv_disp_bucket(cc int, fuel_name text)
returns smallint
language sql
immutable
as $$
  select case
    when coalesce(cc, 0) <= 0 and fuel_name ilike '%elektr%' then 1
    when coalesce(cc, 0) <= 0 then null
    when cc < 8500 then 2
    when cc < 10000 then 3
    when cc < 12000 then 4
    when cc < 15000 then 5
    else 6
  end::smallint;
$$;

create or replace function public.ofv_trekker_jevnlast(
  model_name text,
  certificate_variant text
)
returns text
language sql
immutable
as $$
  select case
    when lower(coalesce(model_name, '') || ' ' || coalesce(certificate_variant, ''))
      ~ '(4x2|6x2|trekk|tractor|t 4x2|t 6x2)' then 'trekker'
    when lower(coalesce(model_name, '') || ' ' || coalesce(certificate_variant, ''))
      ~ '(6x4|8x4|8x2|rigid|distribu|anlegg|kran|tipp|fmx)' then 'jevnlast'
    else 'trekker'
  end;
$$;

alter table public.registrations drop column if exists disp_bucket;
alter table public.population drop column if exists disp_bucket;

alter table public.registrations
  add column disp_bucket smallint
  generated always as (
    public.ofv_disp_bucket(total_cylinder_capacity_cm3, fuel_name)
  ) stored;

alter table public.population
  add column disp_bucket smallint
  generated always as (
    public.ofv_disp_bucket(total_cylinder_capacity_cm3, fuel_name)
  ) stored;

alter table public.registrations drop column if exists trekker_jevnlast;
alter table public.population drop column if exists trekker_jevnlast;

alter table public.registrations
  add column trekker_jevnlast text
  generated always as (
    public.ofv_trekker_jevnlast(model_name, certificate_variant_designation)
  ) stored;

alter table public.population
  add column trekker_jevnlast text
  generated always as (
    public.ofv_trekker_jevnlast(model_name, certificate_variant_designation)
  ) stored;

create index if not exists registrations_disp_bucket_idx on public.registrations (disp_bucket);
create index if not exists population_disp_bucket_idx on public.population (disp_bucket);
create index if not exists registrations_trekker_jevnlast_idx on public.registrations (trekker_jevnlast);
create index if not exists population_trekker_jevnlast_idx on public.population (trekker_jevnlast);

-- Utvid registrerings-aggregeringer med p_disp og p_chassis.
drop function if exists public.reg_summary_by_month(int, text, text, int, int, text, text);

create or replace function public.reg_summary_by_month(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_disp int default null,
  p_chassis text default null
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
    and (p_hp is null or hp_bucket = p_hp)
    and (p_fuel is null or fuel_name = p_fuel)
    and (p_pabygg is null or pabygg_segment = p_pabygg)
    and (p_disp is null or disp_bucket = p_disp)
    and (p_chassis is null or trekker_jevnlast = p_chassis)
  group by 1 order by 1;
$$;

drop function if exists public.reg_summary_by_make(int, text, text, int, int, int, text, text);

create or replace function public.reg_summary_by_make(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_month int default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_disp int default null,
  p_chassis text default null
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
    and (p_hp is null or hp_bucket = p_hp)
    and (p_fuel is null or fuel_name = p_fuel)
    and (p_pabygg is null or pabygg_segment = p_pabygg)
    and (p_disp is null or disp_bucket = p_disp)
    and (p_chassis is null or trekker_jevnlast = p_chassis)
  group by make_name order by count(*) desc;
$$;

drop function if exists public.reg_summary_by_region(int, text, text, int, int, text, text);

create or replace function public.reg_summary_by_region(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_month int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_disp int default null,
  p_chassis text default null
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
    and (p_hp is null or hp_bucket = p_hp)
    and (p_fuel is null or fuel_name = p_fuel)
    and (p_pabygg is null or pabygg_segment = p_pabygg)
    and (p_disp is null or disp_bucket = p_disp)
    and (p_chassis is null or trekker_jevnlast = p_chassis)
  group by sales_region order by sales_region;
$$;

drop function if exists public.reg_summary_by_hp(int, text, text, int, int, text, text);

create or replace function public.reg_summary_by_hp(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_month int default null,
  p_region int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_disp int default null,
  p_chassis text default null
)
returns table(bucket smallint, count int, volvo_count int)
language sql stable security invoker
as $$
  select hp_bucket as bucket,
         count(*)::int,
         count(*) filter (where make_name = 'Volvo')::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg > 16000
    and hp_bucket is not null
    and extract(year from transaction_time) = p_year
    and (p_segment is null or usage_name = p_segment)
    and (p_make is null or make_name = p_make)
    and (p_month is null or extract(month from transaction_time) = p_month)
    and (p_region is null or sales_region = p_region)
    and (p_fuel is null or fuel_name = p_fuel)
    and (p_pabygg is null or pabygg_segment = p_pabygg)
    and (p_disp is null or disp_bucket = p_disp)
    and (p_chassis is null or trekker_jevnlast = p_chassis)
  group by hp_bucket order by hp_bucket;
$$;

drop function if exists public.reg_summary_by_fuel(int, text, text, int, int, int, text);

create or replace function public.reg_summary_by_fuel(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_month int default null,
  p_region int default null,
  p_hp int default null,
  p_pabygg text default null,
  p_disp int default null,
  p_chassis text default null
)
returns table(fuel text, count int, volvo_count int)
language sql stable security invoker
as $$
  select fuel_name as fuel,
         count(*)::int,
         count(*) filter (where make_name = 'Volvo')::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg > 16000
    and fuel_name is not null
    and extract(year from transaction_time) = p_year
    and (p_segment is null or usage_name = p_segment)
    and (p_make is null or make_name = p_make)
    and (p_month is null or extract(month from transaction_time) = p_month)
    and (p_region is null or sales_region = p_region)
    and (p_hp is null or hp_bucket = p_hp)
    and (p_pabygg is null or pabygg_segment = p_pabygg)
    and (p_disp is null or disp_bucket = p_disp)
    and (p_chassis is null or trekker_jevnlast = p_chassis)
  group by fuel_name order by count(*) desc;
$$;

drop function if exists public.reg_summary_by_pabygg(int, text, text, int, int, int, text);

create or replace function public.reg_summary_by_pabygg(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_month int default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null,
  p_disp int default null,
  p_chassis text default null
)
returns table(pabygg text, count int, volvo_count int)
language sql stable security invoker
as $$
  select pabygg_segment as pabygg,
         count(*)::int,
         count(*) filter (where make_name = 'Volvo')::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg > 16000
    and pabygg_segment is not null
    and extract(year from transaction_time) = p_year
    and (p_segment is null or usage_name = p_segment)
    and (p_make is null or make_name = p_make)
    and (p_month is null or extract(month from transaction_time) = p_month)
    and (p_region is null or sales_region = p_region)
    and (p_hp is null or hp_bucket = p_hp)
    and (p_fuel is null or fuel_name = p_fuel)
    and (p_disp is null or disp_bucket = p_disp)
    and (p_chassis is null or trekker_jevnlast = p_chassis)
  group by pabygg_segment
  order by count(*) desc;
$$;

drop function if exists public.reg_fleet_owners(int, text, int, int, text, text);

create or replace function public.reg_fleet_owners(
  p_year int,
  p_segment text default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_disp int default null,
  p_chassis text default null
)
returns table(owner_key text, owner_name text, count int, volvo_count int)
language sql stable security invoker
as $$
  select coalesce(nullif(primary_owner_orgnr, ''), primary_owner_name) as owner_key,
         max(primary_owner_name) as owner_name,
         count(*)::int,
         count(*) filter (where make_name = 'Volvo')::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg > 16000
    and coalesce(nullif(primary_owner_orgnr, ''), primary_owner_name) is not null
    and extract(year from transaction_time) = p_year
    and (p_segment is null or usage_name = p_segment)
    and (p_region is null or sales_region = p_region)
    and (p_hp is null or hp_bucket = p_hp)
    and (p_fuel is null or fuel_name = p_fuel)
    and (p_pabygg is null or pabygg_segment = p_pabygg)
    and (p_disp is null or disp_bucket = p_disp)
    and (p_chassis is null or trekker_jevnlast = p_chassis)
  group by 1
  order by count(*) desc;
$$;

create or replace function public.reg_summary_by_disp(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_month int default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_chassis text default null
)
returns table(bucket smallint, count int, volvo_count int)
language sql stable security invoker
as $$
  select disp_bucket as bucket,
         count(*)::int,
         count(*) filter (where make_name = 'Volvo')::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg > 16000
    and disp_bucket is not null
    and extract(year from transaction_time) = p_year
    and (p_segment is null or usage_name = p_segment)
    and (p_make is null or make_name = p_make)
    and (p_month is null or extract(month from transaction_time) = p_month)
    and (p_region is null or sales_region = p_region)
    and (p_hp is null or hp_bucket = p_hp)
    and (p_fuel is null or fuel_name = p_fuel)
    and (p_pabygg is null or pabygg_segment = p_pabygg)
    and (p_chassis is null or trekker_jevnlast = p_chassis)
  group by disp_bucket order by disp_bucket;
$$;

create or replace function public.reg_summary_by_chassis(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_month int default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_disp int default null
)
returns table(chassis text, count int, volvo_count int)
language sql stable security invoker
as $$
  select trekker_jevnlast as chassis,
         count(*)::int,
         count(*) filter (where make_name = 'Volvo')::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg > 16000
    and trekker_jevnlast is not null
    and extract(year from transaction_time) = p_year
    and (p_segment is null or usage_name = p_segment)
    and (p_make is null or make_name = p_make)
    and (p_month is null or extract(month from transaction_time) = p_month)
    and (p_region is null or sales_region = p_region)
    and (p_hp is null or hp_bucket = p_hp)
    and (p_fuel is null or fuel_name = p_fuel)
    and (p_pabygg is null or pabygg_segment = p_pabygg)
    and (p_disp is null or disp_bucket = p_disp)
  group by trekker_jevnlast
  order by count(*) desc;
$$;

-- Populasjon: utvid filtre og legg til region-/drivstoff-fordeling.
drop function if exists public.pop_summary_by_make(text, text);

create or replace function public.pop_summary_by_make(
  p_segment text default null,
  p_make text default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_disp int default null,
  p_chassis text default null
)
returns table(make_name text, count int)
language sql stable security invoker
as $$
  select make_name, count(*)::int
  from public.population
  where snapshot_date = (select max(snapshot_date) from public.population)
    and make_name is not null
    and maximum_laden_mass_kg > 16000
    and (p_segment is null or usage_name = p_segment)
    and (p_make is null or make_name = p_make)
    and (p_region is null or sales_region = p_region)
    and (p_hp is null or hp_bucket = p_hp)
    and (p_fuel is null or fuel_name = p_fuel)
    and (p_pabygg is null or pabygg_segment = p_pabygg)
    and (p_disp is null or disp_bucket = p_disp)
    and (p_chassis is null or trekker_jevnlast = p_chassis)
  group by make_name order by count(*) desc;
$$;

drop function if exists public.pop_summary_by_segment(text, text);

create or replace function public.pop_summary_by_segment(
  p_segment text default null,
  p_make text default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_disp int default null,
  p_chassis text default null
)
returns table(segment text, count int, volvo_count int)
language sql stable security invoker
as $$
  select
    coalesce(usage_name, 'Ukjent') as segment,
    count(*)::int as count,
    count(*) filter (where make_name = 'Volvo')::int as volvo_count
  from public.population
  where snapshot_date = (select max(snapshot_date) from public.population)
    and maximum_laden_mass_kg > 16000
    and (p_segment is null or usage_name = p_segment)
    and (p_make is null or make_name = p_make)
    and (p_region is null or sales_region = p_region)
    and (p_hp is null or hp_bucket = p_hp)
    and (p_fuel is null or fuel_name = p_fuel)
    and (p_pabygg is null or pabygg_segment = p_pabygg)
    and (p_disp is null or disp_bucket = p_disp)
    and (p_chassis is null or trekker_jevnlast = p_chassis)
  group by coalesce(usage_name, 'Ukjent')
  order by count(*) desc;
$$;

create or replace function public.pop_summary_by_region(
  p_segment text default null,
  p_make text default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_disp int default null,
  p_chassis text default null
)
returns table(region smallint, count int, volvo_count int)
language sql stable security invoker
as $$
  select sales_region as region,
         count(*)::int,
         count(*) filter (where make_name = 'Volvo')::int
  from public.population
  where snapshot_date = (select max(snapshot_date) from public.population)
    and maximum_laden_mass_kg > 16000
    and sales_region is not null
    and (p_segment is null or usage_name = p_segment)
    and (p_make is null or make_name = p_make)
    and (p_hp is null or hp_bucket = p_hp)
    and (p_fuel is null or fuel_name = p_fuel)
    and (p_pabygg is null or pabygg_segment = p_pabygg)
    and (p_disp is null or disp_bucket = p_disp)
    and (p_chassis is null or trekker_jevnlast = p_chassis)
  group by sales_region order by sales_region;
$$;

create or replace function public.pop_summary_by_fuel(
  p_segment text default null,
  p_make text default null,
  p_region int default null,
  p_hp int default null,
  p_pabygg text default null,
  p_disp int default null,
  p_chassis text default null
)
returns table(fuel text, count int, volvo_count int)
language sql stable security invoker
as $$
  select fuel_name as fuel,
         count(*)::int,
         count(*) filter (where make_name = 'Volvo')::int
  from public.population
  where snapshot_date = (select max(snapshot_date) from public.population)
    and maximum_laden_mass_kg > 16000
    and fuel_name is not null
    and (p_segment is null or usage_name = p_segment)
    and (p_make is null or make_name = p_make)
    and (p_region is null or sales_region = p_region)
    and (p_hp is null or hp_bucket = p_hp)
    and (p_pabygg is null or pabygg_segment = p_pabygg)
    and (p_disp is null or disp_bucket = p_disp)
    and (p_chassis is null or trekker_jevnlast = p_chassis)
  group by fuel_name order by count(*) desc;
$$;

-- Dashboard: utvid med region og påbygg.
drop function if exists public.dash_registrations_by_month(text);

create or replace function public.dash_registrations_by_month(
  p_segment text default null,
  p_region int default null,
  p_pabygg text default null
)
returns table(month date, count int)
language sql stable security invoker
as $$
  select date_trunc('month', transaction_time)::date as month, count(*)::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg > 16000
    and extract(year from transaction_time) = extract(year from current_date)
    and (p_segment is null or usage_name = p_segment)
    and (p_region is null or sales_region = p_region)
    and (p_pabygg is null or pabygg_segment = p_pabygg)
  group by 1 order by 1;
$$;

drop function if exists public.dash_registrations_by_make(text);

create or replace function public.dash_registrations_by_make(
  p_segment text default null,
  p_region int default null,
  p_pabygg text default null
)
returns table(make_name text, count int)
language sql stable security invoker
as $$
  select make_name, count(*)::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg > 16000
    and extract(year from transaction_time) = extract(year from current_date)
    and make_name is not null
    and (p_segment is null or usage_name = p_segment)
    and (p_region is null or sales_region = p_region)
    and (p_pabygg is null or pabygg_segment = p_pabygg)
  group by make_name order by count(*) desc;
$$;

drop function if exists public.dash_population_by_make(text);

create or replace function public.dash_population_by_make(
  p_segment text default null,
  p_region int default null,
  p_pabygg text default null
)
returns table(make_name text, count int)
language sql stable security invoker
as $$
  select make_name, count(*)::int
  from public.population
  where snapshot_date = (select max(snapshot_date) from public.population)
    and make_name is not null
    and maximum_laden_mass_kg > 16000
    and (p_segment is null or usage_name = p_segment)
    and (p_region is null or sales_region = p_region)
    and (p_pabygg is null or pabygg_segment = p_pabygg)
  group by make_name order by count(*) desc;
$$;

grant execute on function public.ofv_disp_bucket(int, text) to authenticated;
grant execute on function public.ofv_trekker_jevnlast(text, text) to authenticated;
grant execute on function public.reg_summary_by_month(int, text, text, int, int, text, text, int, text) to authenticated;
grant execute on function public.reg_summary_by_make(int, text, text, int, int, int, text, text, int, text) to authenticated;
grant execute on function public.reg_summary_by_region(int, text, text, int, int, text, text, int, text) to authenticated;
grant execute on function public.reg_summary_by_hp(int, text, text, int, int, text, text, int, text) to authenticated;
grant execute on function public.reg_summary_by_fuel(int, text, text, int, int, int, text, int, text) to authenticated;
grant execute on function public.reg_summary_by_pabygg(int, text, text, int, int, int, text, int, text) to authenticated;
grant execute on function public.reg_fleet_owners(int, text, int, int, text, text, int, text) to authenticated;
grant execute on function public.reg_summary_by_disp(int, text, text, int, int, int, text, text, text) to authenticated;
grant execute on function public.reg_summary_by_chassis(int, text, text, int, int, int, text, text, int) to authenticated;
grant execute on function public.pop_summary_by_make(text, text, int, int, text, text, int, text) to authenticated;
grant execute on function public.pop_summary_by_segment(text, text, int, int, text, text, int, text) to authenticated;
grant execute on function public.pop_summary_by_region(text, text, int, text, text, int, text) to authenticated;
grant execute on function public.pop_summary_by_fuel(text, text, int, int, text, int, text) to authenticated;
grant execute on function public.dash_registrations_by_month(text, int, text) to authenticated;
grant execute on function public.dash_registrations_by_make(text, int, text) to authenticated;
grant execute on function public.dash_population_by_make(text, int, text) to authenticated;
