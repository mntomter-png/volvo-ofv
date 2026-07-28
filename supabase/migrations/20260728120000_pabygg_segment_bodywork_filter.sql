-- Volvo påbygg som hovedsegment + OFV AdditionalBodyworks (bodywork_code) som filter.
-- p_bodywork = -1 betyr bodywork_code IS NULL (trekkvogn uten påbygg).

create index if not exists registrations_bodywork_code_idx
  on public.registrations (bodywork_code);

create index if not exists population_bodywork_code_idx
  on public.population (bodywork_code);

do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'dash_registrations_by_segment'
  loop
    execute 'drop function if exists ' || r.sig::text;
  end loop;
end $$;

create function public.dash_registrations_by_segment(
  p_segment text default null,
  p_region int default null,
  p_pabygg text default null,
  p_focus_make text default 'Volvo'
)
returns table(segment text, count int, volvo_count int)
language sql stable security invoker
as $$
  select
    coalesce(pabygg_segment, 'Annet') as segment,
    count(*)::int,
    count(*) filter (where make_name = p_focus_make)::int as volvo_count
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg >= 16000
    and extract(year from transaction_time) = extract(year from current_date)
    and (p_segment is null or usage_name = p_segment)
    and (p_region is null or sales_region = p_region)
    and (p_pabygg is null or pabygg_segment = p_pabygg)
  group by coalesce(pabygg_segment, 'Annet')
  order by count(*) desc;
$$;

grant execute on function public.dash_registrations_by_segment(text, int, text, text) to authenticated;

do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'dash_population_by_segment'
  loop
    execute 'drop function if exists ' || r.sig::text;
  end loop;
end $$;

create function public.dash_population_by_segment(
  p_segment text default null,
  p_region int default null,
  p_pabygg text default null,
  p_focus_make text default 'Volvo'
)
returns table(segment text, count int, volvo_count int)
language sql stable security invoker
as $$
  select
    coalesce(pabygg_segment, 'Annet') as segment,
    count(*)::int,
    count(*) filter (where make_name = p_focus_make)::int as volvo_count
  from public.population
  where snapshot_date = (select max(snapshot_date) from public.population)
    and maximum_laden_mass_kg >= 16000
    and (p_segment is null or usage_name = p_segment)
    and (p_region is null or sales_region = p_region)
    and (p_pabygg is null or pabygg_segment = p_pabygg)
  group by coalesce(pabygg_segment, 'Annet')
  order by count(*) desc;
$$;

grant execute on function public.dash_population_by_segment(text, int, text, text) to authenticated;


create or replace view public.dashboard_registrations_by_segment
with (security_invoker = true) as
select
  coalesce(pabygg_segment, 'Annet') as segment,
  count(*)::int as count,
  count(*) filter (where make_name = 'Volvo')::int as volvo_count
from public.registrations
where transaction_type_id = '10'
  and maximum_laden_mass_kg >= 16000
group by coalesce(pabygg_segment, 'Annet')
order by count desc;

create or replace view public.dashboard_population_by_segment
with (security_invoker = true) as
select
  coalesce(pabygg_segment, 'Annet') as segment,
  count(*)::int as count,
  count(*) filter (where make_name = 'Volvo')::int as volvo_count
from public.population
where snapshot_date = (select max(snapshot_date) from public.population)
  and maximum_laden_mass_kg >= 16000
group by coalesce(pabygg_segment, 'Annet')
order by count desc;

grant select on public.dashboard_registrations_by_segment to authenticated;
grant select on public.dashboard_population_by_segment to authenticated;

do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'reg_summary_by_month'
  loop
    execute 'drop function if exists ' || r.sig::text;
  end loop;
end $$;

create function public.reg_summary_by_month(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_disp int default null,
  p_chassis text default null,
  p_bodywork int default null,
  p_from date default null,
  p_to date default null,
  p_focus_make text default 'Volvo'
)
returns table(month date, count int, volvo_count int)
language sql stable security invoker
as $$
  select
    date_trunc('month', transaction_time)::date as month,
    count(*)::int,
    count(*) filter (where make_name = p_focus_make)::int as volvo_count
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
    and (
      p_bodywork is null
      or (p_bodywork = -1 and bodywork_code is null)
      or bodywork_code = p_bodywork
    )
  group by 1
  order by 1;
$$;
grant execute on function public.reg_summary_by_month(int, text, text, int, int, text, text, int, text, int, date, date, text) to authenticated;

do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'reg_summary_by_make'
  loop
    execute 'drop function if exists ' || r.sig::text;
  end loop;
end $$;

create function public.reg_summary_by_make(
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
  p_bodywork int default null,
  p_from date default null,
  p_to date default null
)
returns table(make_name text, count int)
language sql stable security invoker
as $$
  select make_name, count(*)::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg >= 16000
    and make_name is not null

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
    and (p_month is null or extract(month from transaction_time) = p_month)
    and (
      p_bodywork is null
      or (p_bodywork = -1 and bodywork_code is null)
      or bodywork_code = p_bodywork
    )
  group by make_name
  order by count(*) desc;
$$;
grant execute on function public.reg_summary_by_make(int, text, text, int, int, int, text, text, int, text, int, date, date) to authenticated;

do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'reg_summary_by_region'
  loop
    execute 'drop function if exists ' || r.sig::text;
  end loop;
end $$;

create function public.reg_summary_by_region(
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
  p_bodywork int default null,
  p_from date default null,
  p_to date default null,
  p_fleet_filter text default 'all',
  p_focus_make text default 'Volvo'
)
returns table(region smallint, count int, volvo_count int)
language sql stable security invoker
as $$
  with filtered as (
    select
      r.sales_region as region,
      r.make_name = p_focus_make as is_focus,
      (
        r.make_name = p_focus_make
        and r.vin is not null
        and exists (
          select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
        )
      ) as is_fleet_focus
    from public.registrations r
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and r.sales_region is not null
      and (p_from is not null or p_to is not null
           or extract(year from r.transaction_time) = p_year)
      and (p_from is null or r.transaction_time >= p_from)
      and (p_to is null or r.transaction_time < (p_to + 1))
      and (p_segment is null or r.usage_name = p_segment)
      and (p_make is null or r.make_name = p_make)
      and (p_month is null or extract(month from r.transaction_time) = p_month)
      and (p_region is null or r.sales_region = p_region)
      and (p_hp is null or r.hp_bucket = p_hp)
      and (p_fuel is null or r.fuel_name = p_fuel)
      and (p_pabygg is null or r.pabygg_segment = p_pabygg)
      and (p_disp is null or r.disp_bucket = p_disp)
      and (p_chassis is null or r.trekker_jevnlast = p_chassis)
      and (
        p_bodywork is null
        or (p_bodywork = -1 and r.bodywork_code is null)
        or r.bodywork_code = p_bodywork
      )
  )
  select
    region,
    count(*) filter (
      where case
        when coalesce(p_fleet_filter, 'all') = 'fleet' then is_fleet_focus
        when p_fleet_filter = 'region' then not is_fleet_focus
        else true
      end
    )::int,
    count(*) filter (
      where is_focus
        and case
          when coalesce(p_fleet_filter, 'all') = 'fleet' then is_fleet_focus
          when p_fleet_filter = 'region' then not is_fleet_focus
          else true
        end
    )::int
  from filtered
  group by region
  order by region;
$$;
grant execute on function public.reg_summary_by_region(int, text, text, int, int, int, text, text, int, text, int, date, date, text, text) to authenticated;

do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'reg_summary_by_district'
  loop
    execute 'drop function if exists ' || r.sig::text;
  end loop;
end $$;

create function public.reg_summary_by_district(
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
  p_bodywork int default null,
  p_from date default null,
  p_to date default null,
  p_fleet_filter text default 'all',
  p_focus_make text default 'Volvo'
)
returns table(district text, region smallint, count int, focus_count int)
language sql stable security invoker
as $$
  with filtered as (
    select
      public.ofv_district_from_postal(r.primary_user_postal_code) as district,
      r.sales_region as region,
      r.make_name = p_focus_make as is_focus,
      (
        r.make_name = p_focus_make
        and r.vin is not null
        and exists (
          select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
        )
      ) as is_fleet_focus
    from public.registrations r
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and public.ofv_district_from_postal(r.primary_user_postal_code) is not null
      and (p_from is not null or p_to is not null
           or extract(year from r.transaction_time) = p_year)
      and (p_from is null or r.transaction_time >= p_from)
      and (p_to is null or r.transaction_time < (p_to + 1))
      and (p_segment is null or r.usage_name = p_segment)
      and (p_make is null or r.make_name = p_make)
      and (p_month is null or extract(month from r.transaction_time) = p_month)
      and (p_region is null or r.sales_region = p_region)
      and (p_hp is null or r.hp_bucket = p_hp)
      and (p_fuel is null or r.fuel_name = p_fuel)
      and (p_pabygg is null or r.pabygg_segment = p_pabygg)
      and (p_disp is null or r.disp_bucket = p_disp)
      and (p_chassis is null or r.trekker_jevnlast = p_chassis)
      and (
        p_bodywork is null
        or (p_bodywork = -1 and r.bodywork_code is null)
        or r.bodywork_code = p_bodywork
      )
  )
  select
    district,
    region,
    count(*) filter (
      where case
        when coalesce(p_fleet_filter, 'all') = 'fleet' then is_fleet_focus
        when p_fleet_filter = 'region' then not is_fleet_focus
        else true
      end
    )::int,
    count(*) filter (
      where is_focus
        and case
          when coalesce(p_fleet_filter, 'all') = 'fleet' then is_fleet_focus
          when p_fleet_filter = 'region' then not is_fleet_focus
          else true
        end
    )::int
  from filtered
  group by district, region
  order by count(*) desc;
$$;
grant execute on function public.reg_summary_by_district(int, text, text, int, int, int, text, text, int, text, int, date, date, text, text) to authenticated;

do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'reg_summary_by_hp'
  loop
    execute 'drop function if exists ' || r.sig::text;
  end loop;
end $$;

create function public.reg_summary_by_hp(
  p_year int, p_segment text default null, p_make text default null,
  p_month int default null, p_region int default null, p_hp int default null,
  p_fuel text default null, p_pabygg text default null, p_disp int default null,
  p_chassis text default null, p_bodywork int default null,
  p_from date default null, p_to date default null, p_focus_make text default 'Volvo'
)
returns table(bucket smallint, count int, volvo_count int)
language sql stable security invoker as $$
  select hp_bucket as bucket, count(*)::int,
         count(*) filter (where make_name = p_focus_make)::int
  from public.registrations
  where transaction_type_id = '10' and maximum_laden_mass_kg >= 16000 and hp_bucket is not null

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
    and (p_month is null or extract(month from transaction_time) = p_month)
    and (
      p_bodywork is null
      or (p_bodywork = -1 and bodywork_code is null)
      or bodywork_code = p_bodywork
    )
  group by hp_bucket order by hp_bucket;
$$;
grant execute on function public.reg_summary_by_hp(int, text, text, int, int, int, text, text, int, text, int, date, date, text) to authenticated;

do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'reg_summary_by_fuel'
  loop
    execute 'drop function if exists ' || r.sig::text;
  end loop;
end $$;

create function public.reg_summary_by_fuel(
  p_year int, p_segment text default null, p_make text default null,
  p_month int default null, p_region int default null, p_hp int default null,
  p_fuel text default null, p_pabygg text default null, p_disp int default null,
  p_chassis text default null, p_bodywork int default null,
  p_from date default null, p_to date default null, p_focus_make text default 'Volvo'
)
returns table(fuel text, count int, volvo_count int)
language sql stable security invoker as $$
  select fuel_name as fuel, count(*)::int,
         count(*) filter (where make_name = p_focus_make)::int
  from public.registrations
  where transaction_type_id = '10' and maximum_laden_mass_kg >= 16000 and fuel_name is not null

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
    and (p_month is null or extract(month from transaction_time) = p_month)
    and (
      p_bodywork is null
      or (p_bodywork = -1 and bodywork_code is null)
      or bodywork_code = p_bodywork
    )
  group by fuel_name order by count(*) desc;
$$;
grant execute on function public.reg_summary_by_fuel(int, text, text, int, int, int, text, text, int, text, int, date, date, text) to authenticated;

do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'reg_summary_by_pabygg'
  loop
    execute 'drop function if exists ' || r.sig::text;
  end loop;
end $$;

create function public.reg_summary_by_pabygg(
  p_year int, p_segment text default null, p_make text default null,
  p_month int default null, p_region int default null, p_hp int default null,
  p_fuel text default null, p_pabygg text default null, p_disp int default null,
  p_chassis text default null, p_bodywork int default null,
  p_from date default null, p_to date default null, p_focus_make text default 'Volvo'
)
returns table(pabygg text, count int, volvo_count int)
language sql stable security invoker as $$
  select pabygg_segment as pabygg, count(*)::int,
         count(*) filter (where make_name = p_focus_make)::int
  from public.registrations
  where transaction_type_id = '10' and maximum_laden_mass_kg >= 16000 and pabygg_segment is not null
    and (p_from is not null or p_to is not null or extract(year from transaction_time) = p_year)
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
    and (
      p_bodywork is null
      or (p_bodywork = -1 and bodywork_code is null)
      or bodywork_code = p_bodywork
    )
  group by pabygg_segment order by count(*) desc;
$$;
grant execute on function public.reg_summary_by_pabygg(int, text, text, int, int, int, text, text, int, text, int, date, date, text) to authenticated;

do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'reg_summary_by_segment'
  loop
    execute 'drop function if exists ' || r.sig::text;
  end loop;
end $$;

create function public.reg_summary_by_segment(
  p_year int, p_segment text default null, p_make text default null,
  p_month int default null, p_region int default null, p_hp int default null,
  p_fuel text default null, p_pabygg text default null, p_disp int default null,
  p_chassis text default null, p_bodywork int default null,
  p_from date default null, p_to date default null, p_focus_make text default 'Volvo'
)
returns table(segment text, count int, volvo_count int)
language sql stable security invoker as $$
  select coalesce(pabygg_segment, 'Annet') as segment, count(*)::int,
         count(*) filter (where make_name = p_focus_make)::int
  from public.registrations
  where transaction_type_id = '10' and maximum_laden_mass_kg >= 16000
    and (p_from is not null or p_to is not null or extract(year from transaction_time) = p_year)
    and (p_from is null or transaction_time >= p_from)
    and (p_to is null or transaction_time < (p_to + 1))
    and (p_make is null or make_name = p_make)
    and (p_month is null or extract(month from transaction_time) = p_month)
    and (p_region is null or sales_region = p_region)
    and (p_hp is null or hp_bucket = p_hp)
    and (p_fuel is null or fuel_name = p_fuel)
    and (p_pabygg is null or pabygg_segment = p_pabygg)
    and (p_disp is null or disp_bucket = p_disp)
    and (p_chassis is null or trekker_jevnlast = p_chassis)
    and (
      p_bodywork is null
      or (p_bodywork = -1 and bodywork_code is null)
      or bodywork_code = p_bodywork
    )
  group by coalesce(pabygg_segment, 'Annet') order by count(*) desc;
$$;
grant execute on function public.reg_summary_by_segment(int, text, text, int, int, int, text, text, int, text, int, date, date, text) to authenticated;

do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'reg_summary_by_disp'
  loop
    execute 'drop function if exists ' || r.sig::text;
  end loop;
end $$;

create function public.reg_summary_by_disp(
  p_year int, p_segment text default null, p_make text default null,
  p_month int default null, p_region int default null, p_hp int default null,
  p_fuel text default null, p_pabygg text default null, p_disp int default null,
  p_chassis text default null, p_bodywork int default null,
  p_from date default null, p_to date default null, p_focus_make text default 'Volvo'
)
returns table(bucket smallint, count int, volvo_count int)
language sql stable security invoker as $$
  select disp_bucket as bucket, count(*)::int,
         count(*) filter (where make_name = p_focus_make)::int
  from public.registrations
  where transaction_type_id = '10' and maximum_laden_mass_kg >= 16000 and disp_bucket is not null
    and (p_from is not null or p_to is not null or extract(year from transaction_time) = p_year)
    and (p_from is null or transaction_time >= p_from)
    and (p_to is null or transaction_time < (p_to + 1))
    and (p_segment is null or usage_name = p_segment)
    and (p_make is null or make_name = p_make)
    and (p_month is null or extract(month from transaction_time) = p_month)
    and (p_region is null or sales_region = p_region)
    and (p_hp is null or hp_bucket = p_hp)
    and (p_fuel is null or fuel_name = p_fuel)
    and (p_pabygg is null or pabygg_segment = p_pabygg)
    and (p_chassis is null or trekker_jevnlast = p_chassis)
    and (
      p_bodywork is null
      or (p_bodywork = -1 and bodywork_code is null)
      or bodywork_code = p_bodywork
    )
  group by disp_bucket order by disp_bucket;
$$;
grant execute on function public.reg_summary_by_disp(int, text, text, int, int, int, text, text, int, text, int, date, date, text) to authenticated;

do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'reg_make_share_by_month'
  loop
    execute 'drop function if exists ' || r.sig::text;
  end loop;
end $$;

create function public.reg_make_share_by_month(
  p_year int, p_segment text default null, p_make text default null,
  p_region int default null, p_hp int default null, p_fuel text default null,
  p_pabygg text default null, p_disp int default null, p_chassis text default null,
  p_bodywork int default null, p_from date default null, p_to date default null,
  p_focus_make text default 'Volvo'
)
returns table(month date, make_name text, count int)
language sql stable security invoker as $$
  select date_trunc('month', transaction_time)::date as month, r.make_name, count(*)::int
  from public.registrations r
  where transaction_type_id = '10' and maximum_laden_mass_kg >= 16000 and r.make_name is not null
    and (p_from is not null or p_to is not null or extract(year from transaction_time) = p_year)
    and (p_from is null or transaction_time >= p_from)
    and (p_to is null or transaction_time < (p_to + 1))
    and (p_segment is null or usage_name = p_segment)
    and (p_make is null or r.make_name = p_make)
    and (p_region is null or sales_region = p_region)
    and (p_hp is null or hp_bucket = p_hp)
    and (p_fuel is null or fuel_name = p_fuel)
    and (p_pabygg is null or pabygg_segment = p_pabygg)
    and (p_disp is null or disp_bucket = p_disp)
    and (p_chassis is null or trekker_jevnlast = p_chassis)
      and (
        p_bodywork is null
        or (p_bodywork = -1 and r.bodywork_code is null)
        or r.bodywork_code = p_bodywork
      )
  group by 1, r.make_name order by 1, count(*) desc;
$$;
grant execute on function public.reg_make_share_by_month(int, text, text, int, int, text, text, int, text, int, date, date, text) to authenticated;

do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'reg_make_share_by_pabygg'
  loop
    execute 'drop function if exists ' || r.sig::text;
  end loop;
end $$;

create function public.reg_make_share_by_pabygg(
  p_year int, p_segment text default null, p_make text default null,
  p_month int default null, p_region int default null, p_hp int default null,
  p_fuel text default null, p_pabygg text default null, p_disp int default null,
  p_chassis text default null, p_bodywork int default null,
  p_from date default null, p_to date default null, p_focus_make text default 'Volvo'
)
returns table(pabygg text, make_name text, count int)
language sql stable security invoker as $$
  select pabygg_segment as pabygg, r.make_name, count(*)::int
  from public.registrations r
  where transaction_type_id = '10' and maximum_laden_mass_kg >= 16000
    and pabygg_segment is not null and r.make_name is not null
    and (p_from is not null or p_to is not null or extract(year from transaction_time) = p_year)
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
      and (
        p_bodywork is null
        or (p_bodywork = -1 and r.bodywork_code is null)
        or r.bodywork_code = p_bodywork
      )
  group by pabygg_segment, r.make_name order by pabygg_segment, count(*) desc;
$$;
grant execute on function public.reg_make_share_by_pabygg(int, text, text, int, int, int, text, text, int, text, int, date, date, text) to authenticated;

do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'reg_electric_share_by_segment_month'
  loop
    execute 'drop function if exists ' || r.sig::text;
  end loop;
end $$;

create function public.reg_electric_share_by_segment_month(
  p_year int, p_segment text default null, p_make text default null,
  p_region int default null, p_hp int default null, p_fuel text default null,
  p_pabygg text default null, p_disp int default null, p_chassis text default null,
  p_bodywork int default null, p_from date default null, p_to date default null,
  p_focus_make text default 'Volvo'
)
returns table(month date, segment text, total_count int, electric_count int)
language sql stable security invoker as $$
  select date_trunc('month', transaction_time)::date as month,
         coalesce(pabygg_segment, 'Annet') as segment,
         count(*)::int as total_count,
         count(*) filter (
           where fuel_name is not null and fuel_name ilike '%elektr%'
         )::int as electric_count
  from public.registrations
  where transaction_type_id = '10' and maximum_laden_mass_kg >= 16000

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
    and (
      p_bodywork is null
      or (p_bodywork = -1 and bodywork_code is null)
      or bodywork_code = p_bodywork
    )
  group by 1, 2 order by 1, 3 desc;
$$;
grant execute on function public.reg_electric_share_by_segment_month(int, text, text, int, int, text, text, int, text, int, date, date, text) to authenticated;

do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'reg_top_buyers'
  loop
    execute 'drop function if exists ' || r.sig::text;
  end loop;
end $$;

create function public.reg_top_buyers(
  p_year int, p_segment text default null, p_make text default null,
  p_month int default null, p_region int default null, p_hp int default null,
  p_fuel text default null, p_pabygg text default null, p_disp int default null,
  p_chassis text default null, p_bodywork int default null,
  p_from date default null, p_to date default null, p_limit int default 15,
  p_focus_make text default 'Volvo'
)
returns table(owner_name text, count int, focus_count int)
language sql stable security invoker as $$
  select max(primary_owner_name) as owner_name, count(*)::int,
         count(*) filter (where make_name = p_focus_make)::int
  from public.registrations
  where transaction_type_id = '10' and maximum_laden_mass_kg >= 16000
    and primary_owner_name is not null

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
    and (p_month is null or extract(month from transaction_time) = p_month)
    and (
      p_bodywork is null
      or (p_bodywork = -1 and bodywork_code is null)
      or bodywork_code = p_bodywork
    )
  group by coalesce(nullif(primary_owner_orgnr, ''), primary_owner_name)
  order by count(*) desc
  limit greatest(p_limit, 1);
$$;
grant execute on function public.reg_top_buyers(int, text, text, int, int, int, text, text, int, text, int, date, date, int, text) to authenticated;

do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'reg_buyer_loyalty'
  loop
    execute 'drop function if exists ' || r.sig::text;
  end loop;
end $$;

create function public.reg_buyer_loyalty(
  p_year int, p_segment text default null, p_make text default null,
  p_month int default null, p_region int default null, p_hp int default null,
  p_fuel text default null, p_pabygg text default null, p_disp int default null,
  p_chassis text default null, p_bodywork int default null,
  p_from date default null, p_to date default null, p_focus_make text default 'Volvo'
)
returns table(buyer_type text, owner_count int, purchase_count int, focus_count int)
language sql stable security invoker as $$
  with bounds as (
    select
      coalesce(p_from, make_date(p_year, 1, 1))::timestamp as period_start,
      coalesce((p_to + 1), make_date(p_year + 1, 1, 1))::timestamp as period_end_exclusive
  ),
  period_regs as (
    select
      coalesce(nullif(r.primary_owner_orgnr, ''), r.primary_owner_name) as owner_key,
      r.make_name
    from public.registrations r
    cross join bounds b
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and r.primary_owner_name is not null
      and r.transaction_time >= b.period_start
      and r.transaction_time < b.period_end_exclusive

      and (p_segment is null or r.usage_name = p_segment)
      and (p_make is null or r.make_name = p_make)
      and (p_month is null or extract(month from r.transaction_time) = p_month)
      and (p_region is null or r.sales_region = p_region)
      and (p_hp is null or r.hp_bucket = p_hp)
      and (p_fuel is null or r.fuel_name = p_fuel)
      and (p_pabygg is null or r.pabygg_segment = p_pabygg)
      and (p_disp is null or r.disp_bucket = p_disp)
      and (p_chassis is null or r.trekker_jevnlast = p_chassis)
      and (
        p_bodywork is null
        or (p_bodywork = -1 and r.bodywork_code is null)
        or r.bodywork_code = p_bodywork
      )

  ),
  prior_owners as (
    select distinct
      coalesce(nullif(r.primary_owner_orgnr, ''), r.primary_owner_name) as owner_key
    from public.registrations r
    cross join bounds b
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and coalesce(nullif(r.primary_owner_orgnr, ''), r.primary_owner_name) is not null
      and r.transaction_time < b.period_start
  ),
  classified as (
    select
      p.owner_key,
      p.make_name,
      case
        when p.owner_key in (select owner_key from prior_owners) then 'repeat'
        else 'new'
      end as buyer_type
    from period_regs p
  )
  select
    buyer_type,
    count(distinct owner_key)::int as owner_count,
    count(*)::int as purchase_count,
    count(*) filter (where make_name = p_focus_make)::int as focus_count
  from classified
  group by buyer_type
  order by buyer_type desc;
$$;
grant execute on function public.reg_buyer_loyalty(int, text, text, int, int, int, text, text, int, text, int, date, date, text) to authenticated;

do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'reg_buyer_loyalty_owners'
  loop
    execute 'drop function if exists ' || r.sig::text;
  end loop;
end $$;

create function public.reg_buyer_loyalty_owners(
  p_year int, p_buyer_type text,
  p_segment text default null, p_make text default null,
  p_month int default null, p_region int default null, p_hp int default null,
  p_fuel text default null, p_pabygg text default null, p_disp int default null,
  p_chassis text default null, p_bodywork int default null,
  p_from date default null, p_to date default null, p_limit int default 100,
  p_focus_make text default 'Volvo'
)
returns table(owner_name text, count int, focus_count int)
language sql stable security invoker as $$
  with bounds as (
    select
      coalesce(p_from, make_date(p_year, 1, 1))::timestamp as period_start,
      coalesce((p_to + 1), make_date(p_year + 1, 1, 1))::timestamp as period_end_exclusive
  ),
  period_regs as (
    select
      coalesce(nullif(r.primary_owner_orgnr, ''), r.primary_owner_name) as owner_key,
      r.primary_owner_name,
      r.make_name
    from public.registrations r
    cross join bounds b
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and r.primary_owner_name is not null
      and r.transaction_time >= b.period_start
      and r.transaction_time < b.period_end_exclusive

      and (p_segment is null or r.usage_name = p_segment)
      and (p_make is null or r.make_name = p_make)
      and (p_month is null or extract(month from r.transaction_time) = p_month)
      and (p_region is null or r.sales_region = p_region)
      and (p_hp is null or r.hp_bucket = p_hp)
      and (p_fuel is null or r.fuel_name = p_fuel)
      and (p_pabygg is null or r.pabygg_segment = p_pabygg)
      and (p_disp is null or r.disp_bucket = p_disp)
      and (p_chassis is null or r.trekker_jevnlast = p_chassis)
      and (
        p_bodywork is null
        or (p_bodywork = -1 and r.bodywork_code is null)
        or r.bodywork_code = p_bodywork
      )

  ),
  prior_owners as (
    select distinct
      coalesce(nullif(r.primary_owner_orgnr, ''), r.primary_owner_name) as owner_key
    from public.registrations r
    cross join bounds b
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and coalesce(nullif(r.primary_owner_orgnr, ''), r.primary_owner_name) is not null
      and r.transaction_time < b.period_start
  ),
  owner_totals as (
    select
      p.owner_key,
      max(p.primary_owner_name) as owner_name,
      count(*)::int as purchase_count,
      count(*) filter (where p.make_name = p_focus_make)::int as focus_count,
      case
        when p.owner_key in (select owner_key from prior_owners) then 'repeat'
        else 'new'
      end as buyer_type
    from period_regs p
    group by p.owner_key
  )
  select owner_name, purchase_count, focus_count
  from owner_totals
  where buyer_type = p_buyer_type
  order by purchase_count desc, owner_name
  limit greatest(p_limit, 1);
$$;
grant execute on function public.reg_buyer_loyalty_owners(int, text, text, text, int, int, int, text, text, int, text, int, date, date, int, text) to authenticated;

do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'pop_summary_by_segment'
  loop
    execute 'drop function if exists ' || r.sig::text;
  end loop;
end $$;

create function public.pop_summary_by_segment(
  p_segment text default null, p_make text default null,
  p_region int default null, p_district text default null,
  p_hp int default null, p_fuel text default null, p_pabygg text default null,
  p_disp int default null, p_chassis text default null, p_age text default null,
  p_bodywork int default null, p_focus_make text default 'Volvo'
)
returns table(segment text, count int, volvo_count int)
language sql stable security invoker as $$
  select
    coalesce(pabygg_segment, 'Annet') as segment,
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
    and (
      p_bodywork is null
      or (p_bodywork = -1 and bodywork_code is null)
      or bodywork_code = p_bodywork
    )
  group by coalesce(pabygg_segment, 'Annet')
  order by count(*) desc;
$$;
grant execute on function public.pop_summary_by_segment(text, text, int, text, int, text, text, int, text, text, int, text) to authenticated;

do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'pop_summary_by_make'
  loop
    execute 'drop function if exists ' || r.sig::text;
  end loop;
end $$;

create function public.pop_summary_by_make(
  p_segment text default null, p_make text default null,
  p_region int default null, p_district text default null,
  p_hp int default null, p_fuel text default null, p_pabygg text default null,
  p_disp int default null, p_chassis text default null, p_age text default null,
  p_bodywork int default null
)
returns table(make_name text, count int)
language sql stable security invoker as $$
  select make_name, count(*)::int
  from public.population
  where snapshot_date = (select max(snapshot_date) from public.population)
    and maximum_laden_mass_kg >= 16000
    and make_name is not null
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
    and (
      p_bodywork is null
      or (p_bodywork = -1 and bodywork_code is null)
      or bodywork_code = p_bodywork
    )
  group by make_name order by count(*) desc;
$$;
grant execute on function public.pop_summary_by_make(text, text, int, text, int, text, text, int, text, text, int) to authenticated;

do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'pop_summary_by_region'
  loop
    execute 'drop function if exists ' || r.sig::text;
  end loop;
end $$;

create function public.pop_summary_by_region(
  p_segment text default null, p_make text default null,
  p_region int default null, p_district text default null,
  p_hp int default null, p_fuel text default null, p_pabygg text default null,
  p_disp int default null, p_chassis text default null, p_age text default null,
  p_bodywork int default null, p_focus_make text default 'Volvo'
)
returns table(region smallint, count int, volvo_count int)
language sql stable security invoker as $$
  select sales_region as region, count(*)::int,
         count(*) filter (where make_name = p_focus_make)::int
  from public.population
  where snapshot_date = (select max(snapshot_date) from public.population)
    and maximum_laden_mass_kg >= 16000
    and sales_region is not null
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
    and (
      p_bodywork is null
      or (p_bodywork = -1 and bodywork_code is null)
      or bodywork_code = p_bodywork
    )
  group by sales_region order by sales_region;
$$;
grant execute on function public.pop_summary_by_region(text, text, int, text, int, text, text, int, text, text, int, text) to authenticated;

do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'pop_summary_by_fuel'
  loop
    execute 'drop function if exists ' || r.sig::text;
  end loop;
end $$;

create function public.pop_summary_by_fuel(
  p_segment text default null, p_make text default null,
  p_region int default null, p_district text default null,
  p_hp int default null, p_fuel text default null, p_pabygg text default null,
  p_disp int default null, p_chassis text default null, p_age text default null,
  p_bodywork int default null, p_focus_make text default 'Volvo'
)
returns table(fuel text, count int, volvo_count int)
language sql stable security invoker as $$
  select fuel_name as fuel, count(*)::int,
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
    and (
      p_bodywork is null
      or (p_bodywork = -1 and bodywork_code is null)
      or bodywork_code = p_bodywork
    )
  group by fuel_name order by count(*) desc;
$$;
grant execute on function public.pop_summary_by_fuel(text, text, int, text, int, text, text, int, text, text, int, text) to authenticated;

