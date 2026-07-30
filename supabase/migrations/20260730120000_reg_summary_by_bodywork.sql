-- Oppsummering per OFV AdditionalBodyworks (bodywork_code).
-- NULL → -1 (trekkvogn uten påbygg), samme konvensjon som bodywork-filteret.

create or replace function public.reg_summary_by_bodywork(
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
returns table(bodywork_code int, count int, volvo_count int)
language sql
stable
security invoker
as $$
  select
    coalesce(r.bodywork_code, -1)::int as bodywork_code,
    count(*)::int,
    count(*) filter (where r.make_name = p_focus_make)::int
  from public.registrations r
  where r.transaction_type_id = '10'
    and r.maximum_laden_mass_kg >= 16000
    and (p_from is not null or p_to is not null or extract(year from r.transaction_time) = p_year)
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
  group by coalesce(r.bodywork_code, -1)
  order by count(*) desc, coalesce(r.bodywork_code, -1);
$$;

grant execute on function public.reg_summary_by_bodywork(
  int, text, text, int, int, int, text, text, int, text, int, date, date, text
) to authenticated;
