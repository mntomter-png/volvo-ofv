-- Drivstoff-filter (fuel_name) for nyregistreringer: Diesel, Elektrisitet, Gass.
-- fuel_name finnes allerede som kolonne, så ingen ny kolonne trengs – kun
-- p_fuel-parameter i aggregeringene og en ny reg_summary_by_fuel.

drop function if exists public.reg_summary_by_month(int, text, text, int, int);

create or replace function public.reg_summary_by_month(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null
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
  group by 1 order by 1;
$$;

drop function if exists public.reg_summary_by_make(int, text, text, int, int, int);

create or replace function public.reg_summary_by_make(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_month int default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null
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
  group by make_name order by count(*) desc;
$$;

drop function if exists public.reg_summary_by_region(int, text, text, int, int);

create or replace function public.reg_summary_by_region(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_month int default null,
  p_hp int default null,
  p_fuel text default null
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
  group by sales_region order by sales_region;
$$;

drop function if exists public.reg_summary_by_hp(int, text, text, int, int);

create or replace function public.reg_summary_by_hp(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_month int default null,
  p_region int default null,
  p_fuel text default null
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
  group by hp_bucket order by hp_bucket;
$$;

-- Drivstoff-fordeling: ignorerer drivstoff, men respekterer øvrige filtre.
create or replace function public.reg_summary_by_fuel(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_month int default null,
  p_region int default null,
  p_hp int default null
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
  group by fuel_name order by count(*) desc;
$$;

grant execute on function public.reg_summary_by_month(int, text, text, int, int, text) to authenticated;
grant execute on function public.reg_summary_by_make(int, text, text, int, int, int, text) to authenticated;
grant execute on function public.reg_summary_by_region(int, text, text, int, int, text) to authenticated;
grant execute on function public.reg_summary_by_hp(int, text, text, int, int, text) to authenticated;
grant execute on function public.reg_summary_by_fuel(int, text, text, int, int, int) to authenticated;
