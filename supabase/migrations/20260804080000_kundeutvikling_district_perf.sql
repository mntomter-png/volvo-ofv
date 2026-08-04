-- Kundeutvikling: lagret sales_district på registrations (unngå ofv_district_from_postal
-- per rad i 10-års lookback). Authenticated statement_timeout er 8s; list RPC tok ~9s.

alter table public.registrations
  add column if not exists sales_district text
  generated always as (public.ofv_district_from_postal(primary_user_postal_code)) stored;

comment on column public.registrations.sales_district is
  'Volvo-distrikt utledet fra brukerens postnummer (ofv_district_from_postal).';

create index if not exists registrations_heavy_district_idx
  on public.registrations (sales_district, transaction_time desc)
  where transaction_type_id = '10' and maximum_laden_mass_kg >= 16000;

create index if not exists registrations_heavy_time_idx
  on public.registrations (transaction_time desc)
  where transaction_type_id = '10' and maximum_laden_mass_kg >= 16000;

do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in (
        'reg_owner_focus_decline_summary',
        'reg_owner_focus_decline_list'
      )
  loop
    execute 'drop function if exists ' || r.sig::text;
  end loop;
end $$;

create function public.reg_owner_focus_decline_summary(
  p_year int,
  p_segment text default null,
  p_region int default null,
  p_district text default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_disp int default null,
  p_chassis text default null,
  p_bodywork int default null,
  p_from date default null,
  p_to date default null,
  p_exclude_finance boolean default true,
  p_focus_make text default 'Volvo'
)
returns table(
  customers_10y int,
  competitor_only_owners int,
  mixed_owners int,
  due_owners int,
  overdue_owners int
)
language sql
stable
security invoker
as $$
  with periods as (
    select
      coalesce(p_from, make_date(p_year, 1, 1))::timestamp as cur_start,
      (coalesce(
        p_to,
        case
          when p_year = extract(year from current_date)::int then current_date
          else make_date(p_year, 12, 31)
        end
      ) + 1)::timestamp as cur_end_excl,
      (coalesce(
        p_to,
        case
          when p_year = extract(year from current_date)::int then current_date
          else make_date(p_year, 12, 31)
        end
      ) - interval '10 years')::date::timestamp as lookback_start,
      coalesce(
        p_to,
        case
          when p_year = extract(year from current_date)::int then current_date
          else make_date(p_year, 12, 31)
        end
      ) as cur_end_date
  ),
  scoped as (
    select
      coalesce(nullif(r.primary_owner_orgnr, ''), r.primary_owner_name) as owner_key,
      r.primary_owner_name,
      r.make_name,
      r.transaction_time,
      p.cur_start,
      p.cur_end_excl,
      p.cur_end_date
    from public.registrations r
    cross join periods p
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and r.primary_owner_name is not null
      and r.transaction_time >= p.lookback_start
      and r.transaction_time < p.cur_end_excl
      and (p_segment is null or r.usage_name = p_segment)
      and (p_region is null or r.sales_region = p_region)
      and (p_district is null or r.sales_district = p_district)
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
  by_owner as (
    select
      s.owner_key,
      max(s.primary_owner_name) as owner_name,
      max(s.cur_end_date) as cur_end_date,
      count(*) filter (where s.make_name = p_focus_make)::int as focus_10y,
      count(*) filter (
        where s.make_name = p_focus_make
          and s.transaction_time >= s.cur_start
          and s.transaction_time < s.cur_end_excl
      )::int as current_focus,
      count(*) filter (
        where s.transaction_time >= s.cur_start
          and s.transaction_time < s.cur_end_excl
      )::int as current_total,
      (max(s.transaction_time) filter (where s.make_name = p_focus_make))::date
        as last_focus_date
    from scoped s
    group by s.owner_key
  ),
  customers as (
    select
      *,
      greatest(current_total - current_focus, 0)::int as competitor_units,
      (cur_end_date - last_focus_date) as days_since_last
    from by_owner
    where focus_10y >= 2
      and (
        not p_exclude_finance
        or not public.ofv_is_excluded_fleet_owner(owner_name)
      )
  )
  select
    (select count(*)::int from customers) as customers_10y,
    (
      select count(*)::int
      from customers
      where competitor_units > 0 and current_focus = 0
    ) as competitor_only_owners,
    (
      select count(*)::int
      from customers
      where competitor_units > 0 and current_focus > 0
    ) as mixed_owners,
    (
      select count(*)::int
      from customers
      where competitor_units = 0
        and days_since_last >= 1095
        and days_since_last < 1825
    ) as due_owners,
    (
      select count(*)::int
      from customers
      where competitor_units = 0
        and days_since_last >= 1825
    ) as overdue_owners;
$$;

grant execute on function public.reg_owner_focus_decline_summary(
  int, text, int, text, int, text, text, int, text, int, date, date, boolean, text
) to authenticated;

create function public.reg_owner_focus_decline_list(
  p_year int,
  p_segment text default null,
  p_region int default null,
  p_district text default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_disp int default null,
  p_chassis text default null,
  p_bodywork int default null,
  p_from date default null,
  p_to date default null,
  p_limit int default 25,
  p_exclude_finance boolean default true,
  p_bucket text default 'priority',
  p_focus_make text default 'Volvo'
)
returns table(
  owner_key text,
  owner_name text,
  region smallint,
  district text,
  focus_10y int,
  fleet_focus int,
  fleet_total int,
  current_focus int,
  current_total int,
  competitor_units int,
  last_focus_date date,
  years_since_last numeric,
  status text,
  priority_score int,
  size_score int,
  signal_score int,
  recency_score int
)
language sql
stable
security invoker
as $$
  with periods as (
    select
      coalesce(p_from, make_date(p_year, 1, 1))::timestamp as cur_start,
      (coalesce(
        p_to,
        case
          when p_year = extract(year from current_date)::int then current_date
          else make_date(p_year, 12, 31)
        end
      ) + 1)::timestamp as cur_end_excl,
      (coalesce(
        p_to,
        case
          when p_year = extract(year from current_date)::int then current_date
          else make_date(p_year, 12, 31)
        end
      ) - interval '10 years')::date::timestamp as lookback_start,
      coalesce(
        p_to,
        case
          when p_year = extract(year from current_date)::int then current_date
          else make_date(p_year, 12, 31)
        end
      ) as cur_end_date
  ),
  scoped as (
    select
      coalesce(nullif(r.primary_owner_orgnr, ''), r.primary_owner_name) as owner_key,
      r.primary_owner_name,
      r.sales_region,
      r.sales_district as district,
      r.make_name,
      r.transaction_time,
      p.cur_start,
      p.cur_end_excl,
      p.cur_end_date
    from public.registrations r
    cross join periods p
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and r.primary_owner_name is not null
      and r.transaction_time >= p.lookback_start
      and r.transaction_time < p.cur_end_excl
      and (p_segment is null or r.usage_name = p_segment)
      and (p_region is null or r.sales_region = p_region)
      and (p_district is null or r.sales_district = p_district)
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
  by_owner as (
    select
      s.owner_key,
      max(s.primary_owner_name) as owner_name,
      max(s.cur_end_date) as cur_end_date,
      max(s.sales_region) filter (
        where s.transaction_time >= s.cur_start
          and s.transaction_time < s.cur_end_excl
      ) as region_period,
      max(s.sales_region) as region_any,
      max(s.district) filter (
        where s.transaction_time >= s.cur_start
          and s.transaction_time < s.cur_end_excl
          and s.district is not null
      ) as district_period,
      max(s.district) filter (where s.district is not null) as district_any,
      count(*) filter (where s.make_name = p_focus_make)::int as focus_10y,
      count(*) filter (
        where s.make_name = p_focus_make
          and s.transaction_time >= s.cur_start
          and s.transaction_time < s.cur_end_excl
      )::int as current_focus,
      count(*) filter (
        where s.transaction_time >= s.cur_start
          and s.transaction_time < s.cur_end_excl
      )::int as current_total,
      (max(s.transaction_time) filter (where s.make_name = p_focus_make))::date
        as last_focus_date
    from scoped s
    group by s.owner_key
  ),
  fleet as (
    select
      coalesce(nullif(p.primary_owner_orgnr, ''), p.primary_owner_name) as owner_key,
      count(*) filter (where p.make_name = p_focus_make)::int as fleet_focus,
      count(*)::int as fleet_total
    from public.population p
    where p.snapshot_date = (select max(snapshot_date) from public.population)
      and p.maximum_laden_mass_kg >= 16000
      and p.primary_owner_name is not null
      and (p_region is null or p.sales_region = p_region)
      and (p_district is null or p.sales_district = p_district)
    group by 1
  ),
  scored as (
    select
      b.owner_key,
      b.owner_name,
      coalesce(b.region_period, b.region_any) as region,
      coalesce(b.district_period, b.district_any) as district,
      b.focus_10y,
      coalesce(f.fleet_focus, 0)::int as fleet_focus,
      coalesce(f.fleet_total, 0)::int as fleet_total,
      b.current_focus,
      b.current_total,
      greatest(b.current_total - b.current_focus, 0)::int as competitor_units,
      b.last_focus_date,
      round((b.cur_end_date - b.last_focus_date)::numeric / 365.25, 1) as years_since_last,
      case
        when b.current_total > b.current_focus and b.current_focus = 0
          then 'competitor'
        when b.current_total > b.current_focus and b.current_focus > 0
          then 'mixed'
        when (b.cur_end_date - b.last_focus_date) >= 1825 then 'overdue'
        when (b.cur_end_date - b.last_focus_date) >= 1095 then 'due'
        else 'ok'
      end as status,
      least(25, coalesce(f.fleet_focus, 0) * 2)::int as size_score,
      case
        when b.current_total > b.current_focus and b.current_focus = 0
          then least(50, 35 + (b.current_total - b.current_focus) * 3)
        when b.current_total > b.current_focus and b.current_focus > 0
          then least(35, 15 + (b.current_total - b.current_focus) * 3)
        when (b.cur_end_date - b.last_focus_date) >= 1825 then 40
        when (b.cur_end_date - b.last_focus_date) >= 1095 then 25
        else 0
      end::int as signal_score,
      least(
        25,
        greatest(
          0,
          round(
            ((b.cur_end_date - b.last_focus_date)::numeric / 365.25 - 2) * 8
          )
        )
      )::int as recency_score
    from by_owner b
    left join fleet f on f.owner_key = b.owner_key
    where b.focus_10y >= 2
      and (
        not p_exclude_finance
        or not public.ofv_is_excluded_fleet_owner(b.owner_name)
      )
  ),
  filtered as (
    select *
    from scored
    where case coalesce(nullif(p_bucket, ''), 'priority')
      when 'customers' then true
      when 'competitor' then status in ('competitor', 'mixed')
      when 'due' then status = 'due'
      when 'overdue' then status = 'overdue'
      else status in ('competitor', 'mixed', 'due', 'overdue')
    end
  )
  select
    owner_key,
    owner_name,
    region::smallint,
    district,
    focus_10y,
    fleet_focus,
    fleet_total,
    current_focus,
    current_total,
    competitor_units,
    last_focus_date,
    years_since_last,
    status,
    (size_score + signal_score + recency_score)::int as priority_score,
    size_score,
    signal_score,
    recency_score
  from filtered
  order by
    case coalesce(nullif(p_bucket, ''), 'priority')
      when 'customers' then fleet_focus
      else null
    end desc nulls last,
    case status
      when 'competitor' then 1
      when 'mixed' then 2
      when 'overdue' then 3
      when 'due' then 4
      else 5
    end,
    (size_score + signal_score + recency_score) desc,
    competitor_units desc,
    years_since_last desc,
    fleet_focus desc,
    owner_name
  limit greatest(p_limit, 1);
$$;

grant execute on function public.reg_owner_focus_decline_list(
  int, text, int, text, int, text, text, int, text, int, date, date, int, boolean, text, text
) to authenticated;

notify pgrst, 'reload schema';
