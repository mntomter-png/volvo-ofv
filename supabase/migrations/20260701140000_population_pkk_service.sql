-- PKK-oppfølging (Service): kolonner på bestand + flåte-RPC-er sortert på fokusmerke.

alter table public.population
  add column if not exists pkk_last_date date,
  add column if not exists pkk_next_deadline date;

comment on column public.population.pkk_last_date is
  'Siste periodiske kjøretøykontroll (PKK). Fylles ved utvidet OFV-synk.';
comment on column public.population.pkk_next_deadline is
  'Neste PKK-frist. Fylles ved utvidet OFV-synk.';

create or replace function public.pop_pkk_fleet_owners(
  p_segment text default null,
  p_make text default null,
  p_region int default null,
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

create or replace function public.pop_pkk_owner_vehicles(
  p_owner_key text,
  p_segment text default null,
  p_make text default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_disp int default null,
  p_chassis text default null,
  p_age text default null,
  p_limit int default 100,
  p_focus_make text default 'Volvo'
)
returns table(
  registration_number text,
  make_name text,
  model_name text,
  first_registration_date date,
  pkk_last_date date,
  pkk_next_deadline date
)
language sql stable security invoker
as $$
  select registration_number,
         make_name,
         model_name,
         first_registration_date,
         pkk_last_date,
         pkk_next_deadline
  from public.population
  where snapshot_date = (select max(snapshot_date) from public.population)
    and maximum_laden_mass_kg >= 16000
    and make_name = p_focus_make
    and coalesce(nullif(primary_owner_orgnr, ''), primary_owner_name) = p_owner_key
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
  order by pkk_next_deadline asc nulls last, registration_number
  limit greatest(p_limit, 1);
$$;

grant execute on function public.pop_pkk_fleet_owners(text, text, int, int, text, text, int, text, text, int, int, text) to authenticated;
grant execute on function public.pop_pkk_owner_vehicles(text, text, text, int, int, text, text, int, text, text, int, text) to authenticated;
