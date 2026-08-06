-- Potensial: unngå statement_timeout (authenticated = 8s + RLS).
-- - SECURITY DEFINER + jwt_can_read_* (RLS på 10-års lookback var ~20s)
-- - Fjern dyre mode()-aggregater
-- - Én lookback-pass med having på sterke bodyworks
-- - Begrens population-join til aktuelle kontoer
-- - Lokal statement_timeout 25s som sikkerhetsnett

create or replace function public.reg_potential_profile(
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
  p_focus_make text default 'Volvo',
  p_min_share numeric default 0.30,
  p_min_volume int default 20
)
returns table(
  bodywork_code int,
  bodywork_name text,
  total int,
  focus_count int,
  focus_share numeric,
  emob_count int,
  emob_share numeric,
  fit_hp_bucket int,
  fit_hp_focus_share numeric,
  fit_hp_total int
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.jwt_can_read_registrations() then
    raise exception 'Ikke tilgang til registreringer' using errcode = '42501';
  end if;

  perform set_config('statement_timeout', '25s', true);

  return query
  with periods as (
    select
      coalesce(p_from, make_date(p_year, 1, 1))::timestamp as cur_start,
      (coalesce(
        p_to,
        case
          when p_year = extract(year from current_date)::int then current_date
          else make_date(p_year, 12, 31)
        end
      ) + 1)::timestamp as cur_end_excl
  ),
  ytd as (
    select
      coalesce(r.bodywork_code, -1) as bodywork_code,
      coalesce(
        nullif(r.bodywork_name, ''),
        case when r.bodywork_code is null then 'Uten påbygg' else 'Kode ' || r.bodywork_code::text end
      ) as bodywork_name,
      r.make_name,
      r.hp_bucket,
      r.fuel_name
    from public.registrations r
    cross join periods p
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and r.transaction_time >= p.cur_start
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
  by_bw as (
    select
      y.bodywork_code,
      max(y.bodywork_name) as bodywork_name,
      count(*)::int as total,
      count(*) filter (where y.make_name = p_focus_make)::int as focus_count,
      count(*) filter (where y.fuel_name ilike '%elektr%')::int as emob_count
    from ytd y
    group by y.bodywork_code
  ),
  strong as (
    select
      b.bodywork_code,
      b.bodywork_name,
      b.total,
      b.focus_count,
      case when b.total > 0 then b.focus_count::numeric / b.total else 0 end as focus_share,
      b.emob_count,
      case when b.total > 0 then b.emob_count::numeric / b.total else 0 end as emob_share
    from by_bw b
    where b.total >= greatest(p_min_volume, 1)
      and case when b.total > 0 then b.focus_count::numeric / b.total else 0 end >= p_min_share
  ),
  hp_by_bw as (
    select
      y.bodywork_code,
      y.hp_bucket,
      count(*)::int as total,
      count(*) filter (where y.make_name = p_focus_make)::int as focus_count
    from ytd y
    inner join strong s on s.bodywork_code = y.bodywork_code
    where y.hp_bucket is not null
    group by y.bodywork_code, y.hp_bucket
  ),
  hp_ranked as (
    select
      h.bodywork_code,
      h.hp_bucket,
      h.total,
      h.focus_count,
      case when h.total > 0 then h.focus_count::numeric / h.total else 0 end as focus_share,
      row_number() over (
        partition by h.bodywork_code
        order by
          case when h.total > 0 then h.focus_count::numeric / h.total else 0 end desc,
          h.focus_count desc,
          h.total desc,
          h.hp_bucket
      ) as rn
    from hp_by_bw h
    where h.total >= 5
  )
  select
    s.bodywork_code::int,
    s.bodywork_name,
    s.total,
    s.focus_count,
    round(s.focus_share, 4),
    s.emob_count,
    round(s.emob_share, 4),
    h.hp_bucket::int,
    round(coalesce(h.focus_share, 0), 4),
    coalesce(h.total, 0)::int
  from strong s
  left join hp_ranked h on h.bodywork_code = s.bodywork_code and h.rn = 1
  order by s.focus_share desc, s.total desc, s.bodywork_code;
end;
$$;

grant execute on function public.reg_potential_profile(
  int, text, int, text, int, text, text, int, text, int, date, date, text, numeric, int
) to authenticated;

create or replace function public.reg_potential_list(
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
  p_limit int default 200,
  p_exclude_finance boolean default true,
  p_customer_party text default 'user',
  p_focus_make text default 'Volvo',
  p_min_share numeric default 0.30,
  p_min_volume int default 20
)
returns table(
  party_key text,
  party_name text,
  region smallint,
  district text,
  status text,
  potential_score int,
  fit_score int,
  timing_score int,
  size_score int,
  focus_10y int,
  fleet_focus int,
  fleet_total int,
  current_focus int,
  current_total int,
  competitor_units int,
  last_focus_date date,
  years_since_last numeric,
  recommended_bodywork int,
  recommended_bodywork_name text,
  recommended_hp_bucket int,
  recommended_driveline text,
  bodywork_focus_share numeric,
  party_emob_share numeric,
  strong_bodywork_units int
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_can_read_population boolean;
begin
  if not public.jwt_can_read_registrations() then
    raise exception 'Ikke tilgang til potensialdata' using errcode = '42501';
  end if;

  v_can_read_population := public.jwt_can_read_population();

  -- Authenticated role default er 8s; denne RPC trenger mer headroom under last.
  perform set_config('statement_timeout', '25s', true);

  return query
  with periods as materialized (
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
  ytd as materialized (
    select
      coalesce(r.bodywork_code, -1) as bodywork_code,
      coalesce(
        nullif(r.bodywork_name, ''),
        case when r.bodywork_code is null then 'Uten påbygg' else 'Kode ' || r.bodywork_code::text end
      ) as bodywork_name,
      r.make_name,
      r.hp_bucket,
      r.fuel_name
    from public.registrations r
    cross join periods p
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and r.transaction_time >= p.cur_start
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
  by_bw as (
    select
      y.bodywork_code,
      max(y.bodywork_name) as bodywork_name,
      count(*)::int as total,
      count(*) filter (where y.make_name = p_focus_make)::int as focus_count,
      count(*) filter (where y.fuel_name ilike '%elektr%')::int as emob_count
    from ytd y
    group by y.bodywork_code
  ),
  strong as (
    select
      b.bodywork_code,
      b.bodywork_name,
      case when b.total > 0 then b.focus_count::numeric / b.total else 0 end as focus_share,
      case when b.total > 0 then b.emob_count::numeric / b.total else 0 end as emob_share
    from by_bw b
    where b.total >= greatest(p_min_volume, 1)
      and case when b.total > 0 then b.focus_count::numeric / b.total else 0 end >= p_min_share
  ),
  hp_by_bw as (
    select
      y.bodywork_code,
      y.hp_bucket,
      count(*)::int as total,
      count(*) filter (where y.make_name = p_focus_make)::int as focus_count
    from ytd y
    inner join strong s on s.bodywork_code = y.bodywork_code
    where y.hp_bucket is not null
    group by y.bodywork_code, y.hp_bucket
  ),
  hp_fit as (
    select
      h.bodywork_code,
      h.hp_bucket,
      row_number() over (
        partition by h.bodywork_code
        order by
          case when h.total > 0 then h.focus_count::numeric / h.total else 0 end desc,
          h.focus_count desc,
          h.total desc,
          h.hp_bucket
      ) as rn
    from hp_by_bw h
    where h.total >= 5
  ),
  strong_profile as materialized (
    select
      s.bodywork_code,
      s.bodywork_name,
      s.focus_share,
      s.emob_share,
      h.hp_bucket as fit_hp_bucket,
      case
        when s.emob_share >= 0.25 then 'EMOB'
        else 'ICE'
      end as recommended_driveline
    from strong s
    left join hp_fit h on h.bodywork_code = s.bodywork_code and h.rn = 1
  ),
  scoped as materialized (
    select
      case
        when coalesce(p_customer_party, 'user') = 'owner' then
          coalesce(nullif(r.primary_owner_orgnr, ''), r.primary_owner_name)
        else
          coalesce(nullif(r.primary_user_orgnr, ''), r.primary_user_name)
      end as party_key,
      case
        when coalesce(p_customer_party, 'user') = 'owner' then r.primary_owner_name
        else r.primary_user_name
      end as party_name,
      r.sales_region,
      r.sales_district as district,
      r.make_name,
      coalesce(r.bodywork_code, -1) as bodywork_code,
      r.hp_bucket,
      r.fuel_name,
      r.transaction_time,
      p.cur_start,
      p.cur_end_excl,
      p.cur_end_date,
      (sp.bodywork_code is not null) as is_strong
    from public.registrations r
    cross join periods p
    left join strong_profile sp on sp.bodywork_code = coalesce(r.bodywork_code, -1)
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and (
        case
          when coalesce(p_customer_party, 'user') = 'owner' then r.primary_owner_name
          else r.primary_user_name
        end
      ) is not null
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
  by_party as materialized (
    select
      s.party_key,
      max(s.party_name) as party_name,
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
        as last_focus_date,
      count(*) filter (where s.is_strong)::int as strong_bodywork_units,
      count(*) filter (where s.fuel_name ilike '%elektr%')::int as emob_units,
      count(*)::int as lookback_units
    from scoped s
    group by s.party_key
    having count(*) filter (where s.is_strong) > 0
  ),
  -- Anbefalt bodywork = sterkeste bodywork for kontoen (flest enheter), uten mode().
  party_bw as (
    select
      s.party_key,
      s.bodywork_code,
      count(*)::int as n,
      row_number() over (
        partition by s.party_key
        order by count(*) desc, s.bodywork_code
      ) as rn
    from scoped s
    where s.is_strong
    group by s.party_key, s.bodywork_code
  ),
  party_hp as (
    select
      s.party_key,
      s.hp_bucket,
      count(*)::int as n,
      row_number() over (
        partition by s.party_key
        order by count(*) desc, s.hp_bucket
      ) as rn
    from scoped s
    where s.hp_bucket is not null
    group by s.party_key, s.hp_bucket
  ),
  party_rec as materialized (
    select
      b.party_key,
      b.bodywork_code as recommended_bodywork,
      sp.bodywork_name as recommended_bodywork_name,
      sp.focus_share as bodywork_focus_share,
      sp.fit_hp_bucket as recommended_hp_bucket,
      sp.recommended_driveline,
      h.hp_bucket as modal_hp
    from party_bw b
    inner join strong_profile sp on sp.bodywork_code = b.bodywork_code
    left join party_hp h on h.party_key = b.party_key and h.rn = 1
    where b.rn = 1
  ),
  fleet as materialized (
    select
      case
        when coalesce(p_customer_party, 'user') = 'owner' then
          coalesce(nullif(p.primary_owner_orgnr, ''), p.primary_owner_name)
        else
          coalesce(nullif(p.primary_user_orgnr, ''), p.primary_user_name)
      end as party_key,
      count(*) filter (where p.make_name = p_focus_make)::int as fleet_focus,
      count(*)::int as fleet_total
    from public.population p
    inner join by_party b on b.party_key = case
      when coalesce(p_customer_party, 'user') = 'owner' then
        coalesce(nullif(p.primary_owner_orgnr, ''), p.primary_owner_name)
      else
        coalesce(nullif(p.primary_user_orgnr, ''), p.primary_user_name)
    end
    where v_can_read_population
      and p.snapshot_date = (select max(snapshot_date) from public.population)
      and p.maximum_laden_mass_kg >= 16000
      and (
        case
          when coalesce(p_customer_party, 'user') = 'owner' then p.primary_owner_name
          else p.primary_user_name
        end
      ) is not null
      and (p_region is null or p.sales_region = p_region)
      and (p_district is null or p.sales_district = p_district)
    group by 1
  ),
  scored as (
    select
      b.party_key,
      b.party_name,
      coalesce(b.region_period, b.region_any) as region,
      coalesce(b.district_period, b.district_any) as district,
      b.focus_10y,
      coalesce(f.fleet_focus, 0)::int as fleet_focus,
      coalesce(f.fleet_total, 0)::int as fleet_total,
      b.current_focus,
      b.current_total,
      greatest(b.current_total - b.current_focus, 0)::int as competitor_units,
      b.last_focus_date,
      case
        when b.last_focus_date is null then null
        else round((b.cur_end_date - b.last_focus_date)::numeric / 365.25, 1)
      end as years_since_last,
      case
        when b.focus_10y = 0 and b.current_total >= 1 then 'untapped'
        when b.current_total > b.current_focus and b.current_focus = 0 then 'competitor'
        when b.current_total > b.current_focus and b.current_focus > 0 then 'mixed'
        when b.last_focus_date is not null
          and (b.cur_end_date - b.last_focus_date) >= 1825 then 'overdue'
        when b.last_focus_date is not null
          and (b.cur_end_date - b.last_focus_date) >= 1095 then 'due'
        else 'ok'
      end as status,
      b.strong_bodywork_units,
      case
        when b.lookback_units > 0 then b.emob_units::numeric / b.lookback_units
        else 0
      end as party_emob_share,
      pr.recommended_bodywork,
      pr.recommended_bodywork_name,
      pr.recommended_hp_bucket,
      pr.recommended_driveline,
      pr.bodywork_focus_share,
      (
        case when pr.recommended_bodywork is not null then 15 else 0 end
        + case
            when pr.recommended_hp_bucket is not null
              and pr.modal_hp = pr.recommended_hp_bucket then 15
            when pr.recommended_hp_bucket is not null and pr.modal_hp is not null then 5
            else 0
          end
        + case
            when pr.recommended_driveline = 'EMOB'
              and b.lookback_units > 0
              and (b.emob_units::numeric / b.lookback_units) >= 0.15 then 10
            when pr.recommended_driveline = 'ICE'
              and b.lookback_units > 0
              and (b.emob_units::numeric / b.lookback_units) < 0.15 then 10
            when pr.recommended_driveline = 'EMOB' then 4
            else 0
          end
      )::int as fit_score,
      case
        when b.focus_10y = 0 and b.current_total >= 1 then 30
        when b.current_total > b.current_focus and b.current_focus = 0 then 22
        when b.current_total > b.current_focus and b.current_focus > 0 then 15
        when b.last_focus_date is not null
          and (b.cur_end_date - b.last_focus_date) >= 1825 then 35
        when b.last_focus_date is not null
          and (b.cur_end_date - b.last_focus_date) >= 1095 then 28
        else 0
      end::int as timing_score,
      least(
        25,
        greatest(
          coalesce(f.fleet_total, 0),
          greatest(b.current_total - b.current_focus, 0) * 2,
          b.strong_bodywork_units
        )
      )::int as size_score_raw
    from by_party b
    left join fleet f on f.party_key = b.party_key
    left join party_rec pr on pr.party_key = b.party_key
    where (
      not p_exclude_finance
      or not public.ofv_is_excluded_fleet_owner(b.party_name)
    )
  ),
  filtered as (
    select *
    from scored
    where status in ('untapped', 'competitor', 'mixed', 'due', 'overdue')
  )
  select
    f.party_key,
    f.party_name,
    f.region::smallint,
    f.district,
    f.status,
    (f.fit_score + f.timing_score + f.size_score_raw)::int,
    f.fit_score,
    f.timing_score,
    f.size_score_raw,
    f.focus_10y,
    f.fleet_focus,
    f.fleet_total,
    f.current_focus,
    f.current_total,
    f.competitor_units,
    f.last_focus_date,
    f.years_since_last,
    f.recommended_bodywork::int,
    f.recommended_bodywork_name,
    f.recommended_hp_bucket::int,
    f.recommended_driveline,
    round(coalesce(f.bodywork_focus_share, 0), 4),
    round(f.party_emob_share, 4),
    f.strong_bodywork_units
  from filtered f
  order by
    (f.fit_score + f.timing_score + f.size_score_raw) desc,
    case f.status
      when 'untapped' then 1
      when 'overdue' then 2
      when 'due' then 3
      when 'competitor' then 4
      when 'mixed' then 5
      else 6
    end,
    f.competitor_units desc,
    f.strong_bodywork_units desc,
    f.party_name
  limit greatest(p_limit, 1);
end;
$$;

grant execute on function public.reg_potential_list(
  int, text, int, text, int, text, text, int, text, int, date, date, int, boolean, text, text, numeric, int
) to authenticated;

notify pgrst, 'reload schema';
