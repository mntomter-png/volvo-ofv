-- Populasjon/bestand: distriktsfilter utledet fra brukerens postnummer.

alter table public.population
  add column if not exists sales_district text
  generated always as (public.ofv_district_from_postal(primary_user_postal_code)) stored;

comment on column public.population.sales_district is
  'Volvo-distrikt utledet fra brukerens postnummer (ofv_district_from_postal).';

create index if not exists population_snapshot_district_idx
  on public.population (snapshot_date, sales_district)
  where maximum_laden_mass_kg >= 16000;

-- ---------------------------------------------------------------------------
-- Oppdater populasjons-RPC-er med p_district
-- ---------------------------------------------------------------------------

drop function if exists public.pop_summary_by_make(text, text, int, int, text, text, int, text, text, text);
drop function if exists public.pop_summary_by_segment(text, text, int, int, text, text, int, text, text, text);
drop function if exists public.pop_summary_by_region(text, text, int, int, text, text, int, text, text, text);
drop function if exists public.pop_summary_by_fuel(text, text, int, int, text, text, int, text, text, text);
drop function if exists public.pop_fleet_owners(text, text, int, int, text, text, int, text, text, int, int, text);
drop function if exists public.pop_pkk_fleet_owners(text, text, int, int, text, text, int, text, text, int, int, text);

create or replace function public.pop_summary_by_make(
  p_segment text default null,
  p_make text default null,
  p_region int default null,
  p_district text default null,
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
    and (p_district is null or sales_district = p_district)
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

create or replace function public.pop_summary_by_segment(
  p_segment text default null,
  p_make text default null,
  p_region int default null,
  p_district text default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_disp int default null,
  p_chassis text default null,
  p_age text default null,
  p_focus_make text default 'Volvo'
)
returns table(segment text, count int, volvo_count int)
language sql stable security invoker
as $$
  select
    coalesce(usage_name, 'Ukjent') as segment,
    count(*)::int as count,
    count(*) filter (where make_name = p_focus_make)::int as volvo_count
  from public.population
  where snapshot_date = (select max(snapshot_date) from public.population)
    and maximum_laden_mass_kg >= 16000
    and (p_segment is null or usage_name = p_segment)
    and (p_make is null or make_name = p_make)
    and (p_region is null or sales_region = p_region)
    and (p_district is null or sales_district = p_district)
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
  group by coalesce(usage_name, 'Ukjent')
  order by count(*) desc;
$$;

create or replace function public.pop_summary_by_region(
  p_segment text default null,
  p_make text default null,
  p_region int default null,
  p_district text default null,
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
    and (p_district is null or sales_district = p_district)
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

create or replace function public.pop_summary_by_fuel(
  p_segment text default null,
  p_make text default null,
  p_region int default null,
  p_district text default null,
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
    and (p_district is null or sales_district = p_district)
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

create or replace function public.pop_fleet_owners(
  p_segment text default null,
  p_make text default null,
  p_region int default null,
  p_district text default null,
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
      and (p_district is null or sales_district = p_district)
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

create or replace function public.pop_pkk_fleet_owners(
  p_segment text default null,
  p_make text default null,
  p_region int default null,
  p_district text default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_disp int default null,
  p_chassis text default null,
  p_age text default null,
  p_min_volvo int default 1,
  p_limit int default 30,
  p_focus_make text default 'Volvo'
)
returns table(
  owner_key text,
  owner_name text,
  focus_count int,
  total_count int,
  pkk_due_count int
)
language sql stable security invoker
as $$
  with owners as (
    select coalesce(nullif(primary_owner_orgnr, ''), primary_owner_name) as owner_key,
           max(primary_owner_name) as owner_name,
           count(*) filter (where make_name = p_focus_make)::int as focus_count,
           count(*)::int as total_count,
           count(*) filter (
             where make_name = p_focus_make
               and pkk_next_deadline is not null
               and pkk_next_deadline <= (current_date + interval '90 days')
           )::int as pkk_due_count
    from public.population
    where snapshot_date = (select max(snapshot_date) from public.population)
      and maximum_laden_mass_kg >= 16000
      and primary_owner_name is not null
      and (p_segment is null or usage_name = p_segment)
      and (p_make is null or make_name = p_make)
      and (p_region is null or sales_region = p_region)
      and (p_district is null or sales_district = p_district)
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
  )
  select owner_key, owner_name, focus_count, total_count, pkk_due_count
  from owners
  order by focus_count desc, owner_name
  limit greatest(p_limit, 1);
$$;

grant execute on function public.pop_summary_by_make(text, text, int, text, int, text, text, int, text, text, text) to authenticated;
grant execute on function public.pop_summary_by_segment(text, text, int, text, int, text, text, int, text, text, text) to authenticated;
grant execute on function public.pop_summary_by_region(text, text, int, text, int, text, text, int, text, text, text) to authenticated;
grant execute on function public.pop_summary_by_fuel(text, text, int, text, int, text, text, int, text, text, text) to authenticated;
grant execute on function public.pop_fleet_owners(text, text, int, text, int, text, text, int, text, text, int, int, text) to authenticated;
grant execute on function public.pop_pkk_fleet_owners(text, text, int, text, int, text, text, int, text, text, int, int, text) to authenticated;
