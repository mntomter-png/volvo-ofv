-- HK-bøtte (hestekrefter) utledet fra effektiv HK (engine_power_hp, eller
-- engine_power_kw * 1.341 som fallback). Speiler classifyHpBucketKey() og
-- effectiveHorsepower() i src/lib/ofv/segmentation.ts.
-- Ordinaler: 1=<500, 2=500-539, 3=540-599, 4=600-699, 5=>=700, null=ukjent.

create or replace function public.ofv_hp_bucket(hp int, kw int)
returns smallint
language sql
immutable
as $$
  select case
    when eff is null or eff <= 0 then null
    when eff >= 700 then 5
    when eff >= 600 then 4
    when eff >= 540 then 3
    when eff >= 500 then 2
    else 1
  end::smallint
  from (
    select case
      when coalesce(hp, 0) > 0 then hp
      when coalesce(kw, 0) > 0 then round(kw * 1.341)::int
      else null
    end as eff
  ) t;
$$;

alter table public.registrations
  add column if not exists hp_bucket smallint
  generated always as (public.ofv_hp_bucket(engine_power_hp, engine_power_kw)) stored;

alter table public.population
  add column if not exists hp_bucket smallint
  generated always as (public.ofv_hp_bucket(engine_power_hp, engine_power_kw)) stored;

create index if not exists registrations_hp_bucket_idx
  on public.registrations (hp_bucket);
create index if not exists population_hp_bucket_idx
  on public.population (hp_bucket);

-- Utvid eksisterende aggregeringer med HK-filter (p_hp).
drop function if exists public.reg_summary_by_month(int, text, text, int);

create or replace function public.reg_summary_by_month(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_region int default null,
  p_hp int default null
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
  group by 1 order by 1;
$$;

drop function if exists public.reg_summary_by_make(int, text, text, int, int);

create or replace function public.reg_summary_by_make(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_month int default null,
  p_region int default null,
  p_hp int default null
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
  group by make_name order by count(*) desc;
$$;

-- Regionfordeling: ignorerer region, men respekterer HK.
drop function if exists public.reg_summary_by_region(int, text, text, int);

create or replace function public.reg_summary_by_region(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_month int default null,
  p_hp int default null
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
  group by sales_region order by sales_region;
$$;

-- HK-fordeling: ignorerer HK, men respekterer region/segment/merke/måned.
create or replace function public.reg_summary_by_hp(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_month int default null,
  p_region int default null
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
  group by hp_bucket order by hp_bucket;
$$;

grant execute on function public.ofv_hp_bucket(int, int) to authenticated;
grant execute on function public.reg_summary_by_month(int, text, text, int, int) to authenticated;
grant execute on function public.reg_summary_by_make(int, text, text, int, int, int) to authenticated;
grant execute on function public.reg_summary_by_region(int, text, text, int, int) to authenticated;
grant execute on function public.reg_summary_by_hp(int, text, text, int, int) to authenticated;
