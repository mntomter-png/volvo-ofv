-- Segmentering basert på OFV Usage (oppbygning). Fjerner vekt-filteret fra
-- forrige migrasjon og bruker OFVs offisielle Usage-kategorier som segment.

create or replace view public.dashboard_registrations_by_month
with (security_invoker = true) as
select date_trunc('month', transaction_time)::date as month, count(*)::int as count
from public.registrations
where transaction_type_id = '10'
group by 1 order by 1;

create or replace view public.dashboard_registrations_by_make
with (security_invoker = true) as
select make_name, count(*)::int as count
from public.registrations
where transaction_type_id = '10' and make_name is not null
group by make_name order by count desc;

create or replace view public.dashboard_population_by_make
with (security_invoker = true) as
select make_name, count(*)::int as count
from public.population
where snapshot_date = (select max(snapshot_date) from public.population) and make_name is not null
group by make_name order by count desc;

-- Segment = OFV Usage (oppbygning)
create or replace view public.dashboard_registrations_by_segment
with (security_invoker = true) as
select
  coalesce(usage_name, 'Ukjent') as segment,
  count(*)::int as count,
  count(*) filter (where make_name = 'Volvo')::int as volvo_count
from public.registrations
where transaction_type_id = '10'
group by coalesce(usage_name, 'Ukjent')
order by count desc;

create or replace view public.dashboard_population_by_segment
with (security_invoker = true) as
select
  coalesce(usage_name, 'Ukjent') as segment,
  count(*)::int as count,
  count(*) filter (where make_name = 'Volvo')::int as volvo_count
from public.population
where snapshot_date = (select max(snapshot_date) from public.population)
group by coalesce(usage_name, 'Ukjent')
order by count desc;

grant select on public.dashboard_registrations_by_segment to authenticated;
grant select on public.dashboard_population_by_segment to authenticated;
