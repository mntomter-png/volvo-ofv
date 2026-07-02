-- PKK: handlingsvindu — ekskluder eldgamle forfalte frister (f.eks. fra 2003).

drop function if exists public.pop_pkk_summary(int, int, int, boolean, text);
drop function if exists public.pop_pkk_customers(int, int, int, boolean, text);
drop function if exists public.pop_pkk_owner_vehicles(text, int, int, boolean, int, text);

create or replace function public.pop_pkk_customers(
  p_region int default null,
  p_min_volvo int default 5,
  p_customer_limit int default 50,
  p_only_follow_up boolean default true,
  p_horizon text default 'actionable',
  p_focus_make text default 'Volvo'
)
returns table(
  owner_key text,
  owner_name text,
  owner_orgnr text,
  owner_location text,
  sales_region int,
  focus_count int,
  overdue_count int,
  due_30_count int,
  due_90_count int,
  due_180_count int,
  next_deadline date,
  days_to_next int
)
language sql stable security invoker
as $$
  with vehicles as (
    select
      coalesce(nullif(primary_owner_orgnr, ''), primary_owner_name) as owner_key,
      primary_owner_name,
      primary_owner_orgnr,
      coalesce(
        nullif(primary_owner_company_postal_district, ''),
        nullif(primary_owner_postal_district, '')
      ) as owner_location,
      sales_region,
      pkk_next_deadline,
      case
        when p_horizon = 'all' then
          pkk_next_deadline is not null
        when p_horizon = 'upcoming' then
          pkk_next_deadline is not null
          and pkk_next_deadline >= current_date
          and pkk_next_deadline <= (current_date + make_interval(months => 6))
        else
          pkk_next_deadline is not null
          and pkk_next_deadline >= (current_date - interval '90 days')
          and pkk_next_deadline <= (current_date + make_interval(months => 6))
      end as in_horizon
    from public.population
    where snapshot_date = (select max(snapshot_date) from public.population)
      and maximum_laden_mass_kg >= 16000
      and primary_owner_name is not null
      and make_name = p_focus_make
      and (p_region is null or sales_region = p_region)
  ),
  base as (
    select owner_key,
           max(primary_owner_name) as owner_name,
           max(nullif(primary_owner_orgnr, '')) as owner_orgnr,
           max(owner_location) as owner_location,
           max(sales_region)::int as sales_region,
           count(*)::int as focus_count,
           count(*) filter (
             where in_horizon and pkk_next_deadline < current_date
           )::int as overdue_count,
           count(*) filter (
             where in_horizon
               and pkk_next_deadline >= current_date
               and pkk_next_deadline <= (current_date + interval '30 days')
           )::int as due_30_count,
           count(*) filter (
             where in_horizon
               and pkk_next_deadline >= current_date
               and pkk_next_deadline <= (current_date + interval '90 days')
           )::int as due_90_count,
           count(*) filter (where in_horizon)::int as due_180_count,
           min(pkk_next_deadline) filter (where in_horizon) as next_deadline
    from vehicles
    group by owner_key
    having count(*) >= greatest(p_min_volvo, 1)
  ),
  filtered as (
    select *
    from base
    where not p_only_follow_up
       or overdue_count > 0
       or due_30_count > 0
       or due_90_count > 0
  )
  select owner_key,
         owner_name,
         owner_orgnr,
         owner_location,
         sales_region,
         focus_count,
         overdue_count,
         due_30_count,
         due_90_count,
         due_180_count,
         next_deadline,
         (next_deadline - current_date)::int as days_to_next
  from filtered
  order by overdue_count desc,
           due_30_count desc,
           due_90_count desc,
           next_deadline asc nulls last,
           focus_count desc,
         owner_name
  limit greatest(p_customer_limit, 1);
$$;

create or replace function public.pop_pkk_summary(
  p_region int default null,
  p_min_volvo int default 5,
  p_customer_limit int default 50,
  p_only_follow_up boolean default true,
  p_horizon text default 'actionable',
  p_focus_make text default 'Volvo'
)
returns table(
  customer_count int,
  volvo_vehicles int,
  overdue_count int,
  due_30_count int,
  due_90_count int,
  due_180_count int,
  no_pkk_date_count int
)
language sql stable security invoker
as $$
  with customer_stats as (
    select *
    from public.pop_pkk_customers(
      p_region,
      p_min_volvo,
      p_customer_limit,
      p_only_follow_up,
      p_horizon,
      p_focus_make
    )
  ),
  fleet as (
    select p.*
    from public.population p
    inner join customer_stats c
      on coalesce(nullif(p.primary_owner_orgnr, ''), p.primary_owner_name) = c.owner_key
    where p.snapshot_date = (select max(snapshot_date) from public.population)
      and p.maximum_laden_mass_kg >= 16000
      and p.make_name = p_focus_make
      and (p_region is null or p.sales_region = p_region)
  )
  select (select count(*)::int from customer_stats),
         count(*)::int,
         (select coalesce(sum(overdue_count), 0)::int from customer_stats),
         (select coalesce(sum(due_30_count), 0)::int from customer_stats),
         (select coalesce(sum(due_90_count), 0)::int from customer_stats),
         (select coalesce(sum(due_180_count), 0)::int from customer_stats),
         count(*) filter (where pkk_next_deadline is null)::int
  from fleet;
$$;

create or replace function public.pop_pkk_owner_vehicles(
  p_owner_key text,
  p_region int default null,
  p_months int default 6,
  p_include_no_date boolean default false,
  p_horizon text default 'actionable',
  p_limit int default 200,
  p_focus_make text default 'Volvo'
)
returns table(
  registration_number text,
  make_name text,
  model_name text,
  first_registration_date date,
  pkk_last_date date,
  pkk_next_deadline date,
  days_until_due int
)
language sql stable security invoker
as $$
  select registration_number,
         make_name,
         model_name,
         first_registration_date,
         pkk_last_date,
         pkk_next_deadline,
         (pkk_next_deadline - current_date)::int as days_until_due
  from public.population
  where snapshot_date = (select max(snapshot_date) from public.population)
    and maximum_laden_mass_kg >= 16000
    and make_name = p_focus_make
    and coalesce(nullif(primary_owner_orgnr, ''), primary_owner_name) = p_owner_key
    and (p_region is null or sales_region = p_region)
    and (
      p_include_no_date
      or (
        p_horizon = 'all'
        and pkk_next_deadline is not null
        and pkk_next_deadline <= (current_date + make_interval(months => greatest(p_months, 1)))
      )
      or (
        p_horizon = 'upcoming'
        and pkk_next_deadline is not null
        and pkk_next_deadline >= current_date
        and pkk_next_deadline <= (current_date + make_interval(months => greatest(p_months, 1)))
      )
      or (
        coalesce(p_horizon, 'actionable') = 'actionable'
        and pkk_next_deadline is not null
        and pkk_next_deadline >= (current_date - interval '90 days')
        and pkk_next_deadline <= (current_date + make_interval(months => greatest(p_months, 1)))
      )
    )
  order by pkk_next_deadline asc nulls last, registration_number
  limit greatest(p_limit, 1);
$$;

grant execute on function public.pop_pkk_summary(int, int, int, boolean, text, text) to authenticated;
grant execute on function public.pop_pkk_customers(int, int, int, boolean, text, text) to authenticated;
grant execute on function public.pop_pkk_owner_vehicles(text, int, int, boolean, text, int, text) to authenticated;
