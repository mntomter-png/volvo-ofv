-- Kontoer i risiko: filter for finans/leasing via ofv_is_excluded_fleet_owner (samme som PKK).
-- Default: skjul finans (p_exclude_finance = true).

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
  declining_owners int,
  lost_units int,
  prior_focus_owners int
)
language sql
stable
security invoker
as $$
  with bounds as (
    select
      coalesce(p_from, make_date(p_year, 1, 1)) as cur_start,
      coalesce(p_to, case
        when p_year = extract(year from current_date)::int then current_date
        else make_date(p_year, 12, 31)
      end) as cur_end
  ),
  periods as (
    select
      cur_start::timestamp as cur_start,
      (cur_end + 1)::timestamp as cur_end_excl,
      (cur_start - interval '1 year')::date::timestamp as prior_start,
      ((cur_end - interval '1 year')::date + 1)::timestamp as prior_end_excl
    from bounds
  ),
  scoped as (
    select
      coalesce(nullif(r.primary_owner_orgnr, ''), r.primary_owner_name) as owner_key,
      r.primary_owner_name,
      r.make_name,
      r.transaction_time
    from public.registrations r
    cross join periods p
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and r.primary_owner_name is not null
      and r.transaction_time >= p.prior_start
      and r.transaction_time < p.cur_end_excl
      and (p_segment is null or r.usage_name = p_segment)
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
  by_owner as (
    select
      s.owner_key,
      max(s.primary_owner_name) as owner_name,
      count(*) filter (
        where s.make_name = p_focus_make
          and s.transaction_time >= (select cur_start from periods)
          and s.transaction_time < (select cur_end_excl from periods)
      )::int as current_focus,
      count(*) filter (
        where s.make_name = p_focus_make
          and s.transaction_time >= (select prior_start from periods)
          and s.transaction_time < (select prior_end_excl from periods)
      )::int as prior_focus
    from scoped s
    group by s.owner_key
  ),
  filtered as (
    select *
    from by_owner
    where not p_exclude_finance
       or not public.ofv_is_excluded_fleet_owner(owner_name)
  )
  select
    count(*) filter (where prior_focus > 0 and current_focus < prior_focus)::int
      as declining_owners,
    coalesce(
      sum(prior_focus - current_focus)
        filter (where prior_focus > 0 and current_focus < prior_focus),
      0
    )::int as lost_units,
    count(*) filter (where prior_focus > 0)::int as prior_focus_owners
  from filtered;
$$;

grant execute on function public.reg_owner_focus_decline_summary(
  int, text, int, int, text, text, int, text, int, date, date, boolean, text
) to authenticated;

create function public.reg_owner_focus_decline_list(
  p_year int,
  p_segment text default null,
  p_region int default null,
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
  p_focus_make text default 'Volvo'
)
returns table(
  owner_key text,
  owner_name text,
  region smallint,
  current_focus int,
  prior_focus int,
  delta int,
  last_focus_date date,
  current_total int,
  prior_total int
)
language sql
stable
security invoker
as $$
  with bounds as (
    select
      coalesce(p_from, make_date(p_year, 1, 1)) as cur_start,
      coalesce(p_to, case
        when p_year = extract(year from current_date)::int then current_date
        else make_date(p_year, 12, 31)
      end) as cur_end
  ),
  periods as (
    select
      cur_start::timestamp as cur_start,
      (cur_end + 1)::timestamp as cur_end_excl,
      (cur_start - interval '1 year')::date::timestamp as prior_start,
      ((cur_end - interval '1 year')::date + 1)::timestamp as prior_end_excl
    from bounds
  ),
  scoped as (
    select
      coalesce(nullif(r.primary_owner_orgnr, ''), r.primary_owner_name) as owner_key,
      r.primary_owner_name,
      r.sales_region,
      r.make_name,
      r.transaction_time
    from public.registrations r
    cross join periods p
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and r.primary_owner_name is not null
      and r.transaction_time >= p.prior_start
      and r.transaction_time < p.cur_end_excl
      and (p_segment is null or r.usage_name = p_segment)
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
  by_owner as (
    select
      s.owner_key,
      max(s.primary_owner_name) as owner_name,
      max(s.sales_region) filter (
        where s.transaction_time >= (select cur_start from periods)
          and s.transaction_time < (select cur_end_excl from periods)
      ) as region,
      count(*) filter (
        where s.make_name = p_focus_make
          and s.transaction_time >= (select cur_start from periods)
          and s.transaction_time < (select cur_end_excl from periods)
      )::int as current_focus,
      count(*) filter (
        where s.make_name = p_focus_make
          and s.transaction_time >= (select prior_start from periods)
          and s.transaction_time < (select prior_end_excl from periods)
      )::int as prior_focus,
      count(*) filter (
        where s.transaction_time >= (select cur_start from periods)
          and s.transaction_time < (select cur_end_excl from periods)
      )::int as current_total,
      count(*) filter (
        where s.transaction_time >= (select prior_start from periods)
          and s.transaction_time < (select prior_end_excl from periods)
      )::int as prior_total,
      (max(s.transaction_time) filter (where s.make_name = p_focus_make))::date
        as last_focus_date
    from scoped s
    group by s.owner_key
  )
  select
    owner_key,
    owner_name,
    region::smallint,
    current_focus,
    prior_focus,
    (current_focus - prior_focus)::int as delta,
    last_focus_date,
    current_total,
    prior_total
  from by_owner
  where prior_focus > 0
    and current_focus < prior_focus
    and (
      not p_exclude_finance
      or not public.ofv_is_excluded_fleet_owner(owner_name)
    )
  order by (prior_focus - current_focus) desc, prior_focus desc, owner_name
  limit greatest(p_limit, 1);
$$;

grant execute on function public.reg_owner_focus_decline_list(
  int, text, int, int, text, text, int, text, int, date, date, int, boolean, text
) to authenticated;

notify pgrst, 'reload schema';
