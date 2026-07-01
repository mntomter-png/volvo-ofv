-- Steg 5: Gjentakende vs. nye kjøpere i perioden

create or replace function public.reg_buyer_loyalty(
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
  p_from date default null,
  p_to date default null,
  p_focus_make text default 'Volvo'
)
returns table(
  buyer_type text,
  owner_count int,
  purchase_count int,
  focus_count int
)
language sql stable security invoker
as $$
  with bounds as (
    select
      coalesce(
        p_from,
        make_date(p_year, 1, 1)
      )::timestamp as period_start,
      coalesce(
        (p_to + 1),
        make_date(p_year + 1, 1, 1)
      )::timestamp as period_end_exclusive
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

grant execute on function public.reg_buyer_loyalty(int, text, text, int, int, int, text, text, int, text, date, date, text) to authenticated;
