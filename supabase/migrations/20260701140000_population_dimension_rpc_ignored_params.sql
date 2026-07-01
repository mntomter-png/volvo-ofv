-- Populasjons-dimensjons-RPC-er grupperer på én akse (merke, region, drivstoff).
-- popRpcArgs sender alle filtre inkl. dimensjonen — legg til ignorerte parametere
-- slik PostgREST matcher uten PGRST202.

drop function if exists public.pop_summary_by_make(text, text, int, int, text, text, int, text, text);

create or replace function public.pop_summary_by_make(
  p_segment text default null,
  p_make text default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_disp int default null,
  p_chassis text default null,
  p_age text default null,
  p_focus_make text default 'Volvo'
)
returns table(make_name text, count int)
language sql stable security invoker
as $$
  select make_name, count(*)::int
  from public.population
  where snapshot_date = (select max(snapshot_date) from public.population)
    and make_name is not null
    and maximum_laden_mass_kg >= 16000
    and (p_segment is null or usage_name = p_segment)
    and (p_make is null or make_name = p_make)
    and (p_region is null or sales_region = p_region)
    and (p_hp is null or hp_bucket = p_hp)
    and (p_fuel is null or fuel_name = p_fuel)
    and (p_pabygg is null or pabygg_segment = p_pabygg)
    and (p_disp is null or disp_bucket = p_disp)
    and (p_chassis is null or trekker_jevnlast = p_chassis)
    and (
      p_age is null
      or (p_age = 'under10'
          and first_registration_date >= (current_date - interval '10 years')::date)
      or (p_age = 'over10'
          and first_registration_date < (current_date - interval '10 years')::date)
    )
  group by make_name order by count(*) desc;
$$;

drop function if exists public.pop_summary_by_region(text, text, int, text, text, int, text, text, text);

create or replace function public.pop_summary_by_region(
  p_segment text default null,
  p_make text default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_disp int default null,
  p_chassis text default null,
  p_age text default null,
  p_focus_make text default 'Volvo'
)
returns table(region smallint, count int, volvo_count int)
language sql stable security invoker
as $$
  select sales_region as region,
         count(*)::int,
         count(*) filter (where make_name = p_focus_make)::int
  from public.population
  where snapshot_date = (select max(snapshot_date) from public.population)
    and maximum_laden_mass_kg >= 16000
    and sales_region is not null
    and (p_segment is null or usage_name = p_segment)
    and (p_make is null or make_name = p_make)
    and (p_hp is null or hp_bucket = p_hp)
    and (p_fuel is null or fuel_name = p_fuel)
    and (p_pabygg is null or pabygg_segment = p_pabygg)
    and (p_disp is null or disp_bucket = p_disp)
    and (p_chassis is null or trekker_jevnlast = p_chassis)
    and (
      p_age is null
      or (p_age = 'under10'
          and first_registration_date >= (current_date - interval '10 years')::date)
      or (p_age = 'over10'
          and first_registration_date < (current_date - interval '10 years')::date)
    )
  group by sales_region order by sales_region;
$$;

drop function if exists public.pop_summary_by_fuel(text, text, int, int, text, int, text, text, text);

create or replace function public.pop_summary_by_fuel(
  p_segment text default null,
  p_make text default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_disp int default null,
  p_chassis text default null,
  p_age text default null,
  p_focus_make text default 'Volvo'
)
returns table(fuel text, count int, volvo_count int)
language sql stable security invoker
as $$
  select fuel_name as fuel,
         count(*)::int,
         count(*) filter (where make_name = p_focus_make)::int
  from public.population
  where snapshot_date = (select max(snapshot_date) from public.population)
    and maximum_laden_mass_kg >= 16000
    and fuel_name is not null
    and (p_segment is null or usage_name = p_segment)
    and (p_make is null or make_name = p_make)
    and (p_region is null or sales_region = p_region)
    and (p_hp is null or hp_bucket = p_hp)
    and (p_pabygg is null or pabygg_segment = p_pabygg)
    and (p_disp is null or disp_bucket = p_disp)
    and (p_chassis is null or trekker_jevnlast = p_chassis)
    and (
      p_age is null
      or (p_age = 'under10'
          and first_registration_date >= (current_date - interval '10 years')::date)
      or (p_age = 'over10'
          and first_registration_date < (current_date - interval '10 years')::date)
    )
  group by fuel_name order by count(*) desc;
$$;

grant execute on function public.pop_summary_by_make(text, text, int, int, text, text, int, text, text, text) to authenticated;
grant execute on function public.pop_summary_by_region(text, text, int, int, text, text, int, text, text, text) to authenticated;
grant execute on function public.pop_summary_by_fuel(text, text, int, int, text, text, int, text, text, text) to authenticated;
