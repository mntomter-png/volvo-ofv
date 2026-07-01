-- Dimensjons-RPC-er grupperer på én akse (region, HK, drivstoff, slagvolum, chassis).
-- filterRpcBase sender alle filtre inkl. dimensjonen — legg til ignorerte parametere
-- slik PostgREST matcher uten PGRST202.

drop function if exists public.reg_summary_by_region(int, text, text, int, int, text, text, int, text, date, date, text);

create or replace function public.reg_summary_by_region(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_month int default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_disp int default null,
  p_chassis text default null,
  p_from date default null,
  p_to date default null,
  p_focus_make text default 'Volvo'
)
returns table(region smallint, count int, volvo_count int)
language sql stable security invoker
as $$
  select sales_region as region,
         count(*)::int,
         count(*) filter (where make_name = p_focus_make)::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg >= 16000
    and sales_region is not null
    and (p_from is not null or p_to is not null
         or extract(year from transaction_time) = p_year)
    and (p_from is null or transaction_time >= p_from)
    and (p_to is null or transaction_time < (p_to + 1))
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

drop function if exists public.reg_summary_by_hp(int, text, text, int, int, text, text, int, text, date, date, text);

create or replace function public.reg_summary_by_hp(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_month int default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_disp int default null,
  p_chassis text default null,
  p_from date default null,
  p_to date default null,
  p_focus_make text default 'Volvo'
)
returns table(bucket smallint, count int, volvo_count int)
language sql stable security invoker
as $$
  select hp_bucket as bucket,
         count(*)::int,
         count(*) filter (where make_name = p_focus_make)::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg >= 16000
    and hp_bucket is not null
    and (p_from is not null or p_to is not null
         or extract(year from transaction_time) = p_year)
    and (p_from is null or transaction_time >= p_from)
    and (p_to is null or transaction_time < (p_to + 1))
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

drop function if exists public.reg_summary_by_fuel(int, text, text, int, int, int, text, int, text, date, date, text);

create or replace function public.reg_summary_by_fuel(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_month int default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_disp int default null,
  p_chassis text default null,
  p_from date default null,
  p_to date default null,
  p_focus_make text default 'Volvo'
)
returns table(fuel text, count int, volvo_count int)
language sql stable security invoker
as $$
  select fuel_name as fuel,
         count(*)::int,
         count(*) filter (where make_name = p_focus_make)::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg >= 16000
    and fuel_name is not null
    and (p_from is not null or p_to is not null
         or extract(year from transaction_time) = p_year)
    and (p_from is null or transaction_time >= p_from)
    and (p_to is null or transaction_time < (p_to + 1))
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

drop function if exists public.reg_summary_by_disp(int, text, text, int, int, int, text, text, text, date, date, text);

create or replace function public.reg_summary_by_disp(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_month int default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_disp int default null,
  p_chassis text default null,
  p_from date default null,
  p_to date default null,
  p_focus_make text default 'Volvo'
)
returns table(bucket smallint, count int, volvo_count int)
language sql stable security invoker
as $$
  select disp_bucket as bucket,
         count(*)::int,
         count(*) filter (where make_name = p_focus_make)::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg >= 16000
    and disp_bucket is not null
    and (p_from is not null or p_to is not null
         or extract(year from transaction_time) = p_year)
    and (p_from is null or transaction_time >= p_from)
    and (p_to is null or transaction_time < (p_to + 1))
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

drop function if exists public.reg_summary_by_chassis(int, text, text, int, int, int, text, text, int, date, date, text);

create or replace function public.reg_summary_by_chassis(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_month int default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_disp int default null,
  p_chassis text default null,
  p_from date default null,
  p_to date default null,
  p_focus_make text default 'Volvo'
)
returns table(chassis text, count int, volvo_count int)
language sql stable security invoker
as $$
  select trekker_jevnlast as chassis,
         count(*)::int,
         count(*) filter (where make_name = p_focus_make)::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg >= 16000
    and trekker_jevnlast is not null
    and (p_from is not null or p_to is not null
         or extract(year from transaction_time) = p_year)
    and (p_from is null or transaction_time >= p_from)
    and (p_to is null or transaction_time < (p_to + 1))
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

grant execute on function public.reg_summary_by_region(int, text, text, int, int, int, text, text, int, text, date, date, text) to authenticated;
grant execute on function public.reg_summary_by_hp(int, text, text, int, int, int, text, text, int, text, date, date, text) to authenticated;
grant execute on function public.reg_summary_by_fuel(int, text, text, int, int, int, text, text, int, text, date, date, text) to authenticated;
grant execute on function public.reg_summary_by_disp(int, text, text, int, int, int, text, text, int, text, date, date, text) to authenticated;
grant execute on function public.reg_summary_by_chassis(int, text, text, int, int, int, text, text, int, text, date, date, text) to authenticated;
