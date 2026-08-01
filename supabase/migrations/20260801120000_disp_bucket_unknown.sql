-- Vis «Ukjent» for registreringer uten disp_bucket (CC mangler i OFV).
-- Bruker bøtte 0 i API/UI; lagret verdi forblir NULL (ingen kolonne-rebuild).

create or replace function public.reg_summary_by_disp(
  p_year int, p_segment text default null, p_make text default null,
  p_month int default null, p_region int default null, p_hp int default null,
  p_fuel text default null, p_pabygg text default null, p_disp int default null,
  p_chassis text default null, p_bodywork int default null,
  p_from date default null, p_to date default null, p_focus_make text default 'Volvo'
)
returns table(bucket smallint, count int, volvo_count int)
language sql stable security invoker as $$
  select
    coalesce(disp_bucket, 0)::smallint as bucket,
    count(*)::int,
    count(*) filter (where make_name = p_focus_make)::int
  from public.registrations
  where transaction_type_id = '10' and maximum_laden_mass_kg >= 16000
    and (p_from is not null or p_to is not null or extract(year from transaction_time) = p_year)
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
  group by coalesce(disp_bucket, 0)
  order by case when coalesce(disp_bucket, 0) = 0 then 99 else coalesce(disp_bucket, 0) end;
$$;

grant execute on function public.reg_summary_by_disp(
  int, text, text, int, int, int, text, text, int, text, int, date, date, text
) to authenticated;

-- Felles filterhjelper: p_disp = 0 betyr disp_bucket IS NULL.
create or replace function public.ofv_disp_matches(p_bucket smallint, p_disp int)
returns boolean
language sql
immutable
parallel safe
as $$
  select
    p_disp is null
    or (p_disp = 0 and p_bucket is null)
    or p_bucket = p_disp;
$$;

grant execute on function public.ofv_disp_matches(smallint, int) to authenticated;
