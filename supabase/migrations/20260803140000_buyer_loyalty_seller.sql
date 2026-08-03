-- Selger-vennlig kjøperlogikk:
-- 1) Periodestart følger månedfilter (ikke bare år) når p_month er satt
-- 2) Prior historie scoper til samme region når regionfilter er aktivt
-- 3) Ny kategori «conquest» = eier uten tidligere fokusmerke (Volvo),
--    men med fokusmerke-kjøp i perioden (merkesskifte / første Volvo)

do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in ('reg_buyer_loyalty', 'reg_buyer_loyalty_owners')
  loop
    execute 'drop function if exists ' || r.sig::text;
  end loop;
end $$;

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
  p_focus_make text default 'Volvo'
)
returns table(buyer_type text, owner_count int, purchase_count int, focus_count int)
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
    select
      coalesce(nullif(r.primary_owner_orgnr, ''), r.primary_owner_name) as owner_key,
      bool_or(r.make_name = p_focus_make) as had_focus
    from public.registrations r
    cross join bounds b
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and coalesce(nullif(r.primary_owner_orgnr, ''), r.primary_owner_name) is not null
      and r.transaction_time < b.period_start
      -- Samme geografi som perioden når region er valgt (selger-scope)
      and (p_region is null or r.sales_region = p_region)
    group by 1
  ),
  owner_period as (
    select
      p.owner_key,
      count(*)::int as purchase_count,
      count(*) filter (where p.make_name = p_focus_make)::int as focus_count,
      bool_or(p.make_name = p_focus_make) as bought_focus,
      coalesce(pr.had_focus, false) as had_focus,
      (pr.owner_key is not null) as had_any_prior
    from period_regs p
    left join prior_owners pr on pr.owner_key = p.owner_key
    group by p.owner_key, pr.had_focus, pr.owner_key
  ),
  classified as (
    select
      owner_key,
      purchase_count,
      focus_count,
      case when had_any_prior then 'repeat' else 'new' end as loyalty_type,
      case
        when bought_focus and not had_focus then 'conquest'
        else null
      end as conquest_type
    from owner_period
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

grant execute on function public.reg_buyer_loyalty(
  int, text, text, int, int, int, text, text, int, text, int, date, date, text
) to authenticated;

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
  p_focus_make text default 'Volvo'
)
returns table(owner_name text, count int, focus_count int)
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
    select
      coalesce(nullif(r.primary_owner_orgnr, ''), r.primary_owner_name) as owner_key,
      bool_or(r.make_name = p_focus_make) as had_focus
    from public.registrations r
    cross join bounds b
    where r.transaction_type_id = '10'
      and r.maximum_laden_mass_kg >= 16000
      and coalesce(nullif(r.primary_owner_orgnr, ''), r.primary_owner_name) is not null
      and r.transaction_time < b.period_start
      and (p_region is null or r.sales_region = p_region)
    group by 1
  ),
  owner_totals as (
    select
      p.owner_key,
      max(p.primary_owner_name) as owner_name,
      count(*)::int as purchase_count,
      count(*) filter (where p.make_name = p_focus_make)::int as focus_count,
      bool_or(p.make_name = p_focus_make) as bought_focus,
      coalesce(pr.had_focus, false) as had_focus,
      (pr.owner_key is not null) as had_any_prior
    from period_regs p
    left join prior_owners pr on pr.owner_key = p.owner_key
    group by p.owner_key, pr.had_focus, pr.owner_key
  )
  select owner_name, purchase_count, focus_count
  from owner_totals
  where case p_buyer_type
    when 'repeat' then had_any_prior
    when 'new' then not had_any_prior
    when 'conquest' then bought_focus and not had_focus
    else false
  end
  order by purchase_count desc, owner_name
  limit greatest(p_limit, 1);
$$;

grant execute on function public.reg_buyer_loyalty_owners(
  int, text, text, text, int, int, int, text, text, int, text, int, date, date, int, text
) to authenticated;

notify pgrst, 'reload schema';
