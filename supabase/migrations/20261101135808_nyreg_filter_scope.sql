-- Nyregistreringer: måned, søk og merke på fanene som manglet dem,
-- pluss radliste som også tar fleet. Kundelogikk (Ukjent, finans,
-- slagvolum) er urørt — her legges bare filterparametre på.
--
-- authenticator er rollen PostgREST logger inn som. Tidssone der gjør
-- at date-cast og extract(month/year) i eksisterende RPC-er bruker
-- Oslo-døgn, samme grense som radfiltrene. service_role (synk) blir stående.

alter role authenticator set timezone to 'Europe/Oslo';

do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in (
        'reg_make_share_by_month',
        'reg_electric_share_by_segment_month',
        'reg_top_buyers',
        'reg_buyer_loyalty',
        'reg_buyer_loyalty_owners',
        'reg_owner_focus_decline_summary',
        'reg_owner_focus_decline_list',
        'reg_potential_list'
      )
  loop
    execute 'drop function if exists ' || r.sig::text;
  end loop;
end $$;

create function public.reg_make_share_by_month(
  p_year int, p_segment text default null, p_make text default null,
  p_region int default null, p_hp int default null, p_fuel text default null,
  p_pabygg text default null, p_disp int default null, p_chassis text default null,
  p_bodywork int default null, p_from date default null, p_to date default null,
  p_focus_make text default 'Volvo',
  p_q text default null
)
returns table(month date, make_name text, count int)
language sql stable security invoker
set search_path = public
as $$
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
    and public.ofv_disp_matches(disp_bucket, p_disp)
    and (p_chassis is null or trekker_jevnlast = p_chassis)
      and (
        p_bodywork is null
        or (p_bodywork = -1 and r.bodywork_code is null)
        or r.bodywork_code = p_bodywork
      )
    and (
      p_q is null
      or r.primary_owner_name ilike '%' || p_q || '%'
      or r.primary_user_name ilike '%' || p_q || '%'
      or (p_q ~ '^[0-9]{3,}$' and (
        r.primary_owner_orgnr like p_q || '%'
        or r.primary_user_orgnr like p_q || '%'
      ))
    )
  group by 1, r.make_name order by 1, count(*) desc;
$$;

create function public.reg_electric_share_by_segment_month(
  p_year int, p_segment text default null, p_make text default null,
  p_region int default null, p_hp int default null, p_fuel text default null,
  p_pabygg text default null, p_disp int default null, p_chassis text default null,
  p_bodywork int default null, p_from date default null, p_to date default null,
  p_focus_make text default 'Volvo',
  p_q text default null
)
returns table(month date, segment text, total_count int, electric_count int)
language sql stable security invoker
set search_path = public
as $$
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
    and public.ofv_disp_matches(disp_bucket, p_disp)
    and (p_chassis is null or trekker_jevnlast = p_chassis)
    and (
      p_bodywork is null
      or (p_bodywork = -1 and bodywork_code is null)
      or bodywork_code = p_bodywork
    )
    and (
      p_q is null
      or primary_owner_name ilike '%' || p_q || '%'
      or primary_user_name ilike '%' || p_q || '%'
      or (p_q ~ '^[0-9]{3,}$' and (
        primary_owner_orgnr like p_q || '%'
        or primary_user_orgnr like p_q || '%'
      ))
    )
  group by 1, 2 order by 1, 3 desc;
$$;

create function public.reg_top_buyers(
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
  p_limit int default 15,
  p_customer_party text default 'user',
  p_focus_make text default 'Volvo',
  p_q text default null
)
returns table(owner_name text, count int, focus_count int)
language sql
stable
security invoker
set search_path = public
as $$
  select
    max(
      case
        when coalesce(p_customer_party, 'user') = 'owner' then primary_owner_name
        else primary_user_name
      end
    ) as owner_name,
    count(*)::int,
    count(*) filter (where make_name = p_focus_make)::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg >= 16000
    and (
      case
        when coalesce(p_customer_party, 'user') = 'owner' then primary_owner_name
        else primary_user_name
      end
    ) is not null
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
    and (
      p_q is null
      or primary_owner_name ilike '%' || p_q || '%'
      or primary_user_name ilike '%' || p_q || '%'
      or (p_q ~ '^[0-9]{3,}$' and (
        primary_owner_orgnr like p_q || '%'
        or primary_user_orgnr like p_q || '%'
      ))
    )
  group by
    case
      when coalesce(p_customer_party, 'user') = 'owner' then
        coalesce(nullif(primary_owner_orgnr, ''), primary_owner_name)
      else
        coalesce(nullif(primary_user_orgnr, ''), primary_user_name)
    end
  order by count(*) desc
  limit greatest(p_limit, 1);
$$;

create function public.reg_buyer_loyalty(
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
  p_customer_party text default 'user',
  p_focus_make text default 'Volvo',
  p_q text default null
)
returns table(buyer_type text, owner_count int, purchase_count int, focus_count int)
language sql
stable
security invoker
set search_path = public
as $$
  with bounds as (
    select
      case
        when p_month is not null then greatest(
          coalesce(p_from, make_date(p_year, 1, 1)),
          make_date(p_year, p_month, 1)
        )
        else coalesce(p_from, make_date(p_year, 1, 1))
      end::timestamp as period_start,
      case
        when p_month is not null then least(
          coalesce(p_to + 1, make_date(p_year + 1, 1, 1)),
          (make_date(p_year, p_month, 1) + interval '1 month')::date
        )
        else coalesce(p_to + 1, make_date(p_year + 1, 1, 1))
      end::timestamp as period_end_exclusive
  ),
  period_regs as (
    select
      case
        when coalesce(p_customer_party, 'user') = 'owner' then
          coalesce(nullif(r.primary_owner_orgnr, ''), r.primary_owner_name)
        else
          coalesce(nullif(r.primary_user_orgnr, ''), r.primary_user_name)
      end as party_key,
      r.make_name
    from public.registrations r
    cross join bounds b
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and (
        case
          when coalesce(p_customer_party, 'user') = 'owner' then r.primary_owner_name
          else r.primary_user_name
        end
      ) is not null
      and r.transaction_time >= b.period_start
      and r.transaction_time < b.period_end_exclusive
      and (p_segment is null or r.usage_name = p_segment)
      and (p_make is null or r.make_name = p_make)
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
    and (
      p_q is null
      or r.primary_owner_name ilike '%' || p_q || '%'
      or r.primary_user_name ilike '%' || p_q || '%'
      or (p_q ~ '^[0-9]{3,}$' and (
        r.primary_owner_orgnr like p_q || '%'
        or r.primary_user_orgnr like p_q || '%'
      ))
    )
  ),
  prior_parties as (
    select
      case
        when coalesce(p_customer_party, 'user') = 'owner' then
          coalesce(nullif(r.primary_owner_orgnr, ''), r.primary_owner_name)
        else
          coalesce(nullif(r.primary_user_orgnr, ''), r.primary_user_name)
      end as party_key,
      bool_or(r.make_name = p_focus_make) as had_focus
    from public.registrations r
    cross join bounds b
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and (
        case
          when coalesce(p_customer_party, 'user') = 'owner' then
            coalesce(nullif(r.primary_owner_orgnr, ''), r.primary_owner_name)
          else
            coalesce(nullif(r.primary_user_orgnr, ''), r.primary_user_name)
        end
      ) is not null
      and r.transaction_time < b.period_start
      and (p_region is null or r.sales_region = p_region)
    group by 1
  ),
  party_period as (
    select
      p.party_key,
      count(*)::int as purchase_count,
      count(*) filter (where p.make_name = p_focus_make)::int as focus_count,
      bool_or(p.make_name = p_focus_make) as bought_focus,
      coalesce(pr.had_focus, false) as had_focus,
      (pr.party_key is not null) as had_any_prior
    from period_regs p
    left join prior_parties pr on pr.party_key = p.party_key
    group by p.party_key, pr.had_focus, pr.party_key
  ),
  classified as (
    select
      party_key,
      purchase_count,
      focus_count,
      case when had_any_prior then 'repeat' else 'new' end as loyalty_type,
      case
        when bought_focus and not had_focus then 'conquest'
        else null
      end as conquest_type
    from party_period
  ),
  loyalty as (
    select
      loyalty_type as buyer_type,
      count(*)::int as owner_count,
      sum(purchase_count)::int as purchase_count,
      sum(focus_count)::int as focus_count
    from classified
    group by loyalty_type
  ),
  conquest as (
    select
      'conquest'::text as buyer_type,
      count(*)::int as owner_count,
      coalesce(sum(purchase_count), 0)::int as purchase_count,
      coalesce(sum(focus_count), 0)::int as focus_count
    from classified
    where conquest_type = 'conquest'
  )
  select buyer_type, owner_count, purchase_count, focus_count from loyalty
  union all
  select buyer_type, owner_count, purchase_count, focus_count from conquest
  order by buyer_type;
$$;

create function public.reg_buyer_loyalty_owners(
  p_year int,
  p_buyer_type text,
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
  p_limit int default 100,
  p_customer_party text default 'user',
  p_focus_make text default 'Volvo',
  p_q text default null
)
returns table(owner_name text, count int, focus_count int)
language sql
stable
security invoker
set search_path = public
as $$
  with bounds as (
    select
      case
        when p_month is not null then greatest(
          coalesce(p_from, make_date(p_year, 1, 1)),
          make_date(p_year, p_month, 1)
        )
        else coalesce(p_from, make_date(p_year, 1, 1))
      end::timestamp as period_start,
      case
        when p_month is not null then least(
          coalesce(p_to + 1, make_date(p_year + 1, 1, 1)),
          (make_date(p_year, p_month, 1) + interval '1 month')::date
        )
        else coalesce(p_to + 1, make_date(p_year + 1, 1, 1))
      end::timestamp as period_end_exclusive
  ),
  period_regs as (
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
      r.make_name
    from public.registrations r
    cross join bounds b
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and (
        case
          when coalesce(p_customer_party, 'user') = 'owner' then r.primary_owner_name
          else r.primary_user_name
        end
      ) is not null
      and r.transaction_time >= b.period_start
      and r.transaction_time < b.period_end_exclusive
      and (p_segment is null or r.usage_name = p_segment)
      and (p_make is null or r.make_name = p_make)
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
    and (
      p_q is null
      or r.primary_owner_name ilike '%' || p_q || '%'
      or r.primary_user_name ilike '%' || p_q || '%'
      or (p_q ~ '^[0-9]{3,}$' and (
        r.primary_owner_orgnr like p_q || '%'
        or r.primary_user_orgnr like p_q || '%'
      ))
    )
  ),
  prior_parties as (
    select
      case
        when coalesce(p_customer_party, 'user') = 'owner' then
          coalesce(nullif(r.primary_owner_orgnr, ''), r.primary_owner_name)
        else
          coalesce(nullif(r.primary_user_orgnr, ''), r.primary_user_name)
      end as party_key,
      bool_or(r.make_name = p_focus_make) as had_focus
    from public.registrations r
    cross join bounds b
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and (
        case
          when coalesce(p_customer_party, 'user') = 'owner' then
            coalesce(nullif(r.primary_owner_orgnr, ''), r.primary_owner_name)
          else
            coalesce(nullif(r.primary_user_orgnr, ''), r.primary_user_name)
        end
      ) is not null
      and r.transaction_time < b.period_start
      and (p_region is null or r.sales_region = p_region)
    group by 1
  ),
  party_totals as (
    select
      p.party_key,
      max(p.party_name) as owner_name,
      count(*)::int as purchase_count,
      count(*) filter (where p.make_name = p_focus_make)::int as focus_count,
      bool_or(p.make_name = p_focus_make) as bought_focus,
      coalesce(pr.had_focus, false) as had_focus,
      (pr.party_key is not null) as had_any_prior
    from period_regs p
    left join prior_parties pr on pr.party_key = p.party_key
    group by p.party_key, pr.had_focus, pr.party_key
  )
  select owner_name, purchase_count, focus_count
  from party_totals
  where case p_buyer_type
    when 'repeat' then had_any_prior
    when 'new' then not had_any_prior
    when 'conquest' then bought_focus and not had_focus
    else false
  end
  order by purchase_count desc, owner_name
  limit greatest(p_limit, 1);
$$;

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
  p_focus_make text default 'Volvo',
  p_make text default null,
  p_q text default null
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
set search_path = public
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
    and (p_make is null or r.make_name = p_make)
    and (
      p_q is null
      or r.primary_owner_name ilike '%' || p_q || '%'
      or r.primary_user_name ilike '%' || p_q || '%'
      or (p_q ~ '^[0-9]{3,}$' and (
        r.primary_owner_orgnr like p_q || '%'
        or r.primary_user_orgnr like p_q || '%'
      ))
    )
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
  p_focus_make text default 'Volvo',
  p_make text default null,
  p_q text default null
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
set search_path = public
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
    and (p_make is null or r.make_name = p_make)
    and (
      p_q is null
      or r.primary_owner_name ilike '%' || p_q || '%'
      or r.primary_user_name ilike '%' || p_q || '%'
      or (p_q ~ '^[0-9]{3,}$' and (
        r.primary_owner_orgnr like p_q || '%'
        or r.primary_user_orgnr like p_q || '%'
      ))
    )
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
  p_min_volume int default 20,
  p_make text default null,
  p_q text default null
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
    and (p_make is null or r.make_name = p_make)
    and (
      p_q is null
      or r.primary_owner_name ilike '%' || p_q || '%'
      or r.primary_user_name ilike '%' || p_q || '%'
      or (p_q ~ '^[0-9]{3,}$' and (
        r.primary_owner_orgnr like p_q || '%'
        or r.primary_user_orgnr like p_q || '%'
      ))
    )
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

revoke all on function public.reg_make_share_by_month(
  int, text, text, int, int, text, text, int, text, int, date, date, text, text
) from public, anon;
grant execute on function public.reg_make_share_by_month(
  int, text, text, int, int, text, text, int, text, int, date, date, text, text
) to authenticated;

revoke all on function public.reg_electric_share_by_segment_month(
  int, text, text, int, int, text, text, int, text, int, date, date, text, text
) from public, anon;
grant execute on function public.reg_electric_share_by_segment_month(
  int, text, text, int, int, text, text, int, text, int, date, date, text, text
) to authenticated;

revoke all on function public.reg_top_buyers(
  int, text, text, int, int, int, text, text, int, text, int, date, date, int, text, text, text
) from public, anon;
grant execute on function public.reg_top_buyers(
  int, text, text, int, int, int, text, text, int, text, int, date, date, int, text, text, text
) to authenticated;

revoke all on function public.reg_buyer_loyalty(
  int, text, text, int, int, int, text, text, int, text, int, date, date, text, text, text
) from public, anon;
grant execute on function public.reg_buyer_loyalty(
  int, text, text, int, int, int, text, text, int, text, int, date, date, text, text, text
) to authenticated;

revoke all on function public.reg_buyer_loyalty_owners(
  int, text, text, text, int, int, int, text, text, int, text, int, date, date, int, text, text, text
) from public, anon;
grant execute on function public.reg_buyer_loyalty_owners(
  int, text, text, text, int, int, int, text, text, int, text, int, date, date, int, text, text, text
) to authenticated;

revoke all on function public.reg_owner_focus_decline_summary(
  int, text, int, text, int, text, text, int, text, int, date, date, boolean, text, text, text
) from public, anon;
grant execute on function public.reg_owner_focus_decline_summary(
  int, text, int, text, int, text, text, int, text, int, date, date, boolean, text, text, text
) to authenticated;

revoke all on function public.reg_owner_focus_decline_list(
  int, text, int, text, int, text, text, int, text, int, date, date, int, boolean, text, text, text, text
) from public, anon;
grant execute on function public.reg_owner_focus_decline_list(
  int, text, int, text, int, text, text, int, text, int, date, date, int, boolean, text, text, text, text
) to authenticated;

revoke all on function public.reg_potential_list(
  int, text, int, text, int, text, text, int, text, int, date, date, int, boolean, text, text, numeric, int, text, text
) from public, anon;
grant execute on function public.reg_potential_list(
  int, text, int, text, int, text, text, int, text, int, date, date, int, boolean, text, text, numeric, int, text, text
) to authenticated;

-- Detaljer og Excel. Samme tunge filter som applyRegistrationFilters,
-- med Oslo-døgn og fleet (VIN-registeret er for stort til en URL-.in()).

create function public.reg_filtered_count(
  p_from date default null,
  p_to date default null,
  p_segment text default null,
  p_make text default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_bodywork int default null,
  p_disp int default null,
  p_chassis text default null,
  p_q text default null,
  p_fleet_filter text default 'all'
)
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::bigint
  from public.registrations r

  where r.transaction_type_id = '10'
    and r.maximum_laden_mass_kg >= 16000
    and (p_from is null or r.transaction_time >= (p_from::timestamp at time zone 'Europe/Oslo'))
    and (p_to is null or r.transaction_time < ((p_to + 1)::timestamp at time zone 'Europe/Oslo'))
    and (p_segment is null or r.usage_name = p_segment)
    and (p_make is null or r.make_name = p_make)
    and (p_region is null or r.sales_region = p_region)
    and (p_hp is null or r.hp_bucket = p_hp)
    and (p_fuel is null or r.fuel_name = p_fuel)
    and (p_pabygg is null or r.pabygg_segment = p_pabygg)
    and public.ofv_disp_matches(r.disp_bucket, p_disp)
    and (p_chassis is null or r.trekker_jevnlast = p_chassis)
    and (
      p_bodywork is null
      or (p_bodywork = -1 and r.bodywork_code is null)
      or r.bodywork_code = p_bodywork
    )
    and (
      p_q is null
      or r.primary_owner_name ilike '%' || p_q || '%'
      or r.primary_user_name ilike '%' || p_q || '%'
      or (p_q ~ '^[0-9]{3,}$' and (
        r.primary_owner_orgnr like p_q || '%'
        or r.primary_user_orgnr like p_q || '%'
      ))
    )
    and (
      coalesce(p_fleet_filter, 'all') not in ('fleet', 'region')
      or (
        p_fleet_filter = 'fleet'
        and exists (
          select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
        )
      )
      or (
        p_fleet_filter = 'region'
        and not exists (
          select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
        )
      )
    );
$$;

revoke all on function public.reg_filtered_count(date, date, text, text, int, int, text, text, int, int, text, text, text) from public, anon;
grant execute on function public.reg_filtered_count(date, date, text, text, int, int, text, text, int, int, text, text, text) to authenticated;

create function public.reg_filtered_page(
  p_from date default null,
  p_to date default null,
  p_segment text default null,
  p_make text default null,
  p_region int default null,
  p_hp int default null,
  p_fuel text default null,
  p_pabygg text default null,
  p_bodywork int default null,
  p_disp int default null,
  p_chassis text default null,
  p_q text default null,
  p_fleet_filter text default 'all',
  p_limit int default 25,
  p_offset int default 0
)
returns table(
  registration_number text,
  transaction_time timestamptz,
  make_name text,
  model_name text,
  variant_name text,
  usage_name text,
  maximum_laden_mass_kg int,
  sales_region int,
  hp_bucket int,
  fuel_name text,
  pabygg_segment text,
  bodywork_code int,
  bodywork_name text,
  primary_owner_name text,
  primary_owner_postal_code text,
  primary_owner_postal_district text,
  primary_user_name text,
  primary_user_postal_code text,
  primary_user_postal_district text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    r.registration_number,
    r.transaction_time,
    r.make_name,
    r.model_name,
    r.variant_name,
    r.usage_name,
    r.maximum_laden_mass_kg,
    r.sales_region::int,
    r.hp_bucket::int,
    r.fuel_name,
    r.pabygg_segment,
    r.bodywork_code::int,
    r.bodywork_name,
    r.primary_owner_name,
    r.primary_owner_postal_code,
    r.primary_owner_postal_district,
    r.primary_user_name,
    r.primary_user_postal_code,
    r.primary_user_postal_district
  from public.registrations r

  where r.transaction_type_id = '10'
    and r.maximum_laden_mass_kg >= 16000
    and (p_from is null or r.transaction_time >= (p_from::timestamp at time zone 'Europe/Oslo'))
    and (p_to is null or r.transaction_time < ((p_to + 1)::timestamp at time zone 'Europe/Oslo'))
    and (p_segment is null or r.usage_name = p_segment)
    and (p_make is null or r.make_name = p_make)
    and (p_region is null or r.sales_region = p_region)
    and (p_hp is null or r.hp_bucket = p_hp)
    and (p_fuel is null or r.fuel_name = p_fuel)
    and (p_pabygg is null or r.pabygg_segment = p_pabygg)
    and public.ofv_disp_matches(r.disp_bucket, p_disp)
    and (p_chassis is null or r.trekker_jevnlast = p_chassis)
    and (
      p_bodywork is null
      or (p_bodywork = -1 and r.bodywork_code is null)
      or r.bodywork_code = p_bodywork
    )
    and (
      p_q is null
      or r.primary_owner_name ilike '%' || p_q || '%'
      or r.primary_user_name ilike '%' || p_q || '%'
      or (p_q ~ '^[0-9]{3,}$' and (
        r.primary_owner_orgnr like p_q || '%'
        or r.primary_user_orgnr like p_q || '%'
      ))
    )
    and (
      coalesce(p_fleet_filter, 'all') not in ('fleet', 'region')
      or (
        p_fleet_filter = 'fleet'
        and exists (
          select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
        )
      )
      or (
        p_fleet_filter = 'region'
        and not exists (
          select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
        )
      )
    )
  order by r.transaction_time desc, r.registration_number desc
  limit least(greatest(coalesce(p_limit, 25), 0), 1000)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.reg_filtered_page(date, date, text, text, int, int, text, text, int, int, text, text, text, int, int) from public, anon;
grant execute on function public.reg_filtered_page(date, date, text, text, int, int, text, text, int, int, text, text, text, int, int) to authenticated;

-- Salg kan lese registreringer, men ikke sync_logs. Funksjonen gir bare
-- siste tidspunkt og om en registreringssynk kjører.

create function public.reg_data_freshness()
returns table(data_through timestamptz, sync_running boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.jwt_can_read_registrations() then
    return;
  end if;

  return query
  select
    (
      select r.transaction_time
      from public.registrations r
      order by r.transaction_time desc
      limit 1
    ),
    exists (
      select 1
      from public.sync_logs s
      where s.status = 'running'
        and s.sync_type in ('full', 'registrations')
    );
end;
$$;

revoke all on function public.reg_data_freshness() from public, anon;
grant execute on function public.reg_data_freshness() to authenticated;

notify pgrst, 'reload schema';
