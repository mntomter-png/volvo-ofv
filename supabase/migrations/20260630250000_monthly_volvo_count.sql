-- Inkluder Volvo-antall i månedsaggregeringer for markedsandel i diagram.

drop function if exists public.dash_registrations_by_month(text, int, text);
drop function if exists public.reg_summary_by_month(int, text, text, int, int, text, text, int, text, date, date);

create or replace function public.dash_registrations_by_month(
  p_segment text default null,
  p_region int default null,
  p_pabygg text default null
)
returns table(month date, count int, volvo_count int)
language sql stable security invoker
as $$
  select
    date_trunc('month', transaction_time)::date as month,
    count(*)::int,
    count(*) filter (where make_name = 'Volvo')::int as volvo_count
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg >= 16000
    and extract(year from transaction_time) = extract(year from current_date)
    and (p_segment is null or usage_name = p_segment)
    and (p_region is null or sales_region = p_region)
    and (p_pabygg is null or pabygg_segment = p_pabygg)
  group by 1
  order by 1;
$$;

create or replace function public.reg_summary_by_month(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_disp int default null,
  p_chassis text default null,
  p_from date default null,
  p_to date default null
)
returns table(month date, count int, volvo_count int)
language sql stable security invoker
as $$
  select
    date_trunc('month', transaction_time)::date as month,
    count(*)::int,
    count(*) filter (where make_name = 'Volvo')::int as volvo_count
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg >= 16000
    and (p_from is not null or p_to is not null
         or extract(year from transaction_time) = p_year)
    and (p_from is null or transaction_time >= p_from)
    and (p_to is null or transaction_time < (p_to + 1))
    and (p_segment is null or usage_name = p_segment)
    and (p_make is null or make_name = p_make)
    and (p_region is null or sales_region = p_region)
    and (p_hp is null or hp_bucket = p_hp)
    and (p_fuel is null or fuel_name = p_fuel)
    and (p_pabygg is null or pabygg_segment = p_pabygg)
    and (p_disp is null or disp_bucket = p_disp)
    and (p_chassis is null or trekker_jevnlast = p_chassis)
  group by 1
  order by 1;
$$;

grant execute on function public.dash_registrations_by_month(text, int, text) to authenticated;
grant execute on function public.reg_summary_by_month(int, text, text, int, int, text, text, int, text, date, date) to authenticated;
