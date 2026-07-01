-- Steg 2: Største kjøpere i perioden (uten flåte-heuristikk)

create or replace function public.reg_top_buyers(
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
  p_limit int default 15,
  p_focus_make text default 'Volvo'
)
returns table(owner_name text, count int, focus_count int)
language sql stable security invoker
as $$
  select max(primary_owner_name) as owner_name,
         count(*)::int,
         count(*) filter (where make_name = p_focus_make)::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg >= 16000
    and primary_owner_name is not null
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
    and (p_chassis is null or trekker_jevnlast = p_chassis)
  group by coalesce(nullif(primary_owner_orgnr, ''), primary_owner_name)
  order by count(*) desc
  limit greatest(p_limit, 1);
$$;

grant execute on function public.reg_top_buyers(int, text, text, int, int, int, text, text, int, text, date, date, int, text) to authenticated;
