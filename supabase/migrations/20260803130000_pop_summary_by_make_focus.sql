-- pop_summary_by_make mistet p_focus_make da bodywork-filter ble lagt til.
-- Appen sender p_focus_make via withFocusMake() → PostgREST finner ikke signaturen.

do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'pop_summary_by_make'
  loop
    execute 'drop function if exists ' || r.sig::text;
  end loop;
end $$;

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
  p_focus_make text default 'Volvo'
)
returns table(make_name text, count int)
language sql
stable
security invoker
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
  group by make_name
  order by count(*) desc;
$$;

grant execute on function public.pop_summary_by_make(
  text, text, int, text, int, text, text, int, text, text, int, text
) to authenticated;

notify pgrst, 'reload schema';
