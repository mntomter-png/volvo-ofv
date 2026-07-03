-- TMF: månedlig markedsdata per påbygg-segment fra OFV-registreringer.

create or replace function public.tmf_monthly_market(
  p_from date default null,
  p_to date default null
)
returns table(month date, pabygg text, count int)
language sql stable security invoker
as $$
  select
    date_trunc('month', transaction_time)::date as month,
    coalesce(pabygg_segment, 'Annet') as pabygg,
    count(*)::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg >= 16000
    and (p_from is null or transaction_time >= p_from)
    and (p_to is null or transaction_time < (p_to + interval '1 day'))
  group by 1, 2
  order by 1, 2;
$$;

grant execute on function public.tmf_monthly_market(date, date) to authenticated;
