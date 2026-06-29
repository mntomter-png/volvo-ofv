-- Parameteriserte aggregeringer for dashbord med valgfritt segment (OFV Usage).

create or replace function public.dash_registrations_by_month(p_segment text default null)
returns table(month date, count int)
language sql stable security invoker
as $$
  select date_trunc('month', transaction_time)::date as month, count(*)::int
  from public.registrations
  where transaction_type_id = '10'
    and (p_segment is null or usage_name = p_segment)
  group by 1 order by 1;
$$;

create or replace function public.dash_registrations_by_make(p_segment text default null)
returns table(make_name text, count int)
language sql stable security invoker
as $$
  select make_name, count(*)::int
  from public.registrations
  where transaction_type_id = '10' and make_name is not null
    and (p_segment is null or usage_name = p_segment)
  group by make_name order by count(*) desc;
$$;

create or replace function public.dash_population_by_make(p_segment text default null)
returns table(make_name text, count int)
language sql stable security invoker
as $$
  select make_name, count(*)::int
  from public.population
  where snapshot_date = (select max(snapshot_date) from public.population)
    and make_name is not null
    and (p_segment is null or usage_name = p_segment)
  group by make_name order by count(*) desc;
$$;

grant execute on function public.dash_registrations_by_month(text) to authenticated;
grant execute on function public.dash_registrations_by_make(text) to authenticated;
grant execute on function public.dash_population_by_make(text) to authenticated;
