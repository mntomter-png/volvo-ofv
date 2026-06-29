-- Aggregeringer for populasjon/bestand-siden med filtre.

create or replace function public.pop_summary_by_make(
  p_segment text default null,
  p_make text default null
)
returns table(make_name text, count int)
language sql stable security invoker
as $$
  select make_name, count(*)::int
  from public.population
  where snapshot_date = (select max(snapshot_date) from public.population)
    and make_name is not null
    and maximum_laden_mass_kg > 16000
    and (p_segment is null or usage_name = p_segment)
    and (p_make is null or make_name = p_make)
  group by make_name order by count(*) desc;
$$;

create or replace function public.pop_summary_by_segment(
  p_segment text default null,
  p_make text default null
)
returns table(segment text, count int, volvo_count int)
language sql stable security invoker
as $$
  select
    coalesce(usage_name, 'Ukjent') as segment,
    count(*)::int as count,
    count(*) filter (where make_name = 'Volvo')::int as volvo_count
  from public.population
  where snapshot_date = (select max(snapshot_date) from public.population)
    and maximum_laden_mass_kg > 16000
    and (p_segment is null or usage_name = p_segment)
    and (p_make is null or make_name = p_make)
  group by coalesce(usage_name, 'Ukjent')
  order by count(*) desc;
$$;

grant execute on function public.pop_summary_by_make(text, text) to authenticated;
grant execute on function public.pop_summary_by_segment(text, text) to authenticated;
