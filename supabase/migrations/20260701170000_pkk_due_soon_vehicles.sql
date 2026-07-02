-- PKK: flat liste over kjøretøy med frist innen N måneder for største fokusmerke-kunder.

create index if not exists population_pkk_next_deadline_idx
  on public.population (pkk_next_deadline)
  where pkk_next_deadline is not null;

create or replace function public.pop_pkk_due_soon_vehicles(
  p_segment text default null,
  p_make text default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_disp int default null,
  p_chassis text default null,
  p_age text default null,
  p_months int default 6,
  p_min_volvo int default 1,
  p_owner_limit int default 30,
  p_vehicle_limit int default 500,
  p_focus_make text default 'Volvo'
)
returns table(
  owner_key text,
  owner_name text,
  focus_fleet_size int,
  registration_number text,
  model_name text,
  first_registration_date date,
  pkk_last_date date,
  pkk_next_deadline date,
  days_until_due int
)
language sql stable security invoker
as $$
  with top_owners as (
    select coalesce(nullif(primary_owner_orgnr, ''), primary_owner_name) as owner_key,
           max(primary_owner_name) as owner_name,
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
    having count(*) filter (where make_name = p_focus_make) >= greatest(p_min_volvo, 1)
    order by focus_count desc, owner_name
    limit greatest(p_owner_limit, 1)
  )
  select coalesce(nullif(p.primary_owner_orgnr, ''), p.primary_owner_name) as owner_key,
         p.primary_owner_name as owner_name,
         o.focus_count as focus_fleet_size,
         p.registration_number,
         p.model_name,
         p.first_registration_date,
         p.pkk_last_date,
         p.pkk_next_deadline,
         (p.pkk_next_deadline - current_date)::int as days_until_due
  from public.population p
  inner join top_owners o
    on coalesce(nullif(p.primary_owner_orgnr, ''), p.primary_owner_name) = o.owner_key
  where p.snapshot_date = (select max(snapshot_date) from public.population)
    and p.maximum_laden_mass_kg >= 16000
    and p.make_name = p_focus_make
    and p.pkk_next_deadline is not null
    and p.pkk_next_deadline <= (current_date + make_interval(months => greatest(p_months, 1)))
    and (p_segment is null or p.usage_name = p_segment)
    and (p_make is null or p.make_name = p_make)
    and (p_region is null or p.sales_region = p_region)
    and (p_hp is null or p.hp_bucket = p_hp)
    and (p_fuel is null or p.fuel_name = p_fuel)
    and (p_pabygg is null or p.pabygg_segment = p_pabygg)
    and (p_disp is null or p.disp_bucket = p_disp)
    and (p_chassis is null or p.trekker_jevnlast = p_chassis)
    and (
      p_age is null
      or (p_age = 'under10'
          and p.first_registration_date >= (current_date - interval '10 years')::date)
      or (p_age = 'over10'
          and p.first_registration_date < (current_date - interval '10 years')::date)
    )
  order by p.pkk_next_deadline asc, o.focus_count desc, p.registration_number
  limit greatest(p_vehicle_limit, 1);
$$;

grant execute on function public.pop_pkk_due_soon_vehicles(
  text, text, int, int, text, text, int, text, text, int, int, int, int, text
) to authenticated;
