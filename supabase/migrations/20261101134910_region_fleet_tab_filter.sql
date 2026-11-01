-- Region-fanen: fleet-filteret gjelder alle kortene, ikke bare ranking.
--
-- Definisjoner (speiler src/lib/registrations/fleet-share.ts):
--   all    — alle tunge nyregistreringer.
--   region — trekk ut Volvo Fleet (VIN i fleet_vins og fokusmerke).
--            Konkurrentenes sentrale avtaler blir stående. Vi har ikke
--            deres VIN-lister, og denne migrasjonen finner ikke på en regel.
--   fleet  — bare Volvo Fleet. Volumet er de bilene.
--            market_count / market_total er hele markedet i samme øvrige
--            utvalg, slik at Volvo-andel er fleet / marked og ikke 100 %.
--
-- Andel av Norge regnes i appen mot et nasjonalt total med samme
-- fleet-filter (region er null). Nye funksjoner er egne for region-fanen
-- slik at kjøper-RPC-ene på andre faner ikke byttes ut.
--
-- security invoker: RLS på registrations og fleet_vins gjelder.
-- EXECUTE kun til authenticated og service_role. Ikke anon, ikke PUBLIC.

do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in ('reg_summary_by_region', 'reg_summary_by_district')
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
  p_focus_make text default 'Volvo',
  p_q text default null
)
returns table(region smallint, count int, volvo_count int, market_count int)
language sql
stable
security invoker
as $$
  with base as (
    select
      r.sales_region as region,
      r.make_name = p_focus_make as is_focus,
      coalesce(
        r.make_name = p_focus_make
        and r.vin is not null
        and exists (
          select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
        ),
        false
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
  ),
  tagged as (
    select
      *,
      case coalesce(p_fleet_filter, 'all')
        when 'fleet' then is_fleet_focus
        when 'region' then not is_fleet_focus
        else true
      end as included
    from base
  )
  select
    region,
    count(*) filter (where included)::int,
    count(*) filter (where included and is_focus)::int,
    count(*)::int
  from tagged
  group by region
  having count(*) filter (where included) > 0
  order by count(*) filter (where included) desc, region;
$$;

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
  p_focus_make text default 'Volvo',
  p_q text default null
)
returns table(
  district text,
  region smallint,
  count int,
  focus_count int,
  market_count int
)
language sql
stable
security invoker
as $$
  with located as (
    select
      public.ofv_district_from_postal(r.primary_user_postal_code) as district,
      r.sales_region as region,
      r.make_name = p_focus_make as is_focus,
      coalesce(
        r.make_name = p_focus_make
        and r.vin is not null
        and exists (
          select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
        ),
        false
      ) as is_fleet_focus
    from public.registrations r
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
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
  ),
  base as (
    select * from located where district is not null
  ),
  tagged as (
    select
      *,
      case coalesce(p_fleet_filter, 'all')
        when 'fleet' then is_fleet_focus
        when 'region' then not is_fleet_focus
        else true
      end as included
    from base
  )
  select
    district,
    region,
    count(*) filter (where included)::int,
    count(*) filter (where included and is_focus)::int,
    count(*)::int
  from tagged
  group by district, region
  having count(*) filter (where included) > 0
  order by count(*) filter (where included) desc, district;
$$;

comment on function public.reg_summary_by_region(
  int, text, text, int, int, int, text, text, int, text, int, date, date, text, text, text
) is
  'Regionranking. count/volvo_count følger fleet-filter. market_count er uten fleet-filter.';

create function public.reg_region_scope_summary(
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
  p_focus_make text default 'Volvo',
  p_q text default null
)
returns table(
  total int,
  focus_count int,
  electric_count int,
  market_total int
)
language sql
stable
security invoker
as $$
  with base as (
    select
      r.make_name = p_focus_make as is_focus,
      coalesce(r.fuel_name ilike '%elektr%', false) as is_electric,
      coalesce(
        r.make_name = p_focus_make
        and r.vin is not null
        and exists (
          select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
        ),
        false
      ) as is_fleet_focus
    from public.registrations r
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
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
  ),
  tagged as (
    select
      *,
      case coalesce(p_fleet_filter, 'all')
        when 'fleet' then is_fleet_focus
        when 'region' then not is_fleet_focus
        else true
      end as included
    from base
  )
  select
    count(*) filter (where included)::int,
    count(*) filter (where included and is_focus)::int,
    count(*) filter (where included and is_electric)::int,
    count(*)::int
  from tagged;
$$;

create function public.reg_region_summary_by_month(
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
  p_fleet_filter text default 'all',
  p_focus_make text default 'Volvo',
  p_q text default null
)
returns table(month date, count int, volvo_count int, market_count int)
language sql
stable
security invoker
as $$
  with base as (
    select
      date_trunc('month', r.transaction_time)::date as month,
      r.make_name = p_focus_make as is_focus,
      coalesce(
        r.make_name = p_focus_make
        and r.vin is not null
        and exists (
          select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
        ),
        false
      ) as is_fleet_focus
    from public.registrations r
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and (p_from is not null or p_to is not null
           or extract(year from r.transaction_time) = p_year)
      and (p_from is null or r.transaction_time >= p_from)
      and (p_to is null or r.transaction_time < (p_to + 1))
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
  ),
  tagged as (
    select
      *,
      case coalesce(p_fleet_filter, 'all')
        when 'fleet' then is_fleet_focus
        when 'region' then not is_fleet_focus
        else true
      end as included
    from base
  )
  select
    month,
    count(*) filter (where included)::int,
    count(*) filter (where included and is_focus)::int,
    count(*)::int
  from tagged
  group by month
  having count(*) filter (where included) > 0
  order by month;
$$;

create function public.reg_region_summary_by_make(
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
  p_focus_make text default 'Volvo',
  p_q text default null
)
returns table(make_name text, count int)
language sql
stable
security invoker
as $$
  with base as (
    select
      r.make_name,
      coalesce(
        r.make_name = p_focus_make
        and r.vin is not null
        and exists (
          select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
        ),
        false
      ) as is_fleet_focus
    from public.registrations r
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and r.make_name is not null
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
  ),
  tagged as (
    select
      *,
      case coalesce(p_fleet_filter, 'all')
        when 'fleet' then is_fleet_focus
        when 'region' then not is_fleet_focus
        else true
      end as included
    from base
  )
  select make_name, count(*)::int
  from tagged
  where included
  group by make_name
  order by count(*) desc;
$$;

create function public.reg_region_top_buyers(
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
  p_fleet_filter text default 'all'
)
returns table(owner_name text, count int, focus_count int, market_count int)
language sql
stable
security invoker
as $$
  with base as (
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
      r.make_name = p_focus_make as is_focus,
      coalesce(
        r.make_name = p_focus_make
        and r.vin is not null
        and exists (
          select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
        ),
        false
      ) as is_fleet_focus
    from public.registrations r
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and (
        case
          when coalesce(p_customer_party, 'user') = 'owner' then r.primary_owner_name
          else r.primary_user_name
        end
      ) is not null
      and (p_from is not null or p_to is not null
           or extract(year from r.transaction_time) = p_year)
      and (p_from is null or r.transaction_time >= p_from)
      and (p_to is null or r.transaction_time < (p_to + 1))
      and (p_segment is null or r.usage_name = p_segment)
      and (p_make is null or r.make_name = p_make)
      and (p_region is null or r.sales_region = p_region)
      and (p_hp is null or r.hp_bucket = p_hp)
      and (p_fuel is null or r.fuel_name = p_fuel)
      and (p_pabygg is null or r.pabygg_segment = p_pabygg)
      and public.ofv_disp_matches(r.disp_bucket, p_disp)
      and (p_chassis is null or r.trekker_jevnlast = p_chassis)
      and (p_month is null or extract(month from r.transaction_time) = p_month)
      and (
        p_bodywork is null
        or (p_bodywork = -1 and r.bodywork_code is null)
        or r.bodywork_code = p_bodywork
      )
  ),
  tagged as (
    select
      *,
      case coalesce(p_fleet_filter, 'all')
        when 'fleet' then is_fleet_focus
        when 'region' then not is_fleet_focus
        else true
      end as included
    from base
  )
  select
    max(party_name) as owner_name,
    count(*) filter (where included)::int,
    count(*) filter (where included and is_focus)::int,
    count(*)::int
  from tagged
  group by party_key
  having count(*) filter (where included) > 0
  order by count(*) filter (where included) desc, max(party_name)
  limit greatest(p_limit, 1);
$$;

create function public.reg_region_buyer_loyalty(
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
  p_fleet_filter text default 'all'
)
returns table(
  buyer_type text,
  owner_count int,
  purchase_count int,
  focus_count int,
  market_purchase_count int
)
language sql
stable
security invoker
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
      r.make_name,
      coalesce(
        r.make_name = p_focus_make
        and r.vin is not null
        and exists (
          select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
        ),
        false
      ) as is_fleet_focus
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
      and public.ofv_disp_matches(r.disp_bucket, p_disp)
      and (p_chassis is null or r.trekker_jevnlast = p_chassis)
      and (
        p_bodywork is null
        or (p_bodywork = -1 and r.bodywork_code is null)
        or r.bodywork_code = p_bodywork
      )
  ),
  tagged as (
    select
      *,
      case coalesce(p_fleet_filter, 'all')
        when 'fleet' then is_fleet_focus
        when 'region' then not is_fleet_focus
        else true
      end as included
    from period_regs
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
      count(*) filter (where p.included)::int as purchase_count,
      count(*) filter (
        where p.included and p.make_name = p_focus_make
      )::int as focus_count,
      count(*)::int as market_purchase_count,
      bool_or(p.included and p.make_name = p_focus_make) as bought_focus,
      coalesce(pr.had_focus, false) as had_focus,
      (pr.party_key is not null) as had_any_prior
    from tagged p
    left join prior_parties pr on pr.party_key = p.party_key
    group by p.party_key, pr.had_focus, pr.party_key
    having count(*) filter (where p.included) > 0
  ),
  classified as (
    select
      party_key,
      purchase_count,
      focus_count,
      market_purchase_count,
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
      sum(focus_count)::int as focus_count,
      sum(market_purchase_count)::int as market_purchase_count
    from classified
    group by loyalty_type
  ),
  conquest as (
    select
      'conquest'::text as buyer_type,
      count(*)::int as owner_count,
      coalesce(sum(purchase_count), 0)::int as purchase_count,
      coalesce(sum(focus_count), 0)::int as focus_count,
      coalesce(sum(market_purchase_count), 0)::int as market_purchase_count
    from classified
    where conquest_type = 'conquest'
  )
  select
    buyer_type,
    owner_count,
    purchase_count,
    focus_count,
    market_purchase_count
  from loyalty
  union all
  select
    buyer_type,
    owner_count,
    purchase_count,
    focus_count,
    market_purchase_count
  from conquest
  order by buyer_type;
$$;

create function public.reg_region_buyer_loyalty_owners(
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
  p_fleet_filter text default 'all'
)
returns table(owner_name text, count int, focus_count int, market_count int)
language sql
stable
security invoker
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
      r.make_name,
      coalesce(
        r.make_name = p_focus_make
        and r.vin is not null
        and exists (
          select 1 from public.fleet_vins fv where fv.vin = upper(r.vin)
        ),
        false
      ) as is_fleet_focus
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
      and public.ofv_disp_matches(r.disp_bucket, p_disp)
      and (p_chassis is null or r.trekker_jevnlast = p_chassis)
      and (
        p_bodywork is null
        or (p_bodywork = -1 and r.bodywork_code is null)
        or r.bodywork_code = p_bodywork
      )
  ),
  tagged as (
    select
      *,
      case coalesce(p_fleet_filter, 'all')
        when 'fleet' then is_fleet_focus
        when 'region' then not is_fleet_focus
        else true
      end as included
    from period_regs
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
      count(*) filter (where p.included)::int as purchase_count,
      count(*) filter (
        where p.included and p.make_name = p_focus_make
      )::int as focus_count,
      count(*)::int as market_count,
      bool_or(p.included and p.make_name = p_focus_make) as bought_focus,
      coalesce(pr.had_focus, false) as had_focus,
      (pr.party_key is not null) as had_any_prior
    from tagged p
    left join prior_parties pr on pr.party_key = p.party_key
    group by p.party_key, pr.had_focus, pr.party_key
    having count(*) filter (where p.included) > 0
  )
  select owner_name, purchase_count, focus_count, market_count
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

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in (
        'reg_summary_by_region',
        'reg_summary_by_district',
        'reg_region_scope_summary',
        'reg_region_summary_by_month',
        'reg_region_summary_by_make',
        'reg_region_top_buyers',
        'reg_region_buyer_loyalty',
        'reg_region_buyer_loyalty_owners'
      )
  loop
    execute format('revoke all on function %s from public, anon', r.sig);
    execute format(
      'grant execute on function %s to authenticated, service_role',
      r.sig
    );
  end loop;
end $$;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in (
        'reg_summary_by_region',
        'reg_summary_by_district',
        'reg_region_scope_summary',
        'reg_region_summary_by_month',
        'reg_region_summary_by_make',
        'reg_region_top_buyers',
        'reg_region_buyer_loyalty',
        'reg_region_buyer_loyalty_owners'
      )
  loop
    if has_function_privilege('anon', r.sig, 'execute') then
      raise exception '% er fortsatt kjørbar for anon', r.sig;
    end if;
    if has_function_privilege('public', r.sig, 'execute') then
      raise exception '% har fortsatt EXECUTE for PUBLIC', r.sig;
    end if;
    if not has_function_privilege('authenticated', r.sig, 'execute') then
      raise exception '% mangler EXECUTE for authenticated', r.sig;
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
