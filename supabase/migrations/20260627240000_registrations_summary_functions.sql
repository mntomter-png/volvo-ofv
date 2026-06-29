-- Aggregeringer for nyregistreringer-siden med filtre.

create or replace function public.reg_summary_by_month(
  p_year int,
  p_segment text default null,
  p_make text default null
)
returns table(month date, count int)
language sql stable security invoker
as $$
  select date_trunc('month', transaction_time)::date as month, count(*)::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg > 16000
    and extract(year from transaction_time) = p_year
    and (p_segment is null or usage_name = p_segment)
    and (p_make is null or make_name = p_make)
  group by 1 order by 1;
$$;

create or replace function public.reg_summary_by_make(
  p_year int,
  p_segment text default null,
  p_make text default null
)
returns table(make_name text, count int)
language sql stable security invoker
as $$
  select make_name, count(*)::int
  from public.registrations
  where transaction_type_id = '10'
    and maximum_laden_mass_kg > 16000
    and make_name is not null
    and extract(year from transaction_time) = p_year
    and (p_segment is null or usage_name = p_segment)
    and (p_make is null or make_name = p_make)
  group by make_name order by count(*) desc;
$$;

grant execute on function public.reg_summary_by_month(int, text, text) to authenticated;
grant execute on function public.reg_summary_by_make(int, text, text) to authenticated;
