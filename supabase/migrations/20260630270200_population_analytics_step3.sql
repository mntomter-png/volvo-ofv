-- Steg 3: Reell flåte fra populasjonsbestand

create or replace function public.pop_fleet_owners(
  p_segment text default null,
  p_make text default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_disp int default null,
  p_chassis text default null,
  p_age text default null,
  p_min_vehicles int default 3,
  p_limit int default 15,
  p_focus_make text default 'Volvo'
)
returns table(owner_name text, count int, focus_count int)
language sql stable security invoker
as $$
  with owners as (
    select coalesce(nullif(primary_owner_orgnr, ''), primary_owner_name) as owner_key,
           max(primary_owner_name) as owner_name,
           count(*)::int as vehicle_count,
           count(*) filter (where make_name = p_focus_make)::int as focus_count
    from public.population
    where snapshot_date = (select max(snapshot_date) from public.population)
      and maximum_laden_mass_kg >= 16000
      and primary_owner_name is not null
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
    group by 1
    having count(*) >= greatest(p_min_vehicles, 1)
  )
  select owner_name, vehicle_count, focus_count
  from owners
  order by vehicle_count desc, owner_name
  limit greatest(p_limit, 1);
$$;

grant execute on function public.pop_fleet_owners(text, text, int, int, text, text, int, text, text, int, int, text) to authenticated;
