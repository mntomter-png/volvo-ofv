-- Distrikt (Volvo-forhandlernett) utledet fra brukerens postnummer.
-- Speiler DISTRICT_RANGES i src/lib/ofv/segmentation.ts.

create or replace function public.ofv_district_from_postal(postal text)
returns text
language sql
immutable
as $$
  select case
    when postal is null
      or regexp_replace(postal, '\D', '', 'g') = '' then null
    else (
      select case
        when code between 0 and 1295 then 'Oslo'
        when code between 1300 and 1399 then 'Asker og Bærum'
        when code between 1400 and 1460 then 'Follo'
        when code between 1461 and 1488 then 'Jessheim'
        when code between 1489 and 1539 then 'Follo'
        when code between 1540 and 1556 then 'Follo'
        when code between 1900 and 1971 then 'Jessheim'
        when code between 2000 and 2099 then 'Jessheim'
        when code between 2100 and 2134 then 'Kongsvinger'
        when code between 2150 and 2170 then 'Jessheim'
        when code between 2600 and 2609 then 'Lillehammer'
        when code between 2610 and 2610 then 'Hamar'
        when code between 2611 and 2611 then 'Lillehammer'
        when code between 2612 and 2612 then 'Hamar'
        when code between 2613 and 2615 then 'Lillehammer'
        when code between 2616 and 2616 then 'Hamar'
        when code between 2617 and 2699 then 'Lillehammer'
        when code between 2800 and 2899 then 'Gjøvik'
        when code between 3000 and 3069 then 'Drammen'
        when code between 3070 and 3074 then 'Vestfold'
        when code between 3075 and 3075 then 'Drammen'
        when code between 3076 and 3099 then 'Vestfold'
        when code between 3400 and 3499 then 'Drammen'
        when code between 3500 and 3543 then 'Hønefoss'
        when code between 3544 and 3544 then 'Buskerud'
        when code between 3545 and 3599 then 'Hønefoss'
        when code between 1557 and 1599 then 'Østfold'
        when code between 1600 and 1899 then 'Østfold'
        when code between 1972 and 1999 then 'Østfold'
        when code between 2200 and 2499 then 'Hamar'
        when code between 2500 and 2599 then 'Kongsvinger'
        when code between 2700 and 2710 then 'Kongsvinger'
        when code between 2711 and 2770 then 'Gjøvik'
        when code between 2771 and 2799 then 'Kongsvinger'
        when code between 2900 and 2985 then 'Gjøvik'
        when code between 2986 and 2999 then 'Kongsvinger'
        when code between 3100 and 3299 then 'Vestfold'
        when code between 3300 and 3399 then 'Buskerud'
        when code between 3600 and 3699 then 'Buskerud'
        when code between 3700 and 3999 then 'Telemark'
        when code between 4000 and 4399 then 'Sandnes'
        when code between 4400 and 4999 then 'Kristiansand S'
        when code between 5000 and 5499 then 'Bergen'
        when code between 5500 and 5699 then 'Haugesund'
        when code between 5700 and 5999 then 'Bergen'
        when code between 6700 and 6999 then 'Sandane'
        when code between 6000 and 6399 then 'Ålesund'
        when code between 6400 and 6699 then 'Molde'
        when code between 7000 and 7599 then 'Trondheim'
        when code between 7600 and 7799 then 'Steinkjer'
        when code between 7800 and 7999 then 'Namsos'
        when code between 8600 and 8899 then 'Mosjøen'
        when code between 8000 and 8299 then 'Bodø'
        when code between 8300 and 8499 then 'Svolvær'
        when code between 8500 and 8599 then 'Narvik'
        when code between 8900 and 8999 then 'Bodø'
        when code between 9000 and 9199 then 'Tromsø'
        when code between 9200 and 9399 then 'Finnsnes'
        when code between 9400 and 9499 then 'Harstad'
        when code between 9500 and 9599 then 'Alta'
        when code between 9600 and 9799 then 'Alta'
        when code between 9800 and 9999 then 'Kirkenes'
        else null
      end
      from (select regexp_replace(postal, '\D', '', 'g')::int as code) t
    )
  end;
$$;

create or replace function public.reg_summary_by_district(
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
returns table(district text, region smallint, count int, focus_count int)
language sql stable security invoker
as $$
  select
    public.ofv_district_from_postal(primary_user_postal_code) as district,
    sales_region as region,
    count(*)::int,
    count(*) filter (where make_name = p_focus_make)::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg >= 16000
    and public.ofv_district_from_postal(primary_user_postal_code) is not null
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
  group by 1, 2
  order by count(*) desc;
$$;

grant execute on function public.ofv_district_from_postal(text) to authenticated;
grant execute on function public.reg_summary_by_district(int, text, text, int, int, int, text, text, int, text, date, date, text) to authenticated;
