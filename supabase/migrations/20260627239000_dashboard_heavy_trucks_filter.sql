-- Begrens dashbord til tunge lastebiler (> 16t) i alle aggregeringer.

create or replace view public.dashboard_registrations_by_month
with (security_invoker = true) as
select date_trunc('month', transaction_time)::date as month, count(*)::int as count
from public.registrations
where transaction_type_id = '10' and maximum_laden_mass_kg > 16000
group by 1 order by 1;

create or replace view public.dashboard_registrations_by_make
with (security_invoker = true) as
select make_name, count(*)::int as count
from public.registrations
where transaction_type_id = '10' and make_name is not null and maximum_laden_mass_kg > 16000
group by make_name order by count desc;

create or replace view public.dashboard_population_by_make
with (security_invoker = true) as
select make_name, count(*)::int as count
from public.population
where snapshot_date = (select max(snapshot_date) from public.population) and make_name is not null and maximum_laden_mass_kg > 16000
group by make_name order by count desc;

create or replace view public.dashboard_registrations_by_segment
with (security_invoker = true) as
select
  coalesce(usage_name, 'Ukjent') as segment,
  count(*)::int as count,
  count(*) filter (where make_name = 'Volvo')::int as volvo_count
from public.registrations
where transaction_type_id = '10' and maximum_laden_mass_kg > 16000
group by coalesce(usage_name, 'Ukjent')
order by count desc;

create or replace view public.dashboard_population_by_segment
with (security_invoker = true) as
select
  coalesce(usage_name, 'Ukjent') as segment,
  count(*)::int as count,
  count(*) filter (where make_name = 'Volvo')::int as volvo_count
from public.population
where snapshot_date = (select max(snapshot_date) from public.population) and maximum_laden_mass_kg > 16000
group by coalesce(usage_name, 'Ukjent')
order by count desc;

grant select on public.dashboard_registrations_by_segment to authenticated;
grant select on public.dashboard_population_by_segment to authenticated;

-- RPC-funksjoner med samme vekt-filter.
create or replace function public.dash_registrations_by_month(p_segment text default null)
returns table(month date, count int)
language sql stable security invoker
as $$
  select date_trunc('month', transaction_time)::date as month, count(*)::int
  from public.registrations
  where transaction_type_id = '10' and maximum_laden_mass_kg > 16000
    and (p_segment is null or usage_name = p_segment)
  group by 1 order by 1;
$$;

create or replace function public.dash_registrations_by_make(p_segment text default null)
returns table(make_name text, count int)
language sql stable security invoker
as $$
  select make_name, count(*)::int
  from public.registrations
  where transaction_type_id = '10' and make_name is not null and maximum_laden_mass_kg > 16000
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
    and make_name is not null and maximum_laden_mass_kg > 16000
    and (p_segment is null or usage_name = p_segment)
  group by make_name order by count(*) desc;
$$;

grant execute on function public.dash_registrations_by_month(text) to authenticated;
grant execute on function public.dash_registrations_by_make(text) to authenticated;
grant execute on function public.dash_population_by_make(text) to authenticated;
