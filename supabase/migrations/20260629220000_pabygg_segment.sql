-- Påbygg-segment (Construction / Distribution / Long Haul / Annet) fra
-- bodywork-kode med fallback til usage_name. Speiler OFV_PABYGG_MAP og
-- inferPabyggFromUsageName() i src/lib/ofv/segmentation.ts.

create or replace function public.ofv_pabygg_segment(
  bodywork_code int,
  usage_name text
)
returns text
language sql
immutable
as $$
  select coalesce(
    case bodywork_code
      when -1 then 'Long Haul'
      when 1 then 'Distribution'
      when 3 then 'Distribution'
      when 4 then 'Distribution'
      when 5 then 'Distribution'
      when 6 then 'Distribution'
      when 8 then 'Distribution'
      when 9 then 'Construction'
      when 10 then 'Construction'
      when 11 then 'Long Haul'
      when 12 then 'Long Haul'
      when 15 then 'Construction'
      when 16 then 'Construction'
      when 21 then 'Construction'
      when 26 then 'Construction'
      when 28 then 'Construction'
      when 30 then 'Distribution'
      when 32 then 'Distribution'
      when 79 then 'Long Haul'
      else null
    end,
    case
      when usage_name ilike '%trekk%' then 'Long Haul'
      when usage_name ilike '%tankbil%' then 'Long Haul'
      when usage_name ilike '%lukket godsrom%' then 'Distribution'
      when usage_name ilike '%plan%' or usage_name ilike '%kasse%' then 'Distribution'
      else 'Annet'
    end
  );
$$;

alter table public.registrations
  add column if not exists bodywork_code integer,
  add column if not exists bodywork_name text;

alter table public.population
  add column if not exists bodywork_code integer,
  add column if not exists bodywork_name text;

alter table public.registrations
  add column if not exists pabygg_segment text
  generated always as (public.ofv_pabygg_segment(bodywork_code, usage_name)) stored;

alter table public.population
  add column if not exists pabygg_segment text
  generated always as (public.ofv_pabygg_segment(bodywork_code, usage_name)) stored;

create index if not exists registrations_pabygg_segment_idx
  on public.registrations (pabygg_segment);
create index if not exists population_pabygg_segment_idx
  on public.population (pabygg_segment);

-- Utvid aggregeringer med p_pabygg (påbygg-segment-filter).
drop function if exists public.reg_summary_by_month(int, text, text, int, int, text);

create or replace function public.reg_summary_by_month(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null
)
returns table(month date, count int)
language sql stable security invoker
as $$
  select date_trunc('month', transaction_time)::date as month, count(*)::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg > 16000
    and extract(year from transaction_time) = p_year
    and (p_segment is null or usage_name = p_segment)
    and (p_make is null or make_name = p_make)
    and (p_region is null or sales_region = p_region)
    and (p_hp is null or hp_bucket = p_hp)
    and (p_fuel is null or fuel_name = p_fuel)
    and (p_pabygg is null or pabygg_segment = p_pabygg)
  group by 1 order by 1;
$$;

drop function if exists public.reg_summary_by_make(int, text, text, int, int, int, text);

create or replace function public.reg_summary_by_make(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_month int default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null
)
returns table(make_name text, count int)
language sql stable security invoker
as $$
  select make_name, count(*)::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg > 16000
    and make_name is not null
    and extract(year from transaction_time) = p_year
    and (p_segment is null or usage_name = p_segment)
    and (p_make is null or make_name = p_make)
    and (p_month is null or extract(month from transaction_time) = p_month)
    and (p_region is null or sales_region = p_region)
    and (p_hp is null or hp_bucket = p_hp)
    and (p_fuel is null or fuel_name = p_fuel)
    and (p_pabygg is null or pabygg_segment = p_pabygg)
  group by make_name order by count(*) desc;
$$;

drop function if exists public.reg_summary_by_region(int, text, text, int, int, text);

create or replace function public.reg_summary_by_region(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_month int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null
)
returns table(region smallint, count int, volvo_count int)
language sql stable security invoker
as $$
  select sales_region as region,
         count(*)::int,
         count(*) filter (where make_name = 'Volvo')::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg > 16000
    and sales_region is not null
    and extract(year from transaction_time) = p_year
    and (p_segment is null or usage_name = p_segment)
    and (p_make is null or make_name = p_make)
    and (p_month is null or extract(month from transaction_time) = p_month)
    and (p_hp is null or hp_bucket = p_hp)
    and (p_fuel is null or fuel_name = p_fuel)
    and (p_pabygg is null or pabygg_segment = p_pabygg)
  group by sales_region order by sales_region;
$$;

drop function if exists public.reg_summary_by_hp(int, text, text, int, int, text);

create or replace function public.reg_summary_by_hp(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_month int default null,
  p_region int default null,
  p_fuel text default null,
  p_pabygg text default null
)
returns table(bucket smallint, count int, volvo_count int)
language sql stable security invoker
as $$
  select hp_bucket as bucket,
         count(*)::int,
         count(*) filter (where make_name = 'Volvo')::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg > 16000
    and hp_bucket is not null
    and extract(year from transaction_time) = p_year
    and (p_segment is null or usage_name = p_segment)
    and (p_make is null or make_name = p_make)
    and (p_month is null or extract(month from transaction_time) = p_month)
    and (p_region is null or sales_region = p_region)
    and (p_fuel is null or fuel_name = p_fuel)
    and (p_pabygg is null or pabygg_segment = p_pabygg)
  group by hp_bucket order by hp_bucket;
$$;

drop function if exists public.reg_summary_by_fuel(int, text, text, int, int, int);

create or replace function public.reg_summary_by_fuel(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_month int default null,
  p_region int default null,
  p_hp int default null,
  p_pabygg text default null
)
returns table(fuel text, count int, volvo_count int)
language sql stable security invoker
as $$
  select fuel_name as fuel,
         count(*)::int,
         count(*) filter (where make_name = 'Volvo')::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg > 16000
    and fuel_name is not null
    and extract(year from transaction_time) = p_year
    and (p_segment is null or usage_name = p_segment)
    and (p_make is null or make_name = p_make)
    and (p_month is null or extract(month from transaction_time) = p_month)
    and (p_region is null or sales_region = p_region)
    and (p_hp is null or hp_bucket = p_hp)
    and (p_pabygg is null or pabygg_segment = p_pabygg)
  group by fuel_name order by count(*) desc;
$$;

drop function if exists public.reg_fleet_owners(int, text, int, int, text);

create or replace function public.reg_fleet_owners(
  p_year int,
  p_segment text default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null
)
returns table(owner_key text, owner_name text, count int, volvo_count int)
language sql stable security invoker
as $$
  select coalesce(nullif(primary_owner_orgnr, ''), primary_owner_name) as owner_key,
         max(primary_owner_name) as owner_name,
         count(*)::int,
         count(*) filter (where make_name = 'Volvo')::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg > 16000
    and coalesce(nullif(primary_owner_orgnr, ''), primary_owner_name) is not null
    and extract(year from transaction_time) = p_year
    and (p_segment is null or usage_name = p_segment)
    and (p_region is null or sales_region = p_region)
    and (p_hp is null or hp_bucket = p_hp)
    and (p_fuel is null or fuel_name = p_fuel)
    and (p_pabygg is null or pabygg_segment = p_pabygg)
  group by 1
  order by count(*) desc;
$$;

-- Påbygg-fordeling: ignorerer påbygg-filter, respekterer øvrige filtre.
create or replace function public.reg_summary_by_pabygg(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_month int default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null
)
returns table(pabygg text, count int, volvo_count int)
language sql stable security invoker
as $$
  select pabygg_segment as pabygg,
         count(*)::int,
         count(*) filter (where make_name = 'Volvo')::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg > 16000
    and pabygg_segment is not null
    and extract(year from transaction_time) = p_year
    and (p_segment is null or usage_name = p_segment)
    and (p_make is null or make_name = p_make)
    and (p_month is null or extract(month from transaction_time) = p_month)
    and (p_region is null or sales_region = p_region)
    and (p_hp is null or hp_bucket = p_hp)
    and (p_fuel is null or fuel_name = p_fuel)
  group by pabygg_segment
  order by count(*) desc;
$$;

grant execute on function public.ofv_pabygg_segment(int, text) to authenticated;
grant execute on function public.reg_summary_by_month(int, text, text, int, int, text, text) to authenticated;
grant execute on function public.reg_summary_by_make(int, text, text, int, int, int, text, text) to authenticated;
grant execute on function public.reg_summary_by_region(int, text, text, int, int, text, text) to authenticated;
grant execute on function public.reg_summary_by_hp(int, text, text, int, int, text, text) to authenticated;
grant execute on function public.reg_summary_by_fuel(int, text, text, int, int, int, text) to authenticated;
grant execute on function public.reg_fleet_owners(int, text, int, int, text, text) to authenticated;
grant execute on function public.reg_summary_by_pabygg(int, text, text, int, int, int, text) to authenticated;
