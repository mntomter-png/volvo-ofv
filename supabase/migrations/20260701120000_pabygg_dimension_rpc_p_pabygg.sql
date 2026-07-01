-- Påbygg er dimensjon (ikke filter) i disse RPC-ene. Legg til p_pabygg som ignorert
-- parameter slik PostgREST matcher kall fra filterRpcBase uten PGRST202.

drop function if exists public.reg_make_share_by_pabygg(int, text, text, int, int, int, text, int, text, date, date, text);

create or replace function public.reg_make_share_by_pabygg(
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
returns table(pabygg text, make_name text, count int)
language sql stable security invoker
as $$
  select pabygg_segment as pabygg,
         r.make_name,
         count(*)::int
  from public.registrations r
  where transaction_type_id = '10'
    and maximum_laden_mass_kg >= 16000
    and pabygg_segment is not null
    and r.make_name is not null
    and (p_from is not null or p_to is not null
         or extract(year from transaction_time) = p_year)
    and (p_from is null or transaction_time >= p_from)
    and (p_to is null or transaction_time < (p_to + 1))
    and (p_segment is null or usage_name = p_segment)
    and (p_make is null or r.make_name = p_make)
    and (p_month is null or extract(month from transaction_time) = p_month)
    and (p_region is null or sales_region = p_region)
    and (p_hp is null or hp_bucket = p_hp)
    and (p_fuel is null or fuel_name = p_fuel)
    and (p_disp is null or disp_bucket = p_disp)
    and (p_chassis is null or trekker_jevnlast = p_chassis)
  group by pabygg_segment, r.make_name
  order by pabygg_segment, count(*) desc;
$$;

drop function if exists public.reg_summary_by_pabygg(int, text, text, int, int, int, text, int, text, date, date, text);

create or replace function public.reg_summary_by_pabygg(
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
returns table(pabygg text, count int, volvo_count int)
language sql stable security invoker
as $$
  select pabygg_segment as pabygg,
         count(*)::int,
         count(*) filter (where make_name = p_focus_make)::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg >= 16000
    and pabygg_segment is not null
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
    and (p_disp is null or disp_bucket = p_disp)
    and (p_chassis is null or trekker_jevnlast = p_chassis)
  group by pabygg_segment
  order by count(*) desc;
$$;

grant execute on function public.reg_make_share_by_pabygg(int, text, text, int, int, int, text, text, int, text, date, date, text) to authenticated;
grant execute on function public.reg_summary_by_pabygg(int, text, text, int, int, int, text, text, int, text, date, date, text) to authenticated;
