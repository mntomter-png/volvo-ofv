-- TMF: utvid drivlinje-split fra ICE/EMOB til EMOB + diesel + gass.
drop function if exists public.tmf_monthly_market(date, date, text);

create or replace function public.tmf_monthly_market(
  p_from date default null,
  p_to date default null,
  p_focus_make text default 'Volvo'
)
returns table(
  month date,
  pabygg text,
  count int,
  volvo_count int,
  emob_count int,
  diesel_count int,
  gas_count int
)
language sql stable security invoker
as $$
  with classified as (
    select
      date_trunc('month', transaction_time)::date as month,
      coalesce(pabygg_segment, 'Annet') as pabygg,
      make_name,
      case
        when fuel_name is not null and fuel_name ilike '%elektr%' then 'emob'
        when fuel_name is not null and (fuel_name ilike '%gass%' or fuel_name ilike '%gas%') then 'gas'
        else 'diesel'
      end as fuel_bucket
    from public.registrations
    where transaction_type_id = '10'
      and maximum_laden_mass_kg >= 16000
      and (p_from is null or transaction_time >= p_from)
      and (p_to is null or transaction_time < (p_to + interval '1 day'))
  )
  select
    month,
    pabygg,
    count(*)::int as count,
    count(*) filter (where make_name = p_focus_make)::int as volvo_count,
    count(*) filter (where fuel_bucket = 'emob')::int as emob_count,
    count(*) filter (where fuel_bucket = 'diesel')::int as diesel_count,
    count(*) filter (where fuel_bucket = 'gas')::int as gas_count
  from classified
  group by 1, 2
  order by 1, 2;
$$;

grant execute on function public.tmf_monthly_market(date, date, text) to authenticated;
