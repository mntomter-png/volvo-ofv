-- TMF: splitt den tidligere ICE-resten i diesel, gass og annet.
-- Annet er hydrogen og alt som ikke er elektrisk, diesel eller gass.
-- Hydrogen skal ikke telles som diesel, selv om navnet også skulle inneholde diesel eller gass.
--
-- Returtypen utvides. CREATE OR REPLACE kan ikke endre RETURNS TABLE, så
-- funksjonen droppes og opprettes på nytt med samme argumenter
-- (date, date, text).
--
-- Dagens innstillinger beholdes:
--   language sql, stable, security invoker (prosecdef = false)
--   EXECUTE til PUBLIC, anon, authenticated og service_role
-- PUBLIC og anon er ikke revoket i dag, så de gis på nytt og revokes ikke.

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
  gas_count int,
  other_count int
)
language sql
stable
security invoker
as $$
  select
    classified.month,
    classified.pabygg,
    count(*)::int as count,
    count(*) filter (where classified.make_name = p_focus_make)::int as volvo_count,
    count(*) filter (where classified.drivetrain = 'emob')::int as emob_count,
    count(*) filter (where classified.drivetrain = 'diesel')::int as diesel_count,
    count(*) filter (where classified.drivetrain = 'gas')::int as gas_count,
    count(*) filter (where classified.drivetrain = 'other')::int as other_count
  from (
    select
      date_trunc('month', transaction_time)::date as month,
      coalesce(pabygg_segment, 'Annet') as pabygg,
      make_name,
      case
        -- Elektrisk først, samme regel som før (fuel_name ilike '%elektr%').
        when fuel_name ilike '%elektr%' then 'emob'
        -- Hydrogen før diesel og gass, så det aldri havner i diesel.
        when fuel_name ilike '%hydrogen%' then 'other'
        when fuel_name ilike '%gass%' or fuel_name ilike '%gas%' then 'gas'
        when fuel_name ilike '%diesel%' then 'diesel'
        -- Bensin, ikke oppgitt, null og alt annet.
        else 'other'
      end as drivetrain
    from public.registrations
    where transaction_type_id = '10'
      and maximum_laden_mass_kg >= 16000
      and (p_from is null or transaction_time >= p_from)
      and (p_to is null or transaction_time < (p_to + interval '1 day'))
  ) as classified
  group by 1, 2
  order by 1, 2;
$$;

grant execute on function public.tmf_monthly_market(date, date, text) to public;
grant execute on function public.tmf_monthly_market(date, date, text) to anon;
grant execute on function public.tmf_monthly_market(date, date, text) to authenticated;
grant execute on function public.tmf_monthly_market(date, date, text) to service_role;
