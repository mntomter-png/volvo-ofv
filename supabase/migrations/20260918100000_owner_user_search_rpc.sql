-- Eier/bruker-søk i fordelingskortene.
--
-- Fram til nå traff `?q=` bare rad-nivå (KPI-counts, radtabell, Excel-eksport),
-- mens kortene for region, påbygg, HK, drivstoff osv. viste hele markedet. Det
-- ga misvisende sider: nøkkeltallet kunne si 142 biler mens månedsgrafen viste
-- 2 400. Her får de 14 summary-funksjonene en `p_q`-parameter med samme
-- predikat som `customerSearchOrFilter()` i src/lib/ofv/customer-search.ts:
--
--   navn    → delstreng, treffer trigram-indeksene
--   org.nr. → prefiks, kun når søket er rene siffer (≥ 3)
--
-- Predikatet skrives ut i hver funksjon i stedet for å pakkes i en hjelpe-
-- funksjon, slik at planleggeren ser ILIKE-uttrykket og kan velge
-- trigram-indeksene fra migrasjonen `owner_user_search_indexes`.
--
-- Parameteren legges sist med default null, så eksisterende kall (bl.a.
-- presentasjonsmodulen) er upåvirket. Signaturen endres, derfor drop + create.

do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in (
        'reg_summary_by_month',
        'reg_summary_by_make',
        'reg_summary_by_region',
        'reg_summary_by_district',
        'reg_summary_by_hp',
        'reg_summary_by_fuel',
        'reg_summary_by_pabygg',
        'reg_summary_by_segment',
        'reg_summary_by_disp',
        'reg_summary_by_bodywork',
        'pop_summary_by_make',
        'pop_summary_by_segment',
        'pop_summary_by_region',
        'pop_summary_by_fuel'
      )
  loop
    execute 'drop function if exists ' || r.sig::text;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- registrations
-- ---------------------------------------------------------------------------

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
  p_focus_make text default 'Volvo',
  p_q text default null
)
returns table(month date, count int, volvo_count int)
language sql
stable
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
  group by 1
  order by 1;
$$;

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
  p_to date default null,
  p_q text default null
)
returns table(make_name text, count int)
language sql
stable
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
    and public.ofv_disp_matches(disp_bucket, p_disp)
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
  group by make_name
  order by count(*) desc;
$$;

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
returns table(region smallint, count int, volvo_count int)
language sql
stable
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
returns table(district text, region smallint, count int, focus_count int)
language sql
stable
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

create function public.reg_summary_by_hp(
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
  p_focus_make text default 'Volvo',
  p_q text default null
)
returns table(bucket smallint, count int, volvo_count int)
language sql
stable
as $$
  select hp_bucket as bucket, count(*)::int,
         count(*) filter (where make_name = p_focus_make)::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg >= 16000
    and hp_bucket is not null
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
  group by hp_bucket
  order by hp_bucket;
$$;

create function public.reg_summary_by_fuel(
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
  p_focus_make text default 'Volvo',
  p_q text default null
)
returns table(fuel text, count int, volvo_count int)
language sql
stable
as $$
  select fuel_name as fuel, count(*)::int,
         count(*) filter (where make_name = p_focus_make)::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg >= 16000
    and fuel_name is not null
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
  group by fuel_name
  order by count(*) desc;
$$;

create function public.reg_summary_by_pabygg(
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
  p_focus_make text default 'Volvo',
  p_q text default null
)
returns table(pabygg text, count int, volvo_count int)
language sql
stable
as $$
  select pabygg_segment as pabygg, count(*)::int,
         count(*) filter (where make_name = p_focus_make)::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg >= 16000
    and pabygg_segment is not null
    and (p_from is not null or p_to is not null
         or extract(year from transaction_time) = p_year)
    and (p_from is null or transaction_time >= p_from)
    and (p_to is null or transaction_time < (p_to + 1))
    and (p_segment is null or usage_name = p_segment)
    and (p_make is null or make_name = p_make)
    and (p_month is null or extract(month from transaction_time) = p_month)
    and (p_region is null or sales_region = p_region)
    and (p_hp is null or hp_bucket = p_hp)
    and (p_fuel is null or fuel_name = p_fuel)
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
  group by pabygg_segment
  order by count(*) desc;
$$;

create function public.reg_summary_by_segment(
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
  p_focus_make text default 'Volvo',
  p_q text default null
)
returns table(segment text, count int, volvo_count int)
language sql
stable
as $$
  select coalesce(pabygg_segment, 'Annet') as segment, count(*)::int,
         count(*) filter (where make_name = p_focus_make)::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg >= 16000
    and (p_from is not null or p_to is not null
         or extract(year from transaction_time) = p_year)
    and (p_from is null or transaction_time >= p_from)
    and (p_to is null or transaction_time < (p_to + 1))
    and (p_make is null or make_name = p_make)
    and (p_month is null or extract(month from transaction_time) = p_month)
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
  group by coalesce(pabygg_segment, 'Annet')
  order by count(*) desc;
$$;

create function public.reg_summary_by_disp(
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
  p_focus_make text default 'Volvo',
  p_q text default null
)
returns table(bucket smallint, count int, volvo_count int)
language sql
stable
as $$
  select
    coalesce(disp_bucket, 0)::smallint as bucket,
    count(*)::int,
    count(*) filter (where make_name = p_focus_make)::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg >= 16000
    and (p_from is not null or p_to is not null
         or extract(year from transaction_time) = p_year)
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
    and (
      p_disp is null
      or (p_disp = 0 and disp_bucket is null)
      or disp_bucket = p_disp
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
  group by coalesce(disp_bucket, 0)
  order by case when coalesce(disp_bucket, 0) = 0 then 99 else coalesce(disp_bucket, 0) end;
$$;

create function public.reg_summary_by_bodywork(
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
  p_focus_make text default 'Volvo',
  p_q text default null
)
returns table(bodywork_code int, count int, volvo_count int)
language sql
stable
as $$
  select
    coalesce(r.bodywork_code, -1)::int as bodywork_code,
    count(*)::int,
    count(*) filter (where r.make_name = p_focus_make)::int
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
  group by coalesce(r.bodywork_code, -1)
  order by count(*) desc, coalesce(r.bodywork_code, -1);
$$;

-- ---------------------------------------------------------------------------
-- population
-- ---------------------------------------------------------------------------

create function public.pop_summary_by_make(
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
  p_bodywork int default null,
  p_focus_make text default 'Volvo',
  p_q text default null
)
returns table(make_name text, count int)
language sql
stable
as $$
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
    and (
      p_q is null
      or primary_owner_name ilike '%' || p_q || '%'
      or primary_user_name ilike '%' || p_q || '%'
      or (p_q ~ '^[0-9]{3,}$' and (
        primary_owner_orgnr like p_q || '%'
        or primary_user_orgnr like p_q || '%'
      ))
    )
  group by make_name
  order by count(*) desc;
$$;

create function public.pop_summary_by_segment(
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
  p_bodywork int default null,
  p_focus_make text default 'Volvo',
  p_q text default null
)
returns table(segment text, count int, volvo_count int)
language sql
stable
as $$
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
    and (
      p_q is null
      or primary_owner_name ilike '%' || p_q || '%'
      or primary_user_name ilike '%' || p_q || '%'
      or (p_q ~ '^[0-9]{3,}$' and (
        primary_owner_orgnr like p_q || '%'
        or primary_user_orgnr like p_q || '%'
      ))
    )
  group by coalesce(pabygg_segment, 'Annet')
  order by count(*) desc;
$$;

create function public.pop_summary_by_region(
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
  p_bodywork int default null,
  p_focus_make text default 'Volvo',
  p_q text default null
)
returns table(region smallint, count int, volvo_count int)
language sql
stable
as $$
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
    and (
      p_q is null
      or primary_owner_name ilike '%' || p_q || '%'
      or primary_user_name ilike '%' || p_q || '%'
      or (p_q ~ '^[0-9]{3,}$' and (
        primary_owner_orgnr like p_q || '%'
        or primary_user_orgnr like p_q || '%'
      ))
    )
  group by sales_region
  order by sales_region;
$$;

create function public.pop_summary_by_fuel(
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
  p_bodywork int default null,
  p_focus_make text default 'Volvo',
  p_q text default null
)
returns table(fuel text, count int, volvo_count int)
language sql
stable
as $$
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
    and (
      p_q is null
      or primary_owner_name ilike '%' || p_q || '%'
      or primary_user_name ilike '%' || p_q || '%'
      or (p_q ~ '^[0-9]{3,}$' and (
        primary_owner_orgnr like p_q || '%'
        or primary_user_orgnr like p_q || '%'
      ))
    )
  group by fuel_name
  order by count(*) desc;
$$;

-- ---------------------------------------------------------------------------
-- Grants (funksjonene er security invoker – RLS gjelder fortsatt)
-- ---------------------------------------------------------------------------

do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in (
        'reg_summary_by_month',
        'reg_summary_by_make',
        'reg_summary_by_region',
        'reg_summary_by_district',
        'reg_summary_by_hp',
        'reg_summary_by_fuel',
        'reg_summary_by_pabygg',
        'reg_summary_by_segment',
        'reg_summary_by_disp',
        'reg_summary_by_bodywork',
        'pop_summary_by_make',
        'pop_summary_by_segment',
        'pop_summary_by_region',
        'pop_summary_by_fuel'
      )
  loop
    execute 'grant execute on function ' || r.sig::text
      || ' to authenticated, service_role';
  end loop;
end $$;
