-- Legg til valgfritt måned-filter (p_month, 1-12) i merkefordeling for
-- nyregistreringer, slik at man kan bore ned på én måned i diagrammet.

drop function if exists public.reg_summary_by_make(int, text, text);

create or replace function public.reg_summary_by_make(
  p_year int,
  p_segment text default null,
  p_make text default null,
  p_month int default null
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
    and (p_month is null or extract(month from transaction_time) = p_month)
  group by make_name order by count(*) desc;
$$;

grant execute on function public.reg_summary_by_make(int, text, text, int) to authenticated;
